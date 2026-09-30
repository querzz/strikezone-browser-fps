export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.muted = false;
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
    this.applyGain();
  }

  setMuted(muted) {
    this.muted = muted;
    this.applyGain();
  }

  applyGain() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : this.volume;
  }

  tone(freq = 200, duration = 0.09, type = 'square', volume = 0.2, glideTo = null) {
    this.ensure();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + duration);
    osc.type = type;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration);
  }

  noise(duration = 0.06, volume = 0.08, lowpass = 1400) {
    this.ensure();
    const sampleRate = this.ctx.sampleRate;
    const size = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, size, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2) - 1;

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;

    source.buffer = buffer;
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  fire(weaponId, ads = false) {
    if (weaponId === 'rifle') {
      this.tone(ads ? 210 : 180, 0.055, 'sawtooth', 0.15, 90);
      this.noise(0.03, 0.07, 1900);
    } else {
      this.tone(250, 0.07, 'square', 0.13, 140);
      this.noise(0.02, 0.045, 2200);
    }
  }

  reloadStart() {
    this.tone(170, 0.04, 'triangle', 0.08, 220);
  }

  reloadEnd() {
    this.tone(320, 0.05, 'triangle', 0.08, 210);
  }

  footstep(sprint = false) {
    this.tone(sprint ? 92 : 74, 0.03, 'square', sprint ? 0.07 : 0.05);
    this.noise(0.015, 0.03, 700);
  }

  hit(isHeadshot = false) {
    this.tone(isHeadshot ? 620 : 420, 0.045, 'triangle', 0.12, isHeadshot ? 500 : 350);
  }

  impact() {
    this.noise(0.035, 0.06, 1200);
  }

  roundEvent(win = true) {
    if (win) {
      this.tone(220, 0.08, 'sawtooth', 0.13, 320);
      this.tone(340, 0.1, 'triangle', 0.1, 440);
    } else {
      this.tone(170, 0.1, 'sawtooth', 0.13, 110);
    }
  }
}
