import { WeaponId } from './types';

class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private windNode: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainNode: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private musicInterval: number | null = null;
  private isMenuMusicPlaying = false;

  private volumes = {
    master: 0.75,
    sfx: 0.85,
    ambient: 0.55,
    music: 0.45,
  };

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.ambientGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.masterGain.gain.value = this.volumes.master;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.ambientGain.gain.value = this.volumes.ambient;
    this.musicGain.gain.value = this.volumes.music;

    this.sfxGain.connect(this.masterGain);
    this.ambientGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // 2-second white/pink noise buffer
    const sampleRate = this.ctx.sampleRate;
    const len = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }

    this.setupAmbience();
  }

  public setVolumes(master: number, sfx: number, ambient: number, music: number): void {
    this.volumes = { master, sfx, ambient, music };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.masterGain?.gain.setTargetAtTime(master, now, 0.05);
    this.sfxGain?.gain.setTargetAtTime(sfx, now, 0.05);
    this.ambientGain?.gain.setTargetAtTime(ambient, now, 0.05);
    this.musicGain?.gain.setTargetAtTime(music, now, 0.05);
  }

  private setupAmbience(): void {
    if (!this.ctx || !this.noiseBuffer || !this.ambientGain) return;

    // Continuous subtle wind
    this.windNode = this.ctx.createBufferSource();
    this.windNode.buffer = this.noiseBuffer;
    this.windNode.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 340;
    this.windFilter.Q.value = 1.6;

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.14;

    this.windNode.connect(this.windFilter);
    this.windFilter.connect(windGain);
    windGain.connect(this.ambientGain);
    this.windNode.start();

    // Continuous rain loop (muted unless rain weather active)
    this.rainNode = this.ctx.createBufferSource();
    this.rainNode.buffer = this.noiseBuffer;
    this.rainNode.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 1100;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;

    this.rainNode.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.ambientGain);
    this.rainNode.start();
  }

  public updateAmbience(isRain: boolean, skydivingSpeed: number): void {
    if (!this.ctx || !this.windFilter || !this.rainGain) return;
    const now = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(isRain ? 0.35 : 0, now, 0.4);
    const windFreq = 320 + Math.min(1800, skydivingSpeed * 18);
    this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.1);
  }

  public startMenuMusic(): void {
    this.init();
    if (this.isMenuMusicPlaying || !this.ctx || !this.musicGain) return;
    this.isMenuMusicPlaying = true;

    const notes = [110, 130.81, 146.83, 164.81, 130.81, 110, 98, 110];
    let step = 0;

    const playNote = () => {
      if (!this.ctx || !this.musicGain || !this.isMenuMusicPlaying) return;
      const now = this.ctx.currentTime;
      const freq = notes[step % notes.length];
      step++;

      // Deep cinematic pad pulse
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq * 0.5, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 1.4);

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.18, now + 0.12);
      env.gain.exponentialRampToValueAtTime(0.001, now + 1.55);

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(env);
      env.connect(this.musicGain);

      osc.start(now);
      sub.start(now);
      osc.stop(now + 1.6);
      sub.stop(now + 1.6);
    };

    playNote();
    this.musicInterval = window.setInterval(playNote, 1500);
  }

  public stopMenuMusic(): void {
    this.isMenuMusicPlaying = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  public playGunshot(weaponId: WeaponId, distanceAttenuation = 1.0): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    if (distanceAttenuation <= 0.03) return;
    const now = this.ctx.currentTime;

    const profile: Record<WeaponId, { punch: number; freq: number; decay: number; crack: number }> = {
      akm: { punch: 0.72, freq: 155, decay: 0.24, crack: 1650 },
      m416: { punch: 0.56, freq: 210, decay: 0.17, crack: 2200 },
      scarl: { punch: 0.6, freq: 195, decay: 0.19, crack: 2050 },
      awm: { punch: 1.0, freq: 95, decay: 0.52, crack: 2600 },
      kar98k: { punch: 0.92, freq: 112, decay: 0.44, crack: 2400 },
      uzi: { punch: 0.36, freq: 290, decay: 0.09, crack: 2900 },
      ump45: { punch: 0.46, freq: 235, decay: 0.14, crack: 2100 },
      shotgun: { punch: 0.95, freq: 105, decay: 0.36, crack: 1450 },
      pistol: { punch: 0.44, freq: 260, decay: 0.13, crack: 2500 },
      grenade: { punch: 0.25, freq: 180, decay: 0.12, crack: 900 },
    };
    const p = profile[weaponId];
    const vol = p.punch * distanceAttenuation;

    // Noise blast
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(p.crack, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + p.decay);
    filter.Q.value = 0.75;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(vol * 1.15, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + p.decay);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + p.decay + 0.04);

    // Low-end thump transient
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(p.freq, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + p.decay * 0.65);

    const oGain = this.ctx.createGain();
    oGain.gain.setValueAtTime(vol * 0.85, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + p.decay * 0.7);

    osc.connect(oGain);
    oGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + p.decay * 0.75);
  }

  public playReload(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const clicks = [0, 0.45, 1.05];
    clicks.forEach((offset, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 2 ? 780 : 520, now + offset);
      osc.frequency.exponentialRampToValueAtTime(190, now + offset + 0.06);
      gain.gain.setValueAtTime(0.14, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }

  public playFootstep(sprinting: boolean, indoors: boolean): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = indoors ? 680 : 420;

    const gain = this.ctx.createGain();
    const peak = sprinting ? 0.18 : 0.11;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now, Math.random() * 0.5, 0.1);
  }

  public playHitMarker(headshot: boolean): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(headshot ? 1650 : 1050, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 900 : 480, now + 0.07);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playImpact(metalSurface: boolean): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = metalSurface ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(metalSurface ? 1400 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(metalSurface ? 600 : 75, now + 0.09);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playExplosion(distanceAttenuation = 1.0): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const vol = Math.max(0.1, distanceAttenuation);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(85, now + 1.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.1 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 1.35);

    const boom = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(110, now);
    boom.frequency.exponentialRampToValueAtTime(24, now + 0.85);
    bGain.gain.setValueAtTime(0.95 * vol, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    boom.connect(bGain);
    bGain.connect(this.sfxGain);
    boom.start(now);
    boom.stop(now + 0.95);
  }

  public playPickup(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.08);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public updateVehicleEngine(active: boolean, speedRatio: number, isMotorcycle: boolean): void {
    if (!this.ctx || !this.sfxGain) return;

    if (!active) {
      if (this.engineGain) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      return;
    }

    if (!this.engineOsc || !this.engineSubOsc || !this.engineGain) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineSubOsc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineSubOsc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      this.engineGain.gain.value = 0;

      this.engineOsc.connect(filter);
      this.engineSubOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc.start();
      this.engineSubOsc.start();
    }

    const now = this.ctx.currentTime;
    const baseFreq = isMotorcycle ? 72 : 44;
    const targetFreq = baseFreq + Math.abs(speedRatio) * (isMotorcycle ? 135 : 88);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.12 + Math.abs(speedRatio) * 0.1, now, 0.08);
  }
}

export const soundEngine = new TacticalAudioEngine();
