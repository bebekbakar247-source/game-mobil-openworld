import type { CarTelemetry } from '../vehicle/CarController';

export class EngineAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private oscHarm: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;

  private muted = false;
  private paused = false;
  private disposed = false;

  private readonly onFirstGesture = (): void => {
    this.ensureContext();
  };

  private readonly onWindowBlur = (): void => {
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }
  };

  constructor() {
    window.addEventListener('keydown', this.onFirstGesture, { passive: true });
    window.addEventListener('pointerdown', this.onFirstGesture, { passive: true });
    window.addEventListener('blur', this.onWindowBlur);
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.syncMasterGain();
    return this.muted;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.syncMasterGain();
  }

  public update(telemetry: CarTelemetry, throttle: number): void {
    if (!this.ctx || !this.oscSub || !this.oscHarm || !this.engineFilter || !this.engineGain || !this.screechGain || !this.screechFilter) {
      return;
    }

    if (this.ctx.state === 'suspended' && !this.muted && !this.paused) {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const rpm = Math.max(0.12, Math.min(1, telemetry.rpm));

    // Subtle dual-oscillator engine hum tied to RPM & throttle load
    const baseFreq = 44 + rpm * 108;
    this.oscSub.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.oscHarm.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.04);

    const filterCutoff = 165 + rpm * 620 + throttle * 175;
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);

    const loadGain = 0.14 + rpm * 0.16 + throttle * 0.08;
    this.engineGain.gain.setTargetAtTime(loadGain, now, 0.05);

    // Soft tire screech when drifting on ground
    const targetScreech =
      telemetry.isDrifting && !telemetry.isAirborne
        ? Math.min(0.13, 0.04 + (telemetry.speedKmh / 140) * 0.09)
        : 0;
    this.screechGain.gain.setTargetAtTime(targetScreech, now, 0.04);
    this.screechFilter.frequency.setTargetAtTime(
      1050 + Math.min(450, telemetry.speedKmh * 3.2),
      now,
      0.06
    );
  }

  public dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this.onFirstGesture);
    window.removeEventListener('pointerdown', this.onFirstGesture);
    window.removeEventListener('blur', this.onWindowBlur);

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  private ensureContext(): void {
    if (this.disposed || this.ctx) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted || this.paused ? 0 : 0.28;
    master.connect(ctx.destination);
    this.masterGain = master;

    // 1. Engine Hum Graph
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 180;
    engineFilter.Q.value = 1.6;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.14;

    const oscSub = ctx.createOscillator();
    oscSub.type = 'triangle';
    oscSub.frequency.value = 48;

    const oscHarm = ctx.createOscillator();
    oscHarm.type = 'sawtooth';
    oscHarm.frequency.value = 96;
    oscHarm.detune.value = 5;

    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.25;

    oscSub.connect(engineFilter);
    oscHarm.connect(harmGain);
    harmGain.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    oscSub.start();
    oscHarm.start();

    this.oscSub = oscSub;
    this.oscHarm = oscHarm;
    this.engineFilter = engineFilter;
    this.engineGain = engineGain;

    // 2. Drift Tire Screech Graph (looping white noise -> bandpass -> lowpass)
    const bufferSize = Math.floor(ctx.sampleRate * 1.5);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    const screechFilter = ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 1150;
    screechFilter.Q.value = 4.2;

    const screechPost = ctx.createBiquadFilter();
    screechPost.type = 'lowpass';
    screechPost.frequency.value = 2400;

    const screechGain = ctx.createGain();
    screechGain.gain.value = 0;

    noiseSrc.connect(screechFilter);
    screechFilter.connect(screechPost);
    screechPost.connect(screechGain);
    screechGain.connect(master);
    noiseSrc.start();

    this.screechFilter = screechFilter;
    this.screechGain = screechGain;

    window.removeEventListener('keydown', this.onFirstGesture);
    window.removeEventListener('pointerdown', this.onFirstGesture);
  }

  private syncMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended' && !this.muted && !this.paused) {
      void this.ctx.resume();
    }
    const target = this.muted || this.paused ? 0 : 0.28;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }
}
