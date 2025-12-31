export class SoundManager {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Master volume
        this.masterGain.connect(this.ctx.destination);

        this.enabled = true;
        this.initialized = false;

        // Reverb Bus
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.4;
        this.reverbGain.connect(this.masterGain);

        this.setupReverb();
    }

    // Must be called after user interaction to unlock AudioContext
    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                console.log("AudioContext resumed");
                this.initialized = true;
            });
        }
    }

    setupReverb() {
        // Procedural Impulse Response for "Ethereal" sound
        const duration = 2.5;
        const decay = 2.0;
        const rate = this.ctx.sampleRate;
        const length = rate * duration;
        const impulse = this.ctx.createBuffer(2, length, rate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            // Exponential decay noise
            const n = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            left[i] = n;
            right[i] = n;
        }

        this.reverbNode = this.ctx.createConvolver();
        this.reverbNode.buffer = impulse;
        this.reverbNode.connect(this.reverbGain);
    }

    playTone(freq, type = 'sine', duration = 0.3, vol = 0.5, time = 0) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime + time;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);

        // Envelope
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.reverbNode); // Send to reverb

        osc.start(t);
        osc.stop(t + duration + 0.1);
    }

    // --- High Level SFX ---

    // UI / Interaction
    playSound(name) {
        if (!this.enabled) return;
        switch (name) {
            case 'click':
                this.playTone(800, 'sine', 0.1, 0.2);
                break;
            case 'start':
                this.playChord([440, 554, 659], 'sine', 1.0); // A Major
                break;
            case 'success':
                this.playChord([523, 659, 783, 1046], 'triangle', 0.6); // C Major
                break;
            case 'fail':
                this.playTone(150, 'sawtooth', 0.5, 0.4);
                this.playTone(100, 'sawtooth', 0.5, 0.4, 0.1);
                break;
            case 'ping':
                this.playTone(1200, 'sine', 0.3, 0.3);
                break;
            case 'tick':
                this.playTone(2000, 'square', 0.05, 0.05);
                break;
        }
    }

    playChord(freqs, type = 'sine', duration = 1.0) {
        freqs.forEach((f, i) => {
            // Arpeggiate slightly
            this.playTone(f, type, duration, 0.3, i * 0.05);
        });
    }

    // Specific Game Sounds

    // Chain Game
    playChainNode(index) {
        // Pentatonic scale based on index
        const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // C Major Pentatonic
        const freq = scale[index % scale.length] * (1 + Math.floor(index / scale.length));
        this.playTone(freq, 'sine', 0.5, 0.4);
    }

    playChainTargetSpawn() {
        this.playTone(880, 'sine', 0.2, 0.1);
        this.playTone(1760, 'sine', 0.2, 0.1, 0.1);
    }

    // Resonance
    playRipple(strength) {
        // Water drop effect
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(400 + strength * 200, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.reverbNode);

        osc.start(t);
        osc.stop(t + 0.3);
    }
}
