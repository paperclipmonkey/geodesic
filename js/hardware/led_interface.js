/**
 * Abstract Base Class for LED Hardware Interfaces
 */
export class LEDInterface {
    constructor() {
        this.isConnected = false;
    }

    async connect() {
        console.warn('connect() not implemented');
        return false;
    }

    disconnect() {
        this.isConnected = false;
    }

    /**
     * Send the current state of the dome nodes to the hardware
     * @param {Array} nodes - The array of Node objects from the Dome class
     */
    update(nodes) {
        // Override in subclass
    }
}
