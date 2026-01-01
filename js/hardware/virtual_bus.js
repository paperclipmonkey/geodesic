/**
 * Virtual RS485 Bus
 * Simulates a half-duplex serial bus.
 */
export class VirtualBus {
    constructor() {
        this.nodes = [];
        this.master = null;
        this.isBusy = false;

        // Debug
        this.logTraffic = false;
    }

    /**
     * Connect a node to the bus
     * @param {Object} node - Must implement receive(data)
     */
    registerNode(node) {
        this.nodes.push(node);
    }

    setMaster(master) {
        this.master = master;
    }

    /**
     * Broadcast data to all listeners (except sender)
     * @param {Uint8Array} data 
     * @param {Object} sender 
     */
    broadcast(data, sender) {
        if (this.logTraffic) {
            const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`[BUS] ${sender === this.master ? 'MASTER' : 'NODE'} -> ALL: [${hex}]`);
        }

        // Simulate transmission time? (Optional, for now instant)

        if (sender === this.master) {
            // Master -> Nodes
            this.nodes.forEach(node => {
                if (node.receive) node.receive(data);
            });
        } else {
            // Node -> Master
            // In RS485, everyone hears everything, but usually Master is the only one caring about Node replies
            if (this.master && this.master.receive) {
                this.master.receive(data);
            }
        }
    }
}
