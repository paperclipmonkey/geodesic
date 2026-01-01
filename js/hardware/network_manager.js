/**
 * Network Manager (Master Controller)
 * Handles RS485 Protocol (Master Side) and Polling
 */

const PROTOCOL_STX = 0x02;
const PROTOCOL_ETX = 0x03;
const PROTOCOL_ESC = 0x1B;
const MSG_POLL = 0x01;
const MSG_HEARTBEAT = 0x02;
const MSG_SET_COLOR = 0x03;
const MSG_BUTTON_EVENT = 0x04;
const BROADCAST_ID = 0;

export class NetworkManager {
    constructor(bus) {
        this.bus = bus;
        this.nodes = new Set(); // Known nodes

        // RX State
        this.rxBuffer = [];
        this.receiving = false;
        this.escaped = false;

        // Callbacks
        this.onButtonPress = null; // function(nodeId, pressed)

        // Connect to bus
        if (this.bus) {
            this.bus.setMaster(this);
        }

        // Start Polling Loop
        this.pollInterval = setInterval(() => this.pollLoop(), 50); // 20Hz Polling
    }

    /**
     * Received data from Bus (from Nodes)
     */
    receive(data) {
        for (let i = 0; i < data.length; i++) {
            const b = data[i];

            if (this.escaped) {
                // Previous byte was ESC, so treat this as data even if it matches a control char
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
                this.escaped = false; // Reset escape state just in case
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
        if (buffer.length < 3) return;

        // Check CRC
        const payloadAndLen = buffer.slice(0, buffer.length - 1);
        const receivedCRC = buffer[buffer.length - 1];
        const calcCRC = this.calculateCRC(payloadAndLen);

        if (receivedCRC !== calcCRC) {
            console.warn("[NetworkManager] CRC Error from Node");
            return;
        }

        const payloadBytes = buffer.slice(1, buffer.length - 1);
        const msgType = payloadBytes[0];
        const nodeId = payloadBytes[1];

        if (msgType === MSG_BUTTON_EVENT) {
            const pressed = payloadBytes[2] === 1;
            if (this.onButtonPress) {
                this.onButtonPress(nodeId, pressed);
            }
        }
    }

    pollLoop() {
        // Round-robin poll known nodes? 
        // Or just listen?
        // In this simple RS485 sim, we might purely rely on the "Collision" event style 
        // derived from the VirtualNode's proactive send, OR we can implement strict polling.
        // For efficiency in JS, we'll let nodes speak when they have something, 
        // but we can emit a POLL command just to show we can.

        // this.sendPacket(MSG_POLL, BROADCAST_ID, []); 
    }

    setColor(nodeId, hubR, hubG, hubB, strR, strG, strB) {
        // Payload: [MSG_TYPE, NODE_ID, HUB_R, HUB_G, HUB_B, STR_R, STR_G, STR_B, ...]
        // We need to fill the fixed size struct (16 bytes payload)

        const data = new Uint8Array(14); // Remaining payload bytes
        data[0] = hubR;
        data[1] = hubG;
        data[2] = hubB;
        data[3] = strR;
        data[4] = strG;
        data[5] = strB;

        this.sendPacket(MSG_SET_COLOR, nodeId, data);
    }

    sendPacket(msgType, nodeId, dataBytes) {
        const payloadLength = 16;
        const payload = new Uint8Array(payloadLength).fill(0);

        payload[0] = msgType;
        payload[1] = nodeId;
        if (dataBytes) {
            payload.set(dataBytes, 2);
        }

        const rawFrame = [PROTOCOL_STX];

        // Helper to push with escaping
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

        // CRC
        const crcContent = new Uint8Array(1 + payloadLength);
        crcContent[0] = payloadLength;
        crcContent.set(payload, 1);
        const crc = this.calculateCRC(crcContent);

        pushByte(crc);

        // ETX
        rawFrame.push(PROTOCOL_ETX);

        if (this.bus) {
            this.bus.broadcast(new Uint8Array(rawFrame), this);
        }
    }

    calculateCRC(data) {
        let crc = 0;
        for (let b of data) crc ^= b;
        return crc;
    }
}
