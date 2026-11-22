// Phase 4 (Doomfall engagement loops) — enemy types + elites.
//
// Doomfall's rising difficulty comes from NEW enemy types, not just bigger
// numbers: each type is a new problem that forces a new target priority.
// Four behaviours, each clearly telegraphed (size + ring colour + an emoji
// marker above the head, and an HP bar for the two elites):
//
//   shield   — frontal arrows glance off (-60%); flank it, or burn / bomb it
//   runner   — ~60% faster, low HP; closes the gap before volleys thin it
//   champion — mini-boss, ~5x HP, visible HP bar, +10 coins on kill
//   elephant — slow, ~15x HP, tramples the front rank on contact (3
//              casualties, keeps marching — it never dies on contact, so it
//              can never soft-lock a run); +25 coins on kill
//
// Pure data + composition. EnemyArmy owns the visuals and combat behaviour;
// Levels / Endless own when each type first appears. Composition REPLACES
// regular soldiers inside the existing wave counts — wave sizes, the enemy
// pool budget (90) and level lengths never change.

import { COIN_AWARDS } from './Economy';

export type EnemyType = 'regular' | 'shield' | 'runner' | 'champion' | 'elephant';

export interface EnemyTypeDef {
  /** HP multiplier over the wave's base HP. */
  hpMult: number;
  /** March-speed multiplier over the wave's base speed. */
  speedMult: number;
  /** Model scale — the first thing a phone player reads. */
  scale: number;
  /** Emoji marker floating above the head ('' = none, regular soldiers). */
  marker: string;
  /** Marker disc + ground-ring colour (CSS hex for the canvas marker). */
  markerColor: string;
  /** Same colour as a THREE hex, for the ground ring. */
  ringColor: number;
  /** Extra coins on kill, paid through the normal kill-coin pipeline. */
  coinBonus: number;
  /** Shows a small HP bar above the head. */
  hasHpBar: boolean;
  /** Casualties dealt on contact. 0 = dies on clash like a regular. */
  trampleCasualties: number;
  label: string;
}

export const ENEMY_TYPE_DEFS: Record<EnemyType, EnemyTypeDef> = {
  regular: {
    hpMult: 1, speedMult: 1, scale: 1, marker: '', markerColor: '#dc2626',
    ringColor: 0xdc2626, coinBonus: 0, hasHpBar: false, trampleCasualties: 0,
    label: 'Soldier'
  },
  shield: {
    hpMult: 1.2, speedMult: 0.9, scale: 1.08, marker: '🛡️', markerColor: '#38bdf8',
    ringColor: 0x38bdf8, coinBonus: 0, hasHpBar: false, trampleCasualties: 0,
    label: 'Shield-bearer'
  },
  runner: {
    hpMult: 0.7, speedMult: 1.6, scale: 0.9, marker: '⚡', markerColor: '#fde047',
    ringColor: 0xfde047, coinBonus: 0, hasHpBar: false, trampleCasualties: 0,
    label: 'Runner'
  },
  champion: {
    hpMult: 5, speedMult: 0.9, scale: 1.28, marker: '👑', markerColor: '#f59e0b',
    ringColor: 0xf59e0b, coinBonus: COIN_AWARDS.CHAMPION_KILL, hasHpBar: true,
    trampleCasualties: 0, label: 'Elite Champion'
  },
  elephant: {
    hpMult: 15, speedMult: 0.55, scale: 1.9, marker: '🐘', markerColor: '#a78bfa',
    ringColor: 0xa78bfa, coinBonus: COIN_AWARDS.ELEPHANT_KILL, hasHpBar: true,
    trampleCasualties: 3, label: 'War Elephant'
  }
};

/** Fraction of plain-arrow damage a shield-bearer blocks from the front. */
export const SHIELD_FRONT_RESIST = 0.6;

/** Lateral offset (x units) between the player army and a shield-bearer at
 *  which an arrow counts as a flank shot and ignores the front resist. */
export const SHIELD_FLANK_DX = 2;

/** First-sighting banner per type (Game shows each once per run). */
export const ENEMY_TYPE_INTRO: Record<Exclude<EnemyType, 'regular'>, string> = {
  shield: '🛡️ SHIELD-BEARER — ARROWS BOUNCE OFF ITS FRONT! FLANK IT, OR USE FIRE / CANNON!',
  runner: '⚡ RUNNER — FAST AND FRAGILE! CUT IT DOWN BEFORE IT REACHES YOU!',
  champion: '👑 ELITE CHAMPION — 5× HEALTH, +10 COINS IF YOU SLAY IT!',
  elephant: '🐘 WAR ELEPHANT — TRAMPLES YOUR FRONT RANK! FOCUS ALL FIRE ON IT!'
};

/**
 * Fills a `count`-long type list: the given specials placed at spread-out
 * slots (shuffled with `rng`), everything else regular. Specials replace
 * regulars — the wave count never grows.
 */
function compose(
  count: number,
  specials: { type: EnemyType; count: number }[],
  rng: () => number
): EnemyType[] {
  const types: EnemyType[] = new Array(count).fill('regular');
  const slots = Array.from({ length: count }, (_, i) => i);
  // Fisher-Yates with the caller's rng (deterministic for levels).
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  let at = 0;
  for (const s of specials) {
    for (let k = 0; k < s.count && at < slots.length; k++) {
      types[slots[at++]] = s.type;
    }
  }
  return types;
}

/**
 * Level wave composition. Gradual on-ramp, early levels stay mostly
 * regular soldiers, and level 1 is all regular (FTUE guaranteed win).
 * Champions appear once per level from level 5 — but never on a boss
 * level's waves (Sher Khan is already the elite there). The elephant
 * appears only on levels 10 / 20 / 30, in the last wave before the arena.
 */
export function levelWaveComposition(
  levelId: number,
  waveIndex: number,
  totalWaves: number,
  count: number,
  isBossLevel: boolean,
  rng: () => number
): EnemyType[] {
  if (levelId <= 1) return new Array(count).fill('regular');
  const specials: { type: EnemyType; count: number }[] = [];
  if (levelId >= 2) {
    specials.push({ type: 'runner', count: Math.max(1, Math.round(count * 0.18)) });
  }
  if (levelId >= 3) {
    specials.push({ type: 'shield', count: Math.max(1, Math.round(count * 0.15)) });
  }
  // One champion per level from level 5, in the middle wave — never on a
  // boss level (levels 5/10/15/20/25/30 already have Sher Khan).
  if (!isBossLevel && levelId >= 5 && waveIndex === Math.floor(totalWaves / 2)) {
    specials.push({ type: 'champion', count: 1 });
  }
  // One elephant on levels 10 / 20 / 30, in the last wave before the arena
  // (never stacked on top of Sher Khan — the arena comes after the waves).
  if (
    (levelId === 10 || levelId === 20 || levelId === 30) &&
    waveIndex === totalWaves - 1
  ) {
    specials.push({ type: 'elephant', count: 1 });
  }
  return compose(count, specials, rng);
}

/**
 * Endless wave composition. Runners from wave 2, shield-bearers from wave
 * 3, one champion from wave 4 then every 4th wave, one elephant from wave
 * 8 then every 8th wave. (Boss waves spawn no normal wave, so a champion
 * due on a boss wave — e.g. wave 20 — is simply skipped that wave.)
 */
export function endlessWaveComposition(wave: number, count: number): EnemyType[] {
  if (wave <= 1) return new Array(count).fill('regular');
  const specials: { type: EnemyType; count: number }[] = [];
  specials.push({ type: 'runner', count: Math.max(1, Math.round(count * 0.2)) });
  if (wave >= 3) {
    specials.push({ type: 'shield', count: Math.max(1, Math.round(count * 0.15)) });
  }
  if (wave >= 4 && wave % 4 === 0) {
    specials.push({ type: 'champion', count: 1 });
  }
  if (wave >= 8 && wave % 8 === 0) {
    specials.push({ type: 'elephant', count: 1 });
  }
  return compose(count, specials, Math.random);
}
