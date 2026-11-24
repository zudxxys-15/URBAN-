/**
 * AudioSystem — Procedural Web Audio API sound engine for URBAN MOTOR LIFE.
 *
 * All sounds are generated via oscillators and noise buffers; no external
 * audio files are required.  The AudioContext is created lazily on the first
 * user gesture to satisfy browser autoplay policies.
 */

const MAX_SIMULTANEOUS_SOUNDS = 8;

export class AudioSystem {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {GainNode|null} */
    this.masterGain = null;

    // Volume / mute state (applied once ctx exists)
    this._volume = 0.5;
    this._muted = false;

    // Persistent engine oscillators
    this._engineOsc1 = null;
    this._engineOsc2 = null;
    this._engineGain = null;
    this._engineRunning = false;

    // Ambient nodes
    this._ambientSource = null;
    this._ambientGain = null;

    // Track active one-shot sounds for the simultaneous-sound cap
    this._activeSounds = 0;

    this._initialized = false;
  }

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Resume (or create) the AudioContext.  Call on the first user
   * click / keypress to unlock audio on browsers that block autoplay.
   */
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this._initialized = true;
  }

  /** Shorthand: is the context ready to produce sound? */
  _ready() {
    return this._initialized && this.ctx && this.ctx.state === 'running';
  }

  /* ------------------------------------------------------------------ */
  /*  Engine Sound (persistent oscillator pair)                          */
  /* ------------------------------------------------------------------ */

  /**
   * Update the continuous engine drone.
   *
   * @param {number} speed    Current vehicle speed (units/sec).
   * @param {number} maxSpeed Maximum vehicle speed.
   * @param {number} rpm      Engine RPM (0 – max).
   */
  updateEngineSound(speed, maxSpeed, rpm) {
    if (!this._ready()) return;

    // --- Lazy-create persistent oscillators on first call ---
    if (!this._engineRunning) {
      this._engineGain = this.ctx.createGain();
      this._engineGain.gain.value = 0;
      this._engineGain.connect(this.masterGain);

      // Primary oscillator — sawtooth for gritty engine character
      this._engineOsc1 = this.ctx.createOscillator();
      this._engineOsc1.type = 'sawtooth';
      this._engineOsc1.frequency.value = 50;
      this._engineOsc1.connect(this._engineGain);
      this._engineOsc1.start();

      // Secondary harmonic at 2× frequency for richness
      this._engineOsc2 = this.ctx.createOscillator();
      this._engineOsc2.type = 'triangle';
      this._engineOsc2.frequency.value = 100;

      const harmGain = this.ctx.createGain();
      harmGain.gain.value = 0.3;          // quieter than fundamental
      this._engineOsc2.connect(harmGain);
      harmGain.connect(this._engineGain);
      this._engineOsc2.start();

      this._engineHarmGain = harmGain;
      this._engineRunning = true;
    }

    // Map RPM to frequency: 50 Hz (idle) → 180 Hz (redline)
    const rpmNorm = Math.min(Math.max(rpm / 7000, 0), 1); // assume 7000 max RPM
    const freq = 50 + rpmNorm * 130;
    const now = this.ctx.currentTime;

    this._engineOsc1.frequency.setTargetAtTime(freq, now, 0.06);
    this._engineOsc2.frequency.setTargetAtTime(freq * 2, now, 0.06);

    // Gain: base idle volume + speed contribution
    const speedNorm = Math.min(Math.max(speed / (maxSpeed || 1), 0), 1);
    const gain = 0.08 + speedNorm * 0.22; // 0.08 at idle → 0.30 at max
    this._engineGain.gain.setTargetAtTime(gain, now, 0.1);
  }

  /** Stop the engine drone immediately. */
  _stopEngine() {
    if (this._engineOsc1) { try { this._engineOsc1.stop(); } catch (_) { /* already stopped */ } this._engineOsc1 = null; }
    if (this._engineOsc2) { try { this._engineOsc2.stop(); } catch (_) { /* already stopped */ } this._engineOsc2 = null; }
    if (this._engineGain) { this._engineGain.disconnect(); this._engineGain = null; }
    if (this._engineHarmGain) { this._engineHarmGain.disconnect(); this._engineHarmGain = null; }
    this._engineRunning = false;
  }

  /* ------------------------------------------------------------------ */
  /*  One-shot sound helpers                                             */
  /* ------------------------------------------------------------------ */

  /** Guard: returns false when no more sounds should be spawned. */
  _canPlay() {
    return this._ready() && this._activeSounds < MAX_SIMULTANEOUS_SOUNDS;
  }

  /** Register a one-shot sound and auto-decrement when it finishes. */
  _trackOscillator(osc) {
    this._activeSounds++;
    osc.onended = () => { this._activeSounds = Math.max(0, this._activeSounds - 1); };
  }

  /* ------------------------------------------------------------------ */
  /*  Sound Effects                                                      */
  /* ------------------------------------------------------------------ */

  /** Short horn blast — square wave, 400 Hz, 0.3 s. */
  playHonk() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
    this._trackOscillator(osc);
  }

  /**
   * Brake squeal — bandpass-filtered white noise.
   * @param {number} intensity 0–1
   */
  playBrakeSqueal(intensity = 0.5) {
    if (!this._canPlay()) return;
    const dur = 0.3 + intensity * 0.3;
    const now = this.ctx.currentTime;

    const buf = this._noiseBuffer(dur);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000;
    bp.Q.value = 8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25 * Math.min(Math.max(intensity, 0), 1), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + dur);
    this._trackOscillator(src); // BufferSource also fires onended
  }

  /** Impact burst — noise with quick 0.15 s decay. */
  playCollision() {
    if (!this._canPlay()) return;
    const dur = 0.15;
    const now = this.ctx.currentTime;

    const buf = this._noiseBuffer(dur);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + dur);
    this._trackOscillator(src);
  }

  /** Tiny UI tick — sine 800 Hz, 0.05 s. */
  playUIClick() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
    this._trackOscillator(osc);
  }

  /** Refuel — ascending sine sweep 200 → 600 Hz over 0.5 s. */
  playRefuel() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
    this._trackOscillator(osc);
  }

  /* ------------------------------------------------------------------ */
  /*  Ambient city loop                                                  */
  /* ------------------------------------------------------------------ */

  /** Start a subtle filtered-noise city ambience (loops forever). */
  startAmbient() {
    if (!this._ready() || this._ambientSource) return;

    // Create a long noise buffer and loop it
    const buf = this._noiseBuffer(2); // 2-second loop
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    // Low-pass to make it a soft rumble
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lp.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.04; // very quiet

    src.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    this._ambientSource = src;
    this._ambientGain = gain;
    this._ambientFilter = lp;
  }

  /** Stop the ambient loop. */
  stopAmbient() {
    if (this._ambientSource) {
      try { this._ambientSource.stop(); } catch (_) { /* ok */ }
      this._ambientSource.disconnect();
      this._ambientSource = null;
    }
    if (this._ambientGain) { this._ambientGain.disconnect(); this._ambientGain = null; }
    if (this._ambientFilter) { this._ambientFilter.disconnect(); this._ambientFilter = null; }
  }

  /* ------------------------------------------------------------------ */
  /*  Volume / Mute controls                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Set master volume.
   * @param {number} value 0.0 – 1.0
   */
  setVolume(value) {
    this._volume = Math.min(Math.max(value, 0), 1);
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.05);
    }
  }

  /** @returns {number} current volume (0–1) */
  getVolume() {
    return this._volume;
  }

  /** Mute or unmute all audio. */
  setMuted(bool) {
    this._muted = !!bool;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this._muted ? 0 : this._volume,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  /** @returns {boolean} */
  isMuted() {
    return this._muted;
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  /** Close the AudioContext and release all nodes. */
  dispose() {
    this._stopEngine();
    this.stopAmbient();

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterGain = null;
    this._initialized = false;
    this._activeSounds = 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Create a white-noise AudioBuffer of the given duration.
   * Buffers are cheap and short-lived, so we don't cache them.
   * @param {number} seconds
   * @returns {AudioBuffer}
   */
  _noiseBuffer(seconds) {
    const length = Math.ceil(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }
}
