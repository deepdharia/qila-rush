// Phase 3 — Level map + generator: 30 levels from a seeded generator with a
// gradual difficulty curve. Level 1 is the original hand-tuned layout
// (guaranteed win: generous gates, weak waves, low-HP barriers). Each level
// defines gates, barriers, waves, boss-or-finish, start army and length.
// Game.ts loads a LevelConfig instead of the old hardcoded single level.

import { mulberry32 } from './Daily';
import { levelWaveComposition, type EnemyType } from './EnemyTypes';
import type { GateOp } from '../entities/Gates';
import type { BarrierReward } from '../entities/Barriers';

export const TOTAL_LEVELS = 30;

export interface GatePairDef {
  z: number;
  leftOp: GateOp;
  leftVal: number;
  rightOp: GateOp;
  rightVal: number;
  /** Phase 2 (Topkhana stream): which side is the golden x5 gate, if any. */
  golden?: 'left' | 'right';
  /** Phase 2: drifts side-to-side (level 6+, ~50% of pairs from the 2nd on). */
  moving?: boolean;
}

export interface BarrierDef {
  z: number;
  hp: number;
  reward: BarrierReward;
}

export interface WaveDef {
  triggerZ: number;
  spawnZ: number;
  pattern: 'line' | 'v-shape' | 'cluster' | 'flank';
  count: number;
  // Phase 4 (Doomfall enemy types): one type per spawned soldier, in spawn
  // order. Absent = all regular (level 1). Composition replaces regulars
  // inside `count` — wave sizes never grow.
  types?: EnemyType[];
}

export interface LevelConfig {
  id: number;
  name: string;
  length: number;
  bossArenaZ: number;
  finishZ: number;
  startArmy: number;
  gates: GatePairDef[];
  barriers: BarrierDef[];
  waves: WaveDef[];
  boss: boolean;
  bossHp: number;
  totalEnemies: number; // wave enemies + boss (1 if present)
  winCoins: number;
}

const FORT_NAMES = [
  'Amber Dawn', 'Red Bastion', 'Saffron Gate', 'Iron Courtyard', 'Peacock Tower',
  'Tiger Rampart', 'Lotus Moat', 'Thunder Keep', 'Jade Rampart', 'Falcon Ridge',
  'Ember Citadel', 'Moonlight Fort', 'Serpent Wall', 'Golden Bastion', 'Storm Gate',
  'Ivory Tower', 'Crimson Hall', 'Desert Rose', 'Cloud Fortress', 'Dragon Pass',
  'Silver Moat', 'Blazing Rampart', 'Hidden Palace', 'Warrior’s Rest', 'Royal Causeway',
  'Echoing Halls', 'Sunset Bastion', 'Ancient Keep', 'Lion’s Maw', 'Crown of Qila'
];

export const BARRIER_REWARDS: BarrierReward[] = [
  { type: 'fire_arrows', warriorsReward: 5, label: '🔥 FLAMING ARROWS' },
  { type: 'double_shot', warriorsReward: 15, label: '🏹 DOUBLE VOLLEY' },
  { type: 'cannon_bonus', warriorsReward: 20, label: '💣 TOPKHANA BOMBARD' }
];

const WAVE_PATTERNS: WaveDef['pattern'][] = ['v-shape', 'flank', 'line', 'cluster'];

/** The original level, kept as level 1: generous gates, weak waves. */
function levelOne(): LevelConfig {
  const gates: GatePairDef[] = [
    { z: 25, leftOp: 'add', leftVal: 5, rightOp: 'add', rightVal: 10 },
    // Phase 2: level 1 gets its golden x5 gate on the 2nd pair (z 105, after
    // the first wave spawns at z 42) — the spectacle, not a balance break.
    { z: 105, leftOp: 'mult', leftVal: 5, rightOp: 'add', rightVal: 15, golden: 'left' },
    { z: 175, leftOp: 'mult', leftVal: 3, rightOp: 'add', rightVal: 25 },
    { z: 245, leftOp: 'add', leftVal: 20, rightOp: 'mult', rightVal: 2 }
  ];
  const barriers: BarrierDef[] = [
    { z: 70, hp: 50, reward: BARRIER_REWARDS[0] },
    { z: 135, hp: 90, reward: BARRIER_REWARDS[1] },
    { z: 200, hp: 160, reward: BARRIER_REWARDS[2] }
  ];
  const waves: WaveDef[] = [
    { triggerZ: 12, spawnZ: 42, pattern: 'v-shape', count: 7 },
    { triggerZ: 72, spawnZ: 95, pattern: 'flank', count: 12 },
    { triggerZ: 142, spawnZ: 165, pattern: 'line', count: 14 },
    { triggerZ: 210, spawnZ: 235, pattern: 'cluster', count: 18 }
  ];
  return {
    id: 1,
    name: FORT_NAMES[0],
    // Phase 4 balance: length 320 -> 360 (march ~48s at 7.5/s, chest < 60s
    // from first play), arena/finish shifted to match; boss 600 -> 450 HP
    // so a mid-size army can still kill it inside the ~2.4s pass-by window.
    length: 360,
    bossArenaZ: 310,
    finishZ: 350,
    startArmy: 8,
    gates,
    barriers,
    waves,
    boss: true,
    bossHp: 450,
    totalEnemies: 7 + 12 + 14 + 18 + 1,
    winCoins: 25
  };
}

/**
 * Deterministic generator. Same level id always yields the same layout.
 * `seedOverride` lets the daily challenge re-roll a layout from a date seed.
 * Difficulty rises gradually: more gates/barriers/waves, bigger counts, higher
 * barrier HP, tougher boss — while the start army also grows a little so early
 * levels stay forgiving and later ones demand upgrades.
 */
export function generateLevel(id: number, seedOverride?: number): LevelConfig {
  if (id === 1 && seedOverride === undefined) return levelOne();
  const n = Math.max(1, Math.min(TOTAL_LEVELS, Math.round(id)));
  const rng = mulberry32(seedOverride ?? n * 2654435761);

  // Phase 4 balance: length 320 + 10/step -> 360 + 30/step (level 30 is
  // 510z, ~68s march) and boss 600 + 150/tier -> 450 + 125/tier (level 30
  // boss 1075 HP). Longer causeways + a lighter boss widen the winnable
  // band without touching wave/barrier growth (7% / 10% per level).
  const length = 360 + 30 * Math.min(6, Math.floor((n - 1) / 5));
  const boss = n === 1 || n % 5 === 0;
  const bossArenaZ = length - 50;
  const finishZ = length - 10;
  const endZ = boss ? bossArenaZ : finishZ;

  // --- Gates: 5 pairs early, +1 at 6 and 14, spread along the causeway. ---
  // Phase 2 (Topkhana stream): lower per-gate values — the stream hits each
  // gate many times per run — and exactly one golden x5 gate per level.
  const gatePairs = 5 + (n >= 6 ? 1 : 0) + (n >= 14 ? 1 : 0);
  const gates: GatePairDef[] = [];
  // Which side (true = left) holds each pair's good gate — needed after the
  // loop to place the golden gate on the good side.
  const gateGoodSide: boolean[] = [];
  for (let i = 0; i < gatePairs; i++) {
    const z = Math.round(25 + ((endZ - 50) * i) / Math.max(1, gatePairs - 1));
    const addBase = 2 + Math.floor(n / 4);
    const mult = n >= 6 && rng() < 0.5 ? 3 : 2;
    // One side is the good gate; the other is a smaller add (or, from level 4,
    // sometimes a small hazard on the far side — never both sides bad).
    const hazard = n >= 4 && rng() < 0.35;
    const goodFirst = rng() < 0.5;
    const goodOp: GateOp = rng() < 0.55 ? 'mult' : 'add';
    const goodVal = goodOp === 'mult' ? mult : addBase + Math.floor(rng() * 10);
    const otherOp: GateOp = hazard ? 'sub' : 'add';
    const otherVal = hazard
      ? 2 + Math.floor(rng() * 2)
      : Math.max(2, addBase + Math.floor(rng() * 3));
    gateGoodSide.push(goodFirst);
    gates.push({
      z,
      leftOp: goodFirst ? goodOp : otherOp,
      leftVal: goodFirst ? goodVal : otherVal,
      rightOp: goodFirst ? otherOp : goodOp,
      rightVal: goodFirst ? otherVal : goodVal
    });
  }

  // Exactly one golden x5 gate per level: a pair from the 2nd on whose z is
  // after the first wave's spawn (first triggerZ is 12, spawnZ = triggerZ +
  // 30 = 42) — never before the player has met the first wave. Its good
  // side becomes mult x5. (rng calls here only affect gates: gates are
  // generated before barriers/waves, and that order is unchanged.)
  const firstWaveSpawnZ = 12 + 30;
  const goldenEligible: number[] = [];
  for (let i = 1; i < gatePairs; i++) {
    if (gates[i].z > firstWaveSpawnZ) goldenEligible.push(i);
  }
  if (goldenEligible.length > 0) {
    const gi = goldenEligible[Math.floor(rng() * goldenEligible.length)];
    if (gateGoodSide[gi]) {
      gates[gi].leftOp = 'mult';
      gates[gi].leftVal = 5;
      gates[gi].golden = 'left';
    } else {
      gates[gi].rightOp = 'mult';
      gates[gi].rightVal = 5;
      gates[gi].golden = 'right';
    }
  }

  // Moving gates from level 6: ~50% of pairs from the 2nd on drift. The
  // fallback guarantees at least one moving pair per level — a level with
  // zero would silently drop the feature for a whole level.
  if (n >= 6) {
    let anyMoving = false;
    for (let i = 1; i < gatePairs; i++) {
      if (rng() < 0.5) {
        gates[i].moving = true;
        anyMoving = true;
      }
    }
    if (!anyMoving) {
      gates[1 + Math.floor(rng() * (gatePairs - 1))].moving = true;
    }
  }

  // --- Barriers: 3 early, +1 at 8, 16, 24. HP scales ~10% per level. ---
  const barrierCount = 3 + (n >= 8 ? 1 : 0) + (n >= 16 ? 1 : 0) + (n >= 24 ? 1 : 0);
  const barriers: BarrierDef[] = [];
  const baseHp = [50, 90, 160, 220];
  for (let i = 0; i < barrierCount; i++) {
    const z = Math.round(70 + ((endZ - 100) * i) / Math.max(1, barrierCount - 1));
    const reward = BARRIER_REWARDS[i % BARRIER_REWARDS.length];
    barriers.push({
      z,
      hp: Math.round(baseHp[i % baseHp.length] * (1 + 0.1 * (n - 1))),
      reward: {
        type: reward.type,
        warriorsReward: reward.warriorsReward + Math.floor(n / 5) * 2,
        label: reward.label
      }
    });
  }

  // --- Waves: 4 early, +1 at 12 and 22. Counts grow ~7% per level. ---
  const waveCount = 4 + (n >= 12 ? 1 : 0) + (n >= 22 ? 1 : 0);
  const baseCounts = [7, 12, 14, 18, 22];
  const waves: WaveDef[] = [];
  let totalEnemies = 0;
  for (let i = 0; i < waveCount; i++) {
    const triggerZ = Math.round(12 + ((endZ - 60) * i) / Math.max(1, waveCount - 1));
    const count = Math.round(baseCounts[i % baseCounts.length] * (1 + 0.07 * (n - 1)));
    totalEnemies += count;
    waves.push({
      triggerZ,
      spawnZ: triggerZ + 30,
      pattern: WAVE_PATTERNS[i % WAVE_PATTERNS.length],
      count,
      // Phase 4: gradual type on-ramp (runners L2, shields L3, champion
      // L5+ non-boss, elephant L10/20/30 last wave). Level 1 has no types.
      types: levelWaveComposition(n, i, waveCount, count, boss, rng)
    });
  }

  const bossHp = boss ? 450 + 125 * Math.floor((n - 1) / 5) : 0;

  return {
    id: n,
    name: FORT_NAMES[(n - 1) % FORT_NAMES.length],
    length,
    bossArenaZ,
    finishZ,
    startArmy: 8 + Math.floor((n - 1) / 4),
    gates,
    barriers,
    waves,
    boss,
    bossHp,
    totalEnemies: totalEnemies + (boss ? 1 : 0),
    winCoins: 20 + 5 * n
  };
}

/**
 * Stars at level end, from real play only.
 * 1 star: you won. 2 stars: saved 12+ warriors OR slew 70%+ of the enemy.
 * 3 stars: saved 25+ warriors AND slew 85%+ of the enemy.
 */
export function computeStars(
  warriorsSaved: number,
  kills: number,
  totalEnemies: number
): number {
  const killRatio = totalEnemies > 0 ? kills / totalEnemies : 0;
  if (warriorsSaved >= 25 && killRatio >= 0.85) return 3;
  if (warriorsSaved >= 12 || killRatio >= 0.7) return 2;
  return 1;
}
