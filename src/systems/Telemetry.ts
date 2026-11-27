// Phase 0 (master plan) — local-only telemetry. No network, no PII, no
// identifiers of any kind. One localStorage key, a bounded ring buffer of
// raw events plus small aggregate counters. Its whole job is to answer,
// from real play instead of guesses: what is the win rate per level, how
// big is the army at the boss, how much boss HP is left on defeat, which
// draft picks get taken, and how long sessions/runs last. Phase 4 (fair
// difficulty) consumes these numbers; until then they are only recorded.
//
// Export: UIManager.buildDebugExport() serialises snapshot() together with
// the live perf snapshot from Game — the ?perf=1 overlay's COPY STATS
// button is the only way it leaves the device (clipboard, player-chosen).

export type TelemetryEventType =
  | 'session_start'
  | 'session_end'
  | 'attempt'
  | 'win'
  | 'defeat'
  | 'draft';

export interface TelemetryEvent {
  /** ISO timestamp. */
  t: string;
  type: TelemetryEventType;
  levelId?: number;
  isDaily?: boolean;
  isEndless?: boolean;
  /** Army size when the run started (after upgrades + boosters). */
  startArmy?: number;
  /** Warriors alive at victory (army at the boss / finish line). */
  saved?: number;
  kills?: number;
  stars?: number;
  /** Boss HP left when the run ended in defeat (null on boss-less levels). */
  bossHpRemaining?: number | null;
  bossHpMax?: number | null;
  /** % of the causeway covered when the run ended in defeat. */
  progressPct?: number;
  /** Endless waves cleared when a siege ended. */
  waves?: number;
  /** Draft bonus id that was picked. */
  bonusId?: string;
  /** Run length in seconds (win/defeat), or session length (session_end). */
  seconds?: number;
  /** Runs attempted in this session (session_end only). */
  runs?: number;
}

export interface LevelAggregate {
  attempts: number;
  wins: number;
}

export interface TelemetrySnapshot {
  version: 1;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
  /** Distinct play days so far. */
  daysPlayed: number;
  /** True once a session started on a later date than the first session. */
  returnedDay2: boolean;
  sessions: number;
  runs: number;
  wins: number;
  defeats: number;
  /** Per-level win-rate source: attempts/wins by level id. */
  perLevel: Record<string, LevelAggregate>;
  /** Draft picks taken, by bonus id. */
  draftPicks: Record<string, number>;
  /** Most recent events first, newest first, capped at MAX_EVENTS. */
  events: TelemetryEvent[];
}

interface StoredData {
  firstSessionDate: string | null;
  lastSessionDate: string | null;
  days: string[];
  sessions: number;
  runs: number;
  wins: number;
  defeats: number;
  perLevel: Record<string, LevelAggregate>;
  draftPicks: Record<string, number>;
  events: TelemetryEvent[];
}

const STORAGE_KEY = 'qila-rush:telemetry:v1';
const MAX_EVENTS = 300;

function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyData(): StoredData {
  return {
    firstSessionDate: null,
    lastSessionDate: null,
    days: [],
    sessions: 0,
    runs: 0,
    wins: 0,
    defeats: 0,
    perLevel: {},
    draftPicks: {},
    events: []
  };
}

export class Telemetry {
  private data: StoredData = emptyData();
  private sessionStartMs: number | null = null;
  private sessionRuns: number = 0;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredData>;
      if (parsed && typeof parsed === 'object') {
        this.data = { ...emptyData(), ...parsed };
        if (!Array.isArray(this.data.events)) this.data.events = [];
        if (!Array.isArray(this.data.days)) this.data.days = [];
      }
    } catch {
      // Corrupt or unavailable storage: telemetry stays in-memory only.
      this.data = emptyData();
    }
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Private mode / quota: keep going in-memory; never break the game.
    }
  }

  private pushEvent(ev: TelemetryEvent): void {
    this.data.events.unshift(ev);
    if (this.data.events.length > MAX_EVENTS) {
      this.data.events.length = MAX_EVENTS;
    }
  }

  private levelAgg(levelId: number): LevelAggregate {
    const key = String(levelId);
    const agg = this.data.perLevel[key] ?? { attempts: 0, wins: 0 };
    this.data.perLevel[key] = agg;
    return agg;
  }

  /** Call once when the game boots (one session = one page load). */
  public sessionStart(): void {
    const today = todayKey();
    if (!this.data.firstSessionDate) this.data.firstSessionDate = today;
    if (!this.data.days.includes(today)) this.data.days.push(today);
    this.data.lastSessionDate = today;
    this.data.sessions += 1;
    this.sessionStartMs = performance.now();
    this.sessionRuns = 0;
    this.pushEvent({ t: new Date().toISOString(), type: 'session_start' });
    this.save();
  }

  /** Resume the session clock after a background return (no new session). */
  public sessionResume(): void {
    if (this.sessionStartMs === null) this.sessionStartMs = performance.now();
  }

  /** Call on page hide / before unload. `runs` is this session's attempts. */
  public sessionEnd(): void {
    if (this.sessionStartMs === null) return;
    const seconds = Math.round((performance.now() - this.sessionStartMs) / 1000);
    this.pushEvent({
      t: new Date().toISOString(),
      type: 'session_end',
      seconds,
      runs: this.sessionRuns
    });
    this.sessionStartMs = null;
    this.save();
  }

  public attempt(ev: {
    levelId: number;
    isDaily?: boolean;
    isEndless?: boolean;
    startArmy: number;
  }): void {
    this.data.runs += 1;
    this.sessionRuns += 1;
    // Endless runs (levelId <= 0) don't feed any level's win rate.
    if (ev.levelId > 0) this.levelAgg(ev.levelId).attempts += 1;
    this.pushEvent({ t: new Date().toISOString(), type: 'attempt', ...ev });
    this.save();
  }

  public win(ev: {
    levelId: number;
    saved: number;
    kills: number;
    stars: number;
    seconds: number;
    isDaily?: boolean;
    isEndless?: boolean;
  }): void {
    this.data.wins += 1;
    this.levelAgg(ev.levelId).wins += 1;
    this.pushEvent({ t: new Date().toISOString(), type: 'win', ...ev });
    this.save();
  }

  public defeat(ev: {
    levelId: number;
    kind: 'level' | 'endless';
    progressPct?: number;
    bossHpRemaining?: number | null;
    bossHpMax?: number | null;
    kills: number;
    waves?: number;
    seconds: number;
    isDaily?: boolean;
    isEndless?: boolean;
  }): void {
    this.data.defeats += 1;
    this.pushEvent({ t: new Date().toISOString(), type: 'defeat', ...ev });
    this.save();
  }

  public draft(ev: { bonusId: string; levelId: number }): void {
    this.data.draftPicks[ev.bonusId] = (this.data.draftPicks[ev.bonusId] ?? 0) + 1;
    this.pushEvent({ t: new Date().toISOString(), type: 'draft', ...ev });
    this.save();
  }

  /** Full snapshot for the debug export. No PII, no identifiers. */
  public snapshot(): TelemetrySnapshot {
    return {
      version: 1,
      firstSessionDate: this.data.firstSessionDate,
      lastSessionDate: this.data.lastSessionDate,
      daysPlayed: this.data.days.length,
      returnedDay2:
        this.data.firstSessionDate !== null &&
        this.data.lastSessionDate !== null &&
        this.data.lastSessionDate > this.data.firstSessionDate,
      sessions: this.data.sessions,
      runs: this.data.runs,
      wins: this.data.wins,
      defeats: this.data.defeats,
      perLevel: this.data.perLevel,
      draftPicks: this.data.draftPicks,
      events: this.data.events
    };
  }

  /** Hidden test/debug helper: wipes the local telemetry store. */
  public reset(): void {
    this.data = emptyData();
    this.sessionStartMs = null;
    this.sessionRuns = 0;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }
}
