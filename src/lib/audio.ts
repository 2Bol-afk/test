// Retro 8-bit sound generator using Web Audio API

class SoundEngine {
  private ctx: AudioContext | null = null;
  private primaryGain: GainNode | null = null;
  private bgOscillator: OscillatorNode | null = null;
  private bgGain: GainNode | null = null;
  private bgInterval: number | null = null;
  private muted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.primaryGain = this.ctx.createGain();
        this.primaryGain.gain.setValueAtTime(0.15, this.ctx.currentTime); // keep it elegant and pleasant
        this.primaryGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(isMuted: boolean) {
    this.muted = isMuted;
    if (this.primaryGain && this.ctx) {
      this.primaryGain.gain.setValueAtTime(isMuted ? 0 : 0.15, this.ctx.currentTime);
    }
  }

  isMuted() {
    return this.muted;
  }

  playJump() {
    this.initCtx();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle'; // Pure retro 8-bit jump sound
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15); // ascending slide

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15); // short decay

    osc.connect(gain);
    gain.connect(this.primaryGain || this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playCrouch() {
    this.initCtx();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square'; // Buzzier crouch/slide slide-down
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.15); // descending slide

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.primaryGain || this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playCoin() {
    this.initCtx();
    if (!this.ctx || this.muted) return;

    // Classic Mario/NES double-tone coin sound (C5 then E5)
    const now = this.ctx.currentTime;
    
    // First tone (C5)
    const osc1 = this.ctx.createOscillator();
    const oscGain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(987.77, now); // B5
    oscGain1.gain.setValueAtTime(0.15, now);
    oscGain1.gain.setValueAtTime(0.15, now + 0.08);
    oscGain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc1.connect(oscGain1);
    oscGain1.connect(this.primaryGain || this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second tone (E5) after a delay
    const osc2 = this.ctx.createOscillator();
    const oscGain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
    oscGain2.gain.setValueAtTime(0, now);
    oscGain2.gain.setValueAtTime(0.2, now + 0.08);
    oscGain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(oscGain2);
    oscGain2.connect(this.primaryGain || this.ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  }

  playGameOver() {
    this.initCtx();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.1);
    osc.frequency.linearRampToValueAtTime(55, now + 0.3);

    // Low rumble vibration
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.primaryGain || this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  startThemeSong() {
    this.initCtx();
    if (!this.ctx || this.muted || this.bgInterval) return;

    // A simple, ultra-low passive retro baseline note sequence loop
    // Notes: C3, G3, A3, F3
    const notes = [130.81, 196.00, 220.00, 174.61]; // frequencies of C3, G3, A3, F3
    let index = 0;

    const playBasslineNode = () => {
      if (!this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[index], now);
      
      gain.gain.setValueAtTime(0.03, now); // extremely subtle baseline
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(gain);
      gain.connect(this.primaryGain || this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.75);

      index = (index + 1) % notes.length;
    };

    playBasslineNode();
    this.bgInterval = window.setInterval(playBasslineNode, 800);
  }

  stopThemeSong() {
    if (this.bgInterval) {
      clearInterval(this.bgInterval);
      this.bgInterval = null;
    }
  }
}

export const AudioEngineInstance = new SoundEngine();
