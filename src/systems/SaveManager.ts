// Phase 3 — SaveManager: the single persistence layer. localStorage only,
// one key prefix (`qila-rush:`), versioned save object, defensive parsing
// (corrupt save = fresh save, never crash). All coins, stars, upgrades,
// lives, missions, daily rewards and bests flow through here.

import {
  todayKey,
  yesterdayKey,
  generateMissions,
  dailyRewardForDay,
  type MissionDef,
  type MissionKind,
  type DailyReward,
  type BoosterId
} from './Daily';
import { LIVES } from './Economy';

export const SAVE_KEY = 'qila-rush:save:v1';
const SAVE_VERSION = 1;

export interface MissionState extends MissionDef {
  progress: number;
  done: boolean;
  claimed: boolean;
}

export interface SaveData {
  version: number;
  coins: number;
  lives: number;
  livesUpdatedAt: number; // ms timestamp for regen math
  levelStars: Record<string, number>;
  bestScore: Record<string, number>;
  totalWins: number;
  winStreak: number;
  bestStreak: number;
  totalKills: number;
  totalCoinsEarned: number;
  gamesPlayed: number;
  upgrades: Record<string, number>;
  boosters: Record<string, number>;
  dailyLastClaim: string; // YYYY-MM-DD or ''
  dailyStreak: number;
  dailyChallengeDone: Record<string, boolean>;
  missionsDate: string;
  missions: MissionState[];
  firstChestOpened: boolean;
}

function freshSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: 0,
    lives: LIVES.MAX,
    livesUpdatedAt: Date.now(),
    levelStars: {},
    bestScore: {},
    totalWins: 0,
    winStreak: 0,
    bestStreak: 0,
    totalKills: 0,
    totalCoinsEarned: 0,
    gamesPlayed: 0,
    upgrades: {},
    boosters: {},
    dailyLastClaim: '',
    dailyStreak: 0,
    dailyChallengeDone: {},
    missionsDate: '',
    missions: [],
    firstChestOpened: false
  };
}

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
    this.refreshLives();
    this.ensureMissions();
  }

  // ------------------------------------------------------------------ load/save

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return freshSave();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!parsed || parsed.version !== SAVE_VERSION) return freshSave();
      const fresh = freshSave();
      // Merge over fresh defaults so missing/corrupt fields heal themselves.
      const merged: SaveData = { ...fresh, ...parsed };
      merged.levelStars = { ...(parsed.levelStars ?? {}) };
      merged.bestScore = { ...(parsed.bestScore ?? {}) };
      merged.upgrades = { ...(parsed.upgrades ?? {}) };
      merged.boosters = { ...(parsed.boosters ?? {}) };
      merged.dailyChallengeDone = { ...(parsed.dailyChallengeDone ?? {}) };
      merged.missions = Array.isArray(parsed.missions) ? parsed.missions : [];
      if (typeof merged.coins !== 'number' || merged.coins < 0) merged.coins = 0;
      if (typeof merged.lives !== 'number' || merged.lives < 0) merged.lives = LIVES.MAX;
      if (typeof merged.livesUpdatedAt !== 'number') merged.livesUpdatedAt = Date.now();
      return merged;
    } catch {
      // Corrupt save: start fresh, never crash.
      return freshSave();
    }
  }

  public save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full/blocked — game keeps running in-memory.
    }
  }

  /** Read-only snapshot for UI rendering. */
  public snapshot(): SaveData {
    return this.data;
  }

  // ------------------------------------------------------------------ coins

  public get coins(): number {
    return this.data.coins;
  }

  /** Add coins from a real event. Returns the new balance. */
  public addCoins(amount: number): number {
    if (amount <= 0) return this.data.coins;
    this.data.coins += Math.floor(amount);
    this.data.totalCoinsEarned += Math.floor(amount);
    this.save();
    return this.data.coins;
  }

  /** Spend coins; false if the balance is too low (no partial spend). */
  public spendCoins(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.data.coins < amount) return false;
    this.data.coins -= amount;
    this.save();
    return true;
  }

  // ------------------------------------------------------------------ lives

  public get lives(): number {
    return this.data.lives;
  }

  /** Timestamp-based regen: 1 life per 5 min, survives reload. */
  public refreshLives(now: number = Date.now()): void {
    if (this.data.lives >= LIVES.MAX) {
      this.data.livesUpdatedAt = now;
      return;
    }
    const elapsed = now - this.data.livesUpdatedAt;
    if (elapsed < LIVES.REGEN_MS) return;
    const gained = Math.floor(elapsed / LIVES.REGEN_MS);
    this.data.lives = Math.min(LIVES.MAX, this.data.lives + gained);
    this.data.livesUpdatedAt =
      this.data.lives >= LIVES.MAX ? now : this.data.livesUpdatedAt + gained * LIVES.REGEN_MS;
    this.save();
  }

  /** Milliseconds until the next life (null when full). */
  public timeToNextLifeMs(now: number = Date.now()): number | null {
    if (this.data.lives >= LIVES.MAX) return null;
    return Math.max(0, LIVES.REGEN_MS - (now - this.data.livesUpdatedAt));
  }

  public loseLife(): void {
    if (this.data.lives <= 0) return;
    this.data.lives -= 1;
    if (this.data.lives < LIVES.MAX) {
      // Regen clock starts from the moment we dropped below max.
      this.data.livesUpdatedAt = Date.now();
    }
    this.save();
  }

  public gainLife(): void {
    if (this.data.lives >= LIVES.MAX) return;
    this.data.lives += 1;
    if (this.data.lives >= LIVES.MAX) this.data.livesUpdatedAt = Date.now();
    this.save();
  }

  // ------------------------------------------------------------------ levels / bests

  public getStars(levelId: number): number {
    return this.data.levelStars[String(levelId)] ?? 0;
  }

  public setStars(levelId: number, stars: number): boolean {
    const key = String(levelId);
    const prev = this.data.levelStars[key] ?? 0;
    if (stars <= prev) return false;
    this.data.levelStars[key] = stars;
    this.save();
    return true; // new best
  }

  /** Highest level with at least 1 star (0 = nothing cleared yet). */
  public highestCleared(): number {
    let best = 0;
    for (const [k, v] of Object.entries(this.data.levelStars)) {
      if (v > 0) best = Math.max(best, Number(k));
    }
    return best;
  }

  public isUnlocked(levelId: number): boolean {
    return levelId === 1 || this.getStars(levelId - 1) > 0;
  }

  public getBestScore(levelId: number): number {
    return this.data.bestScore[String(levelId)] ?? 0;
  }

  /** Returns true when this score beats the stored best for the level. */
  public setBestScore(levelId: number, score: number): boolean {
    const key = String(levelId);
    if (score <= (this.data.bestScore[key] ?? 0)) return false;
    this.data.bestScore[key] = score;
    this.save();
    return true;
  }

  public recordWin(): void {
    this.data.totalWins += 1;
    this.data.winStreak += 1;
    this.data.bestStreak = Math.max(this.data.bestStreak, this.data.winStreak);
    this.save();
  }

  public recordLoss(): void {
    this.data.winStreak = 0;
    this.save();
  }

  public recordKills(n: number): void {
    this.data.totalKills += n;
    this.save();
  }

  public recordGamePlayed(): void {
    this.data.gamesPlayed += 1;
    this.save();
  }

  // ------------------------------------------------------------------ upgrades

  public getUpgradeLevel(id: string): number {
    return this.data.upgrades[id] ?? 0;
  }

  public setUpgradeLevel(id: string, level: number): void {
    this.data.upgrades[id] = level;
    this.save();
  }

  // ------------------------------------------------------------------ boosters

  public boosterCount(id: BoosterId): number {
    return this.data.boosters[id] ?? 0;
  }

  public addBooster(id: BoosterId, n: number = 1): void {
    this.data.boosters[id] = (this.data.boosters[id] ?? 0) + n;
    this.save();
  }

  /** Consume one booster from inventory; false when none owned. */
  public useBooster(id: BoosterId): boolean {
    const owned = this.data.boosters[id] ?? 0;
    if (owned <= 0) return false;
    this.data.boosters[id] = owned - 1;
    this.save();
    return true;
  }

  // ------------------------------------------------------------------ daily rewards

  public get dailyStreak(): number {
    return this.data.dailyStreak;
  }

  public get dailyLastClaim(): string {
    return this.data.dailyLastClaim;
  }

  public canClaimDaily(today: string = todayKey()): boolean {
    return this.data.dailyLastClaim !== today;
  }

  /**
   * Claim today's reward. Streak continues only if yesterday was claimed;
   * a missed day resets the streak to 1. Returns the reward or null when
   * already claimed today. `now` is injectable for tests; production passes
   * the real clock.
   */
  public claimDaily(today: string = todayKey(), now: Date = new Date()): DailyReward | null {
    if (!this.canClaimDaily(today)) return null;
    const continues = this.data.dailyLastClaim === yesterdayKey(now);
    this.data.dailyStreak = continues ? this.data.dailyStreak + 1 : 1;
    this.data.dailyLastClaim = today;
    const reward = dailyRewardForDay(this.data.dailyStreak - 1);
    if (reward.coins > 0) this.addCoins(reward.coins);
    if (reward.booster) this.addBooster(reward.booster, 1);
    this.save();
    return reward;
  }

  /** Next reward preview (what tomorrow's claim would be if streak continues). */
  public nextDailyReward(): DailyReward {
    return dailyRewardForDay(this.data.dailyStreak);
  }

  // ------------------------------------------------------------------ daily challenge

  public isDailyChallengeDone(date: string = todayKey()): boolean {
    return this.data.dailyChallengeDone[date] === true;
  }

  public markDailyChallengeDone(date: string = todayKey()): void {
    this.data.dailyChallengeDone[date] = true;
    this.save();
  }

  // ------------------------------------------------------------------ missions

  /** Regenerate the 3 missions when the date has rolled over. */
  public ensureMissions(today: string = todayKey()): void {
    if (this.data.missionsDate === today && this.data.missions.length === 3) return;
    this.data.missionsDate = today;
    this.data.missions = generateMissions(today).map((m) => ({
      ...m,
      progress: 0,
      done: false,
      claimed: false
    }));
    this.save();
  }

  public get missions(): MissionState[] {
    this.ensureMissions();
    return this.data.missions;
  }

  /** Feed a real play event into every open mission of that kind. */
  public recordMission(kind: MissionKind, amount: number = 1): void {
    let changed = false;
    for (const m of this.data.missions) {
      if (m.kind !== kind || m.done) continue;
      m.progress = Math.min(m.target, m.progress + amount);
      if (m.progress >= m.target) m.done = true;
      changed = true;
    }
    if (changed) this.save();
  }

  /** Claim a completed mission's coins. Returns coins paid, 0 when not claimable. */
  public claimMission(index: number): number {
    const m = this.data.missions[index];
    if (!m || !m.done || m.claimed) return 0;
    m.claimed = true;
    this.addCoins(m.reward);
    this.save();
    return m.reward;
  }

  // ------------------------------------------------------------------ chest

  public get firstChestOpened(): boolean {
    return this.data.firstChestOpened;
  }

  public markChestOpened(): void {
    this.data.firstChestOpened = true;
    this.save();
  }
}
