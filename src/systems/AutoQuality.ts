// Phase 4 — Auto quality scaler: keeps the game at 60fps on mid phones
// without the player ever touching a setting. It watches real frame time
// over a rolling 2s window (gameplay only) and steps the renderer's quality
// down when the average stays below ~45fps, back up when headroom returns.
// The manual quality button always wins: once the player toggles it, the
// scaler stands down for the rest of the session and never overrides them.
// Pure logic + one callback — it never touches the scene or the game loop
// beyond the single tick() call Game.loop() makes once per frame.

export type QualityLevel = 0 | 1 | 2; // 0 = high, 1 = medium, 2 = low

export interface QualitySettings {
  shadows: boolean;
  pixelRatioCap: number; // upper bound for renderer.setPixelRatio
}

export const QUALITY_SETTINGS: readonly QualitySettings[] = [
  { shadows: true, pixelRatioCap: 2 }, // high: PCFSoft shadows, full DPR
  { shadows: false, pixelRatioCap: 1.5 }, // medium: shadows off, near-full DPR
  { shadows: false, pixelRatioCap: 1 } // low: shadows off, DPR 1
] as const;

/** Step down after this long below the floor; step up after this long above the ceiling. */
const DOWN_FPS = 45;
const UP_FPS = 57;
const DOWN_SUSTAIN_S = 3;
const UP_SUSTAIN_S = 5;
const WINDOW_S = 2; // rolling frame-time window
const EVAL_EVERY_S = 0.5; // how often the window average is judged

export class AutoQualityScaler {
  private level: QualityLevel = 0;
  private manualOverride = false;
  private readonly onChange: (level: QualityLevel) => void;

  // Rolling window: frame dts whose total spans WINDOW_S.
  private samples: number[] = [];
  private samplesTotalS = 0;
  private evalTimer = 0;
  private lowStreakS = 0;
  private highStreakS = 0;

  constructor(onChange: (level: QualityLevel) => void) {
    this.onChange = onChange;
  }

  public get currentLevel(): QualityLevel {
    return this.level;
  }

  /** True once the player has picked a quality by hand (auto stays off). */
  public get isManual(): boolean {
    return this.manualOverride;
  }

  /**
   * Manual quality pick (the ⚡/🔋 button). Applies immediately and disables
   * auto-scaling for the session — a manual choice always wins over auto.
   */
  public setManual(level: QualityLevel): void {
    this.manualOverride = true;
    this.setLevel(level);
  }

  /** Re-enable auto-scaling (unused by the UI today; kept for completeness). */
  public setAuto(): void {
    this.manualOverride = false;
    this.lowStreakS = 0;
    this.highStreakS = 0;
  }

  /**
   * Call once per frame with the real frame delta. `active` should be true
   * only during gameplay — menu frames are cheap and would otherwise trick
   * the scaler into stepping up, then dropping mid-fight.
   */
  public tick(dt: number, active: boolean): void {
    if (this.manualOverride || !active) {
      // Not sampling: drop the window so a stale dip can't fire later.
      if (!active) this.clearWindow();
      return;
    }
    if (!(dt > 0)) return;
    // Clamp absurd spikes (tab-switch / hitch) so one frozen frame can't
    // drag the average down by itself.
    const clamped = Math.min(dt, 0.25);
    this.samples.push(clamped);
    this.samplesTotalS += clamped;
    while (this.samplesTotalS > WINDOW_S && this.samples.length > 1) {
      const oldest = this.samples.shift();
      if (oldest !== undefined) this.samplesTotalS -= oldest;
    }

    this.evalTimer += clamped;
    if (this.evalTimer < EVAL_EVERY_S) return;
    this.evalTimer = 0;

    const count = this.samples.length;
    if (count < 10) return; // need a real window before judging
    const avgFps = count / this.samplesTotalS;

    if (avgFps < DOWN_FPS) {
      this.lowStreakS += EVAL_EVERY_S;
      this.highStreakS = 0;
      if (this.lowStreakS >= DOWN_SUSTAIN_S && this.level < 2) {
        this.setLevel((this.level + 1) as QualityLevel);
        this.lowStreakS = 0;
      }
    } else if (avgFps > UP_FPS) {
      this.highStreakS += EVAL_EVERY_S;
      this.lowStreakS = 0;
      if (this.highStreakS >= UP_SUSTAIN_S && this.level > 0) {
        this.setLevel((this.level - 1) as QualityLevel);
        this.highStreakS = 0;
      }
    } else {
      // Between the thresholds: hold, don't oscillate.
      this.lowStreakS = 0;
      this.highStreakS = 0;
    }
  }

  private setLevel(level: QualityLevel): void {
    if (level === this.level) return;
    this.level = level;
    this.onChange(level);
  }

  private clearWindow(): void {
    this.samples = [];
    this.samplesTotalS = 0;
    this.evalTimer = 0;
    this.lowStreakS = 0;
    this.highStreakS = 0;
  }
}
