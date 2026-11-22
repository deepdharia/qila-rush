export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMutedFlag: boolean = false;
  private bgmInterval: number | null = null;
  private bgmTempo: number = 135; // BPM
  private isBossEncounter: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // AudioContext will be initialized upon user gesture
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.noiseBuffer && this.ctx) {
      // 1s of white noise, built once and reused by every boom/rumble.
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (!this.bgmInterval) {
      this.startBattleRhythm();
    }
  }

  /** True while the user has muted audio — haptics respect this too. */
  public isMuted(): boolean {
    return this.isMutedFlag;
  }

  public toggleMute(): boolean {
    this.isMutedFlag = !this.isMutedFlag;
    if (this.isMutedFlag && this.ctx) {
      // suspend or mute
    } else if (!this.isMutedFlag && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return !this.isMutedFlag;
  }

  public setBossMode(active: boolean) {
    this.isBossEncounter = active;
    this.bgmTempo = active ? 165 : 135;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.startBattleRhythm();
    }
  }

  /**
   * Procedural Indian War Drums (Dhol & Nagada battle loop)
   */
  private startBattleRhythm() {
    let beat = 0;
    const intervalMs = (60 / this.bgmTempo) * 1000 / 2; // 8th notes

    this.bgmInterval = window.setInterval(() => {
      if (this.isMutedFlag || !this.ctx || this.ctx.state !== 'running') return;

      const step = beat % 8;
      // Dhol pattern: 0: Dha (Deep Bass + Rim), 2: Dhin (Deep Bass), 4: Dha, 5: Ta (Sharp rim), 6: Dhin
      if (step === 0 || step === 4) {
        this.playDholBass(0.35);
        this.playDholRim(0.2);
      } else if (step === 2 || step === 6) {
        this.playDholBass(0.25);
      } else if (step === 5 || (this.isBossEncounter && (step === 1 || step === 7))) {
        this.playNagadaRoll(0.18);
      }

      // Boss-fight layer: a low war-drone swell on every bar's downbeat,
      // on top of the faster 165 BPM tempo set by setBossMode.
      if (this.isBossEncounter && beat % 16 === 0) {
        this.playBossDrone();
      }

      beat++;
    }, intervalMs);
  }

  /** Low war-horn drone that marks each bar during the boss fight. */
  private playBossDrone() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.linearRampToValueAtTime(65, now + 0.4);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.9);
  }

  /** Filtered white-noise burst (boom / rumble). Buffer is built once in init(). */
  private playNoiseBurst(duration: number, filterFreq: number, volume: number) {
    if (this.isMutedFlag || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterFreq * 0.2), now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    src.start(now);
    src.stop(now + duration);
  }

  public playDholBass(volume: number = 0.4) {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Frequency drop for authentic dhol membrane thud
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playDholRim(volume: number = 0.25) {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playNagadaRoll(volume: number = 0.2) {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    // High pitched kettle drum strike
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Sound FX
   */
  public playArrowFire() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Bow release whoosh (filtered white noise + sine twang)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playArrowHit() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Crisp wood/flesh thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playGatePass(isPositive: boolean) {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (isPositive) {
      // Uplifting Indian Raag Bhoopali notes (Sa, Re, Ga, Pa, Dha: C5, D5, E5, G5, A5)
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0, now + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.25);
      });
    } else {
      // Low hazard thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.3);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  public playBarrierHit() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playBarrierBreak() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Heavy crash & rumble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playCannonFire() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Cannon explosion boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.7);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.7);

    // Noise crack + rumble tail on top of the sub drop.
    this.playNoiseBurst(0.5, 900, 0.5);
  }

  /** Deep ground thud + rumble when a cannonball lands. */
  public playCannonImpact() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.4);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);

    this.playNoiseBurst(0.35, 300, 0.35);
  }

  /**
   * Gate chime that grows with the multiplier: more notes and a higher
   * top note for x3 than for x2, so the big gate sounds bigger.
   */
  public playGateChime(multiplier: number = 2) {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Bhoopali ascent (Sa Re Ga Pa Dha Sa): x2 plays 4 notes, x3 plays 6.
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const noteCount = Math.min(scale.length, 2 + multiplier);
    for (let i = 0; i < noteCount; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(scale[i], now + i * 0.055);

      gain.gain.setValueAtTime(0.0001, now + i * 0.055);
      gain.gain.linearRampToValueAtTime(0.22, now + i * 0.055 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.35);
    }
  }

  /**
   * Combo blip whose pitch rises with the combo tier (x2 < x3 < x5),
   * so a climbing streak is audible as well as visible.
   */
  public playComboUp(tier: number) {
    if (this.isMutedFlag || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const base = 660 * (1 + 0.14 * (tier - 1));
    [base, base * 1.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.2, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.16);
    });
  }

  /** Bright shimmer for a near-miss graze bonus. */
  public playGraze() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playBossRoar() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.9);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.9);
  }

  public playBossSlam() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /** Kept for existing callers — plays the full win stinger. */
  public playVictory() {
    this.playWinStinger();
  }

  /** Distinct win stinger: rising royal fanfare + dhol hits + final chord. */
  public playWinStinger() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.25, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.6);
    });

    // Dhol accents under the fanfare + a resolving major chord.
    this.playDholBass(0.4);
    [523.25, 659.25, 783.99].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.6);
      gain.gain.setValueAtTime(0.18, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + 0.6);
      osc.stop(now + 1.4);
    });
  }

  /** Kept for existing callers — plays the full lose stinger. */
  public playDefeat() {
    this.playLoseStinger();
  }

  /** Distinct lose stinger: slow descending minor line over a low drone. */
  public playLoseStinger() {
    if (this.isMutedFlag || !this.ctx) return;
    const now = this.ctx.currentTime;

    const notes = [392, 369.99, 349.23, 311.13, 261.63];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.22);

      gain.gain.setValueAtTime(0.2, now + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.55);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.22);
      osc.stop(now + idx * 0.22 + 0.55);
    });

    // Low drone underneath.
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    drone.type = 'sine';
    drone.frequency.setValueAtTime(65, now);
    droneGain.gain.setValueAtTime(0.0001, now);
    droneGain.gain.linearRampToValueAtTime(0.16, now + 0.3);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    drone.connect(droneGain);
    droneGain.connect(this.ctx.destination);
    drone.start(now);
    drone.stop(now + 1.4);
  }

  public dispose() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }
}
