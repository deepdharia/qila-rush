// Phase 2 (Doomfall engagement loops) — Endless Siege mode.
//
// One endless run is a sequence of waves on a repeating causeway. Each
// wave owns a fixed-length segment of road; the player marches through
// segments forever, and the world wraps (see Game.wrapEndlessWorld) before
// the player runs off the built road. Every 5th wave is a boss wave:
// Commander Sher Khan appears as an elite checkpoint instead of a normal
// wave. Difficulty scales per wave — more enemies, more HP, faster march —
// so the run always ends in defeat eventually; the chase is the local best.
//
// Pure data + math. Game.ts owns the run state and applies the scaling;
// nothing here is persisted (bests live in SaveManager).

import { generateLevel, type LevelConfig, type WaveDef } from './Levels';
import { endlessWaveComposition, type EnemyType } from './EnemyTypes';
import type { GateOp } from '../entities/Gates';

/** Road length owned by one wave (z units). At 7.5/s march, ~9s per wave. */
export const ENDLESS_SEGMENT = 70;

/** Player z that triggers the world wrap (built road ends ~530z). */
export const ENDLESS_WRAP_Z = 420;

/** How far the world shifts back on a wrap (exactly 5 segments). */
export const ENDLESS_WRAP_SHIFT = 350;

/** Every 5th wave is a boss wave — Sher Khan as an elite checkpoint. */
export function isBossWave(wave: number): boolean {
  return wave % 5 === 0;
}

/** Enemy count: 8 at wave 1, +10% per wave, capped by the enemy pool. */
export function endlessWaveCount(wave: number): number {
  return Math.min(55, Math.round(8 * (1 + 0.1 * (wave - 1))));
}

/** Enemy HP: 25 at wave 1, +6% per wave, capped so arrows stay relevant. */
export function endlessWaveHp(wave: number): number {
  return Math.min(120, Math.round(25 * (1 + 0.06 * (wave - 1))));
}

/** Enemy march speed multiplier: +3% per wave, capped at 1.6x. */
export function endlessWaveSpeedMult(wave: number): number {
  return Math.min(1.6, 1 + 0.03 * (wave - 1));
}

/** Wave formation, cycling through the four patterns. */
export function endlessWavePattern(wave: number): WaveDef['pattern'] {
  const patterns: WaveDef['pattern'][] = ['v-shape', 'flank', 'line', 'cluster'];
  return patterns[(wave - 1) % patterns.length];
}

/**
 * Phase 4 (Doomfall enemy types): one type per soldier in this wave, in
 * spawn order. Runners from wave 2, shields from wave 3, a champion from
 * wave 4 then every 4th wave, an elephant from wave 8 then every 8th.
 */
export function endlessWaveTypes(wave: number): EnemyType[] {
  return endlessWaveComposition(wave, endlessWaveCount(wave));
}

/** Boss HP for the Nth boss appearance (wave 5 = 1st, wave 10 = 2nd, ...). */
export function endlessBossHp(bossIndex: number): number {
  return 450 + 250 * (bossIndex - 1);
}

/**
 * Phase 2 (Topkhana stream): one gate pair for an endless segment, tuned
 * like Levels.ts — small values, since the stream hits each gate many times
 * per run. Game.armEndlessSegment passes the result straight into
 * GateManager.createGatePair's opts, so this shape must match it.
 */
export interface EndlessGatePair {
  leftOp: GateOp;
  leftVal: number;
  rightOp: GateOp;
  rightVal: number;
  golden?: 'left' | 'right';
  moving?: boolean;
}

export function endlessGatePair(wave: number, rng: () => number = Math.random): EndlessGatePair {
  const addBase = 2 + Math.floor(wave / 5);
  const mult = wave >= 6 && rng() < 0.5 ? 3 : 2;
  // One side is the good gate; the other is a smaller add (or, from wave 4,
  // sometimes a small hazard on the far side — never both sides bad).
  const hazard = wave >= 4 && rng() < 0.3;
  const goodFirst = rng() < 0.5;
  const goodOp: GateOp = rng() < 0.55 ? 'mult' : 'add';
  const goodVal = goodOp === 'mult' ? mult : addBase + Math.floor(rng() * 10);
  const otherOp: GateOp = hazard ? 'sub' : 'add';
  const otherVal = hazard
    ? 2 + Math.floor(rng() * 2)
    : Math.max(2, addBase + Math.floor(rng() * 3));
  const pair: EndlessGatePair = {
    leftOp: goodFirst ? goodOp : otherOp,
    leftVal: goodFirst ? goodVal : otherVal,
    rightOp: goodFirst ? otherOp : goodOp,
    rightVal: goodFirst ? otherVal : goodVal
  };
  // Golden x5 on the good side every 5th segment (the boss-wave segments).
  if (wave % 5 === 0) {
    if (goodFirst) {
      pair.leftOp = 'mult';
      pair.leftVal = 5;
      pair.golden = 'left';
    } else {
      pair.rightOp = 'mult';
      pair.rightVal = 5;
      pair.golden = 'right';
    }
  }
  // Moving gates from wave 6 (50% chance).
  if (wave >= 6 && rng() < 0.5) pair.moving = true;
  return pair;
}

/** Lump coin bonus for clearing a boss wave (before coin-magnet scaling). */
export function endlessBossCoins(wave: number): number {
  return 25 + 5 * wave;
}

/**
 * Base config for an endless run: level 1's start army and boss, but no
 * fixed waves/gates/barriers (Game spawns those per segment) and a finish
 * line so far away it can never be reached — an endless run ends only on
 * defeat or quit. The boss arena is armed per boss wave by Game.
 */
export function endlessLevelConfig(): LevelConfig {
  const cfg = generateLevel(1);
  return {
    ...cfg,
    waves: [],
    gates: [],
    barriers: [],
    boss: true,
    bossHp: 450,
    bossArenaZ: 100000,
    finishZ: 100000
  };
}
