/**
 * Virtual Node Firmware Simulation
 * Ports C++ NodeController and NetworkManager logic to JS.
 */

// Protocol Constants (Must match C++)
const PROTOCOL_STX = 0x02;
const PROTOCOL_ETX = 0x03;
const PROTOCOL_ESC = 0x1B;
const MSG_POLL = 0x01;
const MSG_HEARTBEAT = 0x02;
const MSG_SET_COLOR = 0x03;
const MSG_BUTTON_EVENT = 0x04;
const BROADCAST_ID = 0;

export class VirtualNode {
    constructor(id, bus) {
        this.id = id;
        this.bus = bus;

        // Registers (mimicking NodeRegisters struct)
        this.registers = {
            hubRed: 0, hubGreen: 0, hubBlue: 0,
            strut1Red: 0, strut1Green: 0, strut1Blue: 0,
            strut2Red: 0, strut2Green: 0, strut2Blue: 0,
            strut3Red: 0, strut3Green: 0, strut3Blue: 0,
            buttonPressed: false,
            lastPressTime: 0
        };

        // Hardware State (What would be sent to LEDs)
        this.leds = {
            hub: [0, 0, 0],
            struts: [
                [0, 0, 0], // Strut 1
                [0, 0, 0], // Strut 2
                [0, 0, 0]  // Strut 3
            ]
        };

        // RX Buffer logic
        this.rxBuffer = [];
        this.receiving = false;
        this.escaped = false;
    }

    /**
     * Called by VirtualBus when data is on the line
     */
    receive(data) {
        for (let i = 0; i < data.length; i++) {
            const b = data[i];

            if (this.escaped) {
                if (this.receiving) {
                    this.rxBuffer.push(b);
                }
                this.escaped = false;
                continue;
            }

            if (b === PROTOCOL_ESC) {
                this.escaped = true;
                continue;
            }

            if (b === PROTOCOL_STX) {
                this.receiving = true;
                this.rxBuffer = [];
                this.escaped = false;
                continue;
            }

            if (this.receiving) {
                if (b === PROTOCOL_ETX) {
                    this.processPacket(this.rxBuffer);
                    this.receiving = false;
                    this.rxBuffer = [];
                } else {
                    this.rxBuffer.push(b);
                }
            }
        }
    }

    processPacket(buffer) {
        // [LEN, PAYLOAD..., CRC]
        if (buffer.length < 3) return;

        const len = buffer[0];
        // Validate len? 

        // Check CRC
        const payloadAndLen = buffer.slice(0, buffer.length - 1);
        const receivedCRC = buffer[buffer.length - 1];
        const calcCRC = this.calculateCRC(payloadAndLen);

        if (receivedCRC !== calcCRC) {
            console.warn(`Node ${this.id} CRC Error`);
            return;
        }

        // Parse Payload
        // C++: struct PacketPayload { uint8_t msgType; uint8_t nodeId; union { ... } }
        const payloadBytes = buffer.slice(1, buffer.length - 1);

        const msgType = payloadBytes[0];
        const nodeId = payloadBytes[1];

        const isForMe = (nodeId === this.id);
        const isBroadcast = (nodeId === BROADCAST_ID);

        if (isForMe || isBroadcast) {
            this.handleMessage(msgType, payloadBytes);
        }
    }

    handleMessage(msgType, payload) {
        // payload index 0 is msgType, 1 is nodeId
        // Data starts at 2

        switch (msgType) {
            case MSG_POLL:
                // Master asking for status
                // If we have a button press pending (or just current state), report it
                // For this sim, we just blindly reply with current button state
                this.sendButtonStatus();
                break;

            case MSG_SET_COLOR:
                // struct { uint8_t hubR, hubG, hubB; uint8_t strR, strG, strB; }
                const hubR = payload[2];
                const hubG = payload[3];
                const hubB = payload[4];
                const strR = payload[5];
                const strG = payload[6];
                const strB = payload[7];

                this.setColors(hubR, hubG, hubB, strR, strG, strB);
                break;
        }
    }

    setColors(hr, hg, hb, sr, sg, sb) {
        this.registers.hubRed = hr;
        this.registers.hubGreen = hg;
        this.registers.hubBlue = hb;

        // Simplified: Applying same color to all 3 strut registers for now
        // matching the C++ loop logic which set all 3 from one command
        this.registers.strut1Red = sr; this.registers.strut1Green = sg; this.registers.strut1Blue = sb;
        this.registers.strut2Red = sr; this.registers.strut2Green = sg; this.registers.strut2Blue = sb;
        this.registers.strut3Red = sr; this.registers.strut3Green = sg; this.registers.strut3Blue = sb;

        this.updateHardware();
    }

    // "Main Loop" Equivalent
    updateHardware() {
        // 1. Button Logic (simulated)
        if (this.registers.buttonPressed) {
            // Firmware Logic: If pressed, turn Hub White
            this.leds.hub = [255, 255, 255];
        } else {
            this.leds.hub = [this.registers.hubRed, this.registers.hubGreen, this.registers.hubBlue];
        }

        // 2. Struts
        this.leds.struts[0] = [this.registers.strut1Red, this.registers.strut1Green, this.registers.strut1Blue];
        this.leds.struts[1] = [this.registers.strut2Red, this.registers.strut2Green, this.registers.strut2Blue];
        this.leds.struts[2] = [this.registers.strut3Red, this.registers.strut3Green, this.registers.strut3Blue];
    }

    // --- IO ---

    pressButton() {
        if (!this.registers.buttonPressed) {
            this.registers.buttonPressed = true;
            this.sendButtonStatus(); // Immediate report (collision risk simulated!) 
            this.updateHardware();
            // TODO: In real FW we only reply on POLL or async collision risk.
            // C++ code: sendButtonPress(lastButtonState) when changed.
        }
    }

    releaseButton() {
        if (this.registers.buttonPressed) {
            this.registers.buttonPressed = false;
            this.sendButtonStatus();
            this.updateHardware();
        }
    }

    sendButtonStatus() {
        // Construct Packet
        // MSG_BUTTON_EVENT
        const payloadLength = 16; // Fixed size in C++ struct PacketPayload
        const packetSize = 1 + payloadLength + 1; // LEN + PAYLOAD + CRC

        const payload = new Uint8Array(payloadLength).fill(0);
        payload[0] = MSG_BUTTON_EVENT;
        payload[1] = this.id;
        // Union structure... button data is roughly at same offset as color?
        // Wait, Union of {color} and {button}.
        // color uses 6 bytes. button uses 1 byte.
        // C++: union { struct color...; struct button { uint8_t pressed } }
        // So pressed is at index 0 of the union, which is index 2 of payload.

        payload[2] = this.registers.buttonPressed ? 1 : 0;

        // Build Full Frame
        // [STX][LEN][PAYLOAD][CRC][ETX]
        // Build Full Frame
        // [STX][LEN][PAYLOAD][CRC][ETX]
        const rawFrame = [PROTOCOL_STX];

        const pushByte = (b) => {
            if (b === PROTOCOL_STX || b === PROTOCOL_ETX || b === PROTOCOL_ESC) {
                rawFrame.push(PROTOCOL_ESC);
            }
            rawFrame.push(b);
        };

        // LEN
        pushByte(payloadLength);

        // PAYLOAD
        for (let i = 0; i < payloadLength; i++) {
            pushByte(payload[i]);
        }

        const crcContent = new Uint8Array(1 + payloadLength);
        crcContent[0] = payloadLength;
        crcContent.set(payload, 1);

        const crc = this.calculateCRC(crcContent);

        // CRC
        pushByte(crc);

        // ETX
        rawFrame.push(PROTOCOL_ETX);

        this.bus.broadcast(new Uint8Array(rawFrame), this);
    }

    calculateCRC(data) {
        let crc = 0;
        for (let b of data) crc ^= b;
        return crc;
    }
}
