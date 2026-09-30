export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.value = value;
  }

  tone(freq = 200, duration = 0.09, type = 'square', volume = 0.2) {
    this.ensure();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration);
  }
}
