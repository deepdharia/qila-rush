// Phase 3 — Daily systems: date keys, seeded RNG, daily missions, daily
// rewards, daily-challenge seeding. Pure functions only — all state lives in
// SaveManager. No network, no fake timers: everything derives from the
// calendar date on the device.

export type BoosterId = 'warriors' | 'shield' | 'cannon';

/** Local calendar date as YYYY-MM-DD (device-local, so "once per day" is local). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Yesterday's key, for streak continuity checks. */
export function yesterdayKey(d: Date = new Date()): string {
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return todayKey(y);
}

/** Deterministic 32-bit hash of a string — same date always seeds the same day. */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32) for seeded daily content. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Daily missions
// ---------------------------------------------------------------------------

export type MissionKind = 'kill' | 'coins' | 'gates' | 'graze' | 'wins' | 'barriers';

export interface MissionDef {
  kind: MissionKind;
  target: number;
  reward: number; // coins
  label: string;
}

interface MissionTemplate {
  kind: MissionKind;
  target: number;
  reward: number;
  label: string;
}

const MISSION_POOL: MissionTemplate[] = [
  { kind: 'kill', target: 25, reward: 15, label: 'Slay 25 enemies' },
  { kind: 'kill', target: 50, reward: 30, label: 'Slay 50 enemies' },
  { kind: 'coins', target: 100, reward: 20, label: 'Earn 100 coins' },
  { kind: 'coins', target: 200, reward: 35, label: 'Earn 200 coins' },
  { kind: 'gates', target: 4, reward: 20, label: 'Pass 4 good gates' },
  { kind: 'gates', target: 8, reward: 30, label: 'Pass 8 good gates' },
  { kind: 'graze', target: 3, reward: 15, label: 'Graze 3 enemies (near miss)' },
  { kind: 'graze', target: 8, reward: 25, label: 'Graze 8 enemies (near miss)' },
  { kind: 'wins', target: 1, reward: 25, label: 'Win 1 level' },
  { kind: 'wins', target: 2, reward: 40, label: 'Win 2 levels' },
  { kind: 'barriers', target: 2, reward: 20, label: 'Break 2 barriers' }
];

/**
 * 3 missions for a given date. Seeded, so every player sees the same 3 on the
 * same day and they are stable across reloads. Picks 3 distinct kinds.
 */
export function generateMissions(dateKeyStr: string): MissionDef[] {
  const rng = mulberry32(hashSeed(`missions:${dateKeyStr}`));
  const pool = [...MISSION_POOL];
  const picked: MissionDef[] = [];
  const usedKinds = new Set<MissionKind>();
  while (picked.length < 3 && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    const t = pool.splice(idx, 1)[0];
    if (usedKinds.has(t.kind)) continue;
    usedKinds.add(t.kind);
    picked.push({ kind: t.kind, target: t.target, reward: t.reward, label: t.label });
  }
  return picked;
}

// ---------------------------------------------------------------------------
// 7-day daily reward cycle
// ---------------------------------------------------------------------------

export interface DailyReward {
  coins: number;
  booster?: BoosterId;
  label: string;
}

/** Day index is 0-based into the 7-day cycle (streak day 1 = index 0). */
export function dailyRewardForDay(dayIndex: number): DailyReward {
  const cycle: DailyReward[] = [
    { coins: 25, label: '25 coins' },
    { coins: 40, label: '40 coins' },
    { coins: 0, booster: 'warriors', label: '+10 Warriors booster' },
    { coins: 60, label: '60 coins' },
    { coins: 0, booster: 'shield', label: 'Shield booster' },
    { coins: 80, label: '80 coins' },
    { coins: 150, booster: 'cannon', label: '150 coins + Extra Cannon booster' }
  ];
  return cycle[((dayIndex % 7) + 7) % 7];
}

/** Seed for the daily-challenge level — same date, same challenge for everyone. */
export function dailyChallengeSeed(dateKeyStr: string): number {
  return hashSeed(`daily-challenge:${dateKeyStr}`);
}
