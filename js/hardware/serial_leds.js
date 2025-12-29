import { LEDInterface } from './led_interface.js';

/**
 * WebSerial Communication Driver for RS485 LED Hubs.
 * 
 * Protocol Design (Draft):
 * [0xAA, HUB_ID, R, G, B, 0x55]
 * or more complex for addressing individual pixels.
 * 
 * Current Implementation: Sends one color per Hub (Hub-based lighting).
 */

const BAUD_RATE = 115200;
const START_BYTE = 0xAA;
const END_BYTE = 0x55;

export class SerialLEDs extends LEDInterface {
    constructor() {
        super();
        this.port = null;
        this.writer = null;
        this.encoder = new TextEncoder();
        this.isWriting = false;
    }

    async connect() {
        if (!navigator.serial) {
            alert("WebSerial not supported in this browser. Use Chrome or Edge.");
            return false;
        }

        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: BAUD_RATE });

            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
            this.writer = textEncoder.writable.getWriter();

            // Binary writer is better for protocol
            // this.writer = this.port.writable.getWriter();

            this.isConnected = true;
            console.log("Serial Port Connected");
            return true;
        } catch (err) {
            console.error("Error connecting to serial port:", err);
            return false;
        }
    }

    async disconnect() {
        if (this.port) {
            if (this.writer) {
                await this.writer.close();
            }
            await this.port.close();
            this.port = null;
            this.isConnected = false;
        }
    }

    update(nodes) {
        if (!this.isConnected || !this.port || !this.port.writable) return;
        if (this.isWriting) return; // Prevent buffer buildup

        this.sendFrame(nodes);
    }

    async sendFrame(nodes) {
        this.isWriting = true;
        const writer = this.port.writable.getWriter();

        try {
            // Construct a binary buffer for all nodes
            // Example Protocol: [START, ID, R, G, B, ... , END] 
            // This simple approach keeps packets small.
            // For a 5m dome with ~100 hubs, we might need a more efficient stream.
            // Here we assume we send a packet per hub or a stream of all hubs.

            // Stream approach: [START_FRAME, R1, G1, B1, R2, G2, B2, ..., END_FRAME]
            // Size: 1 + (Nodes * 3) + 1

            const bufferSize = 1 + (nodes.length * 3) + 1;
            const data = new Uint8Array(bufferSize);

            data[0] = START_BYTE;

            let ptr = 1;
            for (const node of nodes) {
                // Calculate RGB based on node state
                // This mapping logic should ideally be shared or passed in, 
                // but for now we derive it from the game state properties.

                let r = 0, g = 0, b = 0;

                // Priority: Process colors based on game logic
                if (node.pulseIntensity > 0) {
                    // White/Cyan pulse
                    const val = Math.min(255, Math.floor(node.pulseIntensity * 255));
                    r = val; g = val; b = val;
                } else if (node.capturedBy === 1) { // Red Team
                    r = 255;
                } else if (node.capturedBy === 2) { // Blue Team
                    b = 255;
                } else if (node.owner === 1) {
                    r = 255;
                } else if (node.owner === 2) {
                    b = 255;
                }

                // Clamp
                data[ptr++] = r;
                data[ptr++] = g;
                data[ptr++] = b;
            }

            data[ptr] = END_BYTE;

            await writer.write(data);

        } catch (err) {
            console.error("Serial Write Error:", err);
        } finally {
            writer.releaseLock();
            this.isWriting = false;
        }
    }
}
