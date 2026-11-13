// Phase 3 — Coins economy: upgrade tracks, boosters, coin awards, chest
// rewards. Pure data + math. Every coin traces to a real event (kill, graze,
// win, chest, mission, daily reward) — nothing is granted for free.

import type { BoosterId } from './Daily';

export const COIN_AWARDS = {
  KILL: 1, // per enemy slain
  GRAZE: 2, // per near-miss graze
  WIN_BASE: 20, // flat win bonus
  WIN_PER_LEVEL: 5, // +5 per level number (level 1 win = 25)
  DAILY_CHALLENGE: 50, // extra on top of the normal win bonus
  REVIVE_BASE: 30, // revive cost base
  REVIVE_PER_LEVEL: 10 // +10 per level number (level 1 revive = 40)
} as const;

export const LIVES = {
  MAX: 5,
  REGEN_MS: 5 * 60 * 1000 // 1 life per 5 minutes, timestamp-based
} as const;

// ---------------------------------------------------------------------------
// Upgrades — 5 tracks, 5 levels each. Effects are applied in Game.ts by
// mutating CONSTANTS at level start (PlayerArmy/Projectiles read CONSTANTS at
// use time), so upgrades change real gameplay, not just stored numbers.
// ---------------------------------------------------------------------------

export type UpgradeId = 'army' | 'fireRate' | 'damage' | 'cannon' | 'armour';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  desc: string;
  effectPerLevel: string;
  maxLevel: number;
  costs: number[]; // costs[level] = price to go from `level` to `level + 1`
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'army',
    name: 'War Party',
    icon: '🛡️',
    desc: 'Start every level with more warriors.',
    effectPerLevel: '+2 starting warriors',
    maxLevel: 5,
    costs: [50, 100, 200, 350, 500]
  },
  {
    id: 'fireRate',
    name: 'Swift Bows',
    icon: '🏹',
    desc: 'Your army looses arrows faster.',
    effectPerLevel: '+8% fire rate',
    maxLevel: 5,
    costs: [60, 120, 220, 380, 550]
  },
  {
    id: 'damage',
    name: 'Sharp Arrows',
    icon: '🎯',
    desc: 'Every arrow hits harder.',
    effectPerLevel: '+15% arrow damage',
    maxLevel: 5,
    costs: [60, 120, 220, 380, 550]
  },
  {
    id: 'cannon',
    name: 'Topkhana Drill',
    icon: '💣',
    desc: 'The royal cannon recharges sooner.',
    effectPerLevel: '-1s cannon cooldown',
    maxLevel: 5,
    costs: [80, 150, 280, 450, 650]
  },
  {
    id: 'armour',
    name: 'Iron Armour',
    icon: '⛓️',
    desc: 'Casualties in clashes, slams and rams are reduced.',
    effectPerLevel: '-10% casualties',
    maxLevel: 5,
    costs: [80, 150, 280, 450, 650]
  }
];

export function upgradeCost(def: UpgradeDef, ownedLevel: number): number | null {
  if (ownedLevel >= def.maxLevel) return null;
  return def.costs[ownedLevel];
}

/** Concrete gameplay values derived from owned upgrade levels. */
export interface UpgradeEffects {
  startArmy: number;
  fireRate: number; // shots per second
  arrowDamage: number;
  cannonCooldown: number; // seconds
  armourReduction: number; // 0..0.5 fraction of casualties blocked
}

export function computeUpgradeEffects(
  levels: Record<string, number>
): UpgradeEffects {
  const army = levels['army'] ?? 0;
  const fireRate = levels['fireRate'] ?? 0;
  const damage = levels['damage'] ?? 0;
  const cannon = levels['cannon'] ?? 0;
  const armour = levels['armour'] ?? 0;
  return {
    startArmy: 8 + 2 * army,
    fireRate: 3.2 * (1 + 0.08 * fireRate),
    arrowDamage: 10 * (1 + 0.15 * damage),
    cannonCooldown: Math.max(5, 10 - cannon),
    armourReduction: Math.min(0.5, 0.1 * armour)
  };
}

// ---------------------------------------------------------------------------
// Pre-level boosters — bought with coins, consumed on use.
// ---------------------------------------------------------------------------

export interface BoosterDef {
  id: BoosterId;
  name: string;
  icon: string;
  desc: string;
  cost: number;
}

export const BOOSTERS: BoosterDef[] = [
  {
    id: 'warriors',
    name: '+10 Warriors',
    icon: '⚔️',
    desc: 'Begin the level with 10 extra warriors.',
    cost: 30
  },
  {
    id: 'shield',
    name: 'Battle Shield',
    icon: '🛡️',
    desc: 'Absorbs the first 10 casualties of the run.',
    cost: 40
  },
  {
    id: 'cannon',
    name: 'Extra Cannon',
    icon: '💣',
    desc: 'Cannon starts ready and recharges twice as fast.',
    cost: 50
  }
];

export function boosterDef(id: BoosterId): BoosterDef {
  return BOOSTERS.find((b) => b.id === id)!;
}

// ---------------------------------------------------------------------------
// Victory chest — first chest opens instantly; every chest is instant, no
// fake timers. Reward scales a little with level and sometimes adds a booster.
// ---------------------------------------------------------------------------

export interface ChestReward {
  coins: number;
  booster?: BoosterId;
}

export function rollChestReward(levelId: number, rng: () => number): ChestReward {
  const coins = 20 + levelId * 2 + Math.floor(rng() * 21); // 20..40 + 2/level
  const reward: ChestReward = { coins };
  if (rng() < 0.35) {
    const ids: BoosterId[] = ['warriors', 'shield', 'cannon'];
    reward.booster = ids[Math.floor(rng() * ids.length)];
  }
  return reward;
}

/** Coins earned for winning a level (before kill/graze coins and chest). */
export function winBonus(levelId: number): number {
  return COIN_AWARDS.WIN_BASE + COIN_AWARDS.WIN_PER_LEVEL * levelId;
}

/** Coin price of a revive on a given level. */
export function reviveCost(levelId: number): number {
  return COIN_AWARDS.REVIVE_BASE + COIN_AWARDS.REVIVE_PER_LEVEL * levelId;
}
