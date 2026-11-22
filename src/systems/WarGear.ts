// Phase 5 (Doomfall engagement loops) — War-gear collection + fortify phase.
//
// Doomfall's two preparation engines: "build and fortify" (invest in the
// battlefield itself, not just stats) and "evolving arsenal as identity"
// (unlockable, visible, build-defining gear). Two parts, both coin-funded
// through the ONE existing coin path (SaveManager.spendCoins / addCoins —
// no second ledger, so Phase 3's exactly-once banking is untouched):
//
//   (a) FORTIFY — spent per run, on the pre-level screen (levels, daily,
//       and endless via its own pre-run screen). At most 3 fixed slots per
//       run; each slot takes one fortification, picked from a row of cards
//       — no drag-and-drop. Coins are charged once when the run starts;
//       picking on the screen costs nothing until START is tapped, so
//       leaving the screen never spends anything. Fortifications are
//       consumed by the run (spent coins don't come back).
//   (b) WAR-GEAR — bought once with coins in the shop, owned forever,
//       equipped one per slot (arrow type + cannon variant + commander
//       ability + skin). Owned gear stays owned; equipping is free.
//
// ECONOMY (hard guardrail — see the Phase 5 report for the full math):
// the existing sim says ~7,860 coins earnable L1–30 (first clears) vs
// 7,080 for the whole 5-track shop — 780 slack. Total buyable gear here
// is 1,660; typical fortify spending across L1–30 is ~720 (fortify on
// ~12 runs at ~60/run). Gear + fortify are OPTIONAL side-grades — nothing
// here gates level progression, and fortify tops out at 120/run — so a
// player who buys everything delays full shop completion by ~1,600 coins,
// funded by dailies (~355/wk) + missions (~75/day) + endless farming,
// roughly two weeks of normal daily play. No coin wall blocks a level.

export type ArrowTypeId = 'standard' | 'fire' | 'piercing' | 'volley';
export type CannonVariantId = 'standard' | 'rapid' | 'siege';
export type CommanderId = 'none' | 'warhorn' | 'rally';
export type SkinId = 'saffron' | 'crimson' | 'emerald';

export type GearSlot = 'arrow' | 'cannon' | 'commander' | 'skin';

/** One buyable gear item. `id` is namespaced per slot ('arrow:fire', …) so
 *  owned-gear is a single flat Record<string, boolean> in the save. */
export interface GearDef {
  id: string;
  slot: GearSlot;
  /** The value written to equippedGear[slot] when this item is equipped. */
  value: string;
  name: string;
  icon: string;
  /** One line, shown on the shop card. */
  effect: string;
  cost: number;
  /** Free / default item for its slot (owned from the start). */
  free?: boolean;
}

export const GEAR: GearDef[] = [
  // --- Arrow types (one equipped at a time) ---
  {
    id: 'arrow:standard', slot: 'arrow', value: 'standard',
    name: 'Standard Arrows', icon: '🏹',
    effect: 'Plain arrows. Shield-bearers block 60% from the front.',
    cost: 0, free: true
  },
  {
    id: 'arrow:fire', slot: 'arrow', value: 'fire',
    name: 'Fire Arrows', icon: '🔥',
    effect: 'Every arrow burns: 2.2× damage, small splash, and fire ignores shield-bearer front guard.',
    cost: 180
  },
  {
    id: 'arrow:piercing', slot: 'arrow', value: 'piercing',
    name: 'Piercing Arrows', icon: '🎯',
    effect: 'Bodkin points punch straight through a shield-bearer’s front guard at full damage.',
    cost: 220
  },
  {
    id: 'arrow:volley', slot: 'arrow', value: 'volley',
    name: 'Volley Arrows', icon: '🌧️',
    effect: 'Wider spread: every volley looses 2 extra arrows across the enemy line.',
    cost: 260
  },
  // --- Cannon variants (one equipped at a time) ---
  {
    id: 'cannon:standard', slot: 'cannon', value: 'standard',
    name: 'Royal Cannon', icon: '💣',
    effect: 'The standard Topkhana bombardment. 160 damage, 5.5 splash.',
    cost: 0, free: true
  },
  {
    id: 'cannon:rapid', slot: 'cannon', value: 'rapid',
    name: 'Rapid Topkhana', icon: '⚡',
    effect: 'Lighter guns, faster crews: cannon recharges 30% sooner, 10% less damage.',
    cost: 180
  },
  {
    id: 'cannon:siege', slot: 'cannon', value: 'siege',
    name: 'Siege Topkhana', icon: '🏰',
    effect: 'Heavy siege guns: 50% more damage, splash 8 — but 25% slower to recharge.',
    cost: 260
  },
  // --- Commander abilities (one equipped at a time; once per run) ---
  {
    id: 'commander:none', slot: 'commander', value: 'none',
    name: 'No Commander Ability', icon: '—',
    effect: 'March without a commander ability.',
    cost: 0, free: true
  },
  {
    id: 'commander:warhorn', slot: 'commander', value: 'warhorn',
    name: 'War Horn', icon: '📯',
    effect: 'Once per run: blow the horn — your army deals +50% arrow damage for 10 seconds.',
    cost: 220
  },
  {
    id: 'commander:rally', slot: 'commander', value: 'rally',
    name: 'Rally Banner', icon: '🚩',
    effect: 'Once per run: raise the banner — 15 fresh warriors join the march instantly.',
    cost: 180
  },
  // --- Army skins (one equipped at a time; cosmetic identity) ---
  {
    id: 'skin:saffron', slot: 'skin', value: 'saffron',
    name: 'Saffron Warband', icon: '🧡',
    effect: 'The classic blue robes and saffron turbans. Your warband’s colours.',
    cost: 0, free: true
  },
  {
    id: 'skin:crimson', slot: 'skin', value: 'crimson',
    name: 'Crimson Warband', icon: '❤️',
    effect: 'Crimson robes, golden turbans. The enemy sees you coming — and fears it.',
    cost: 80
  },
  {
    id: 'skin:emerald', slot: 'skin', value: 'emerald',
    name: 'Emerald Warband', icon: '💚',
    effect: 'Emerald robes, golden turbans. A warband that marches like a monsoon forest.',
    cost: 80
  }
];

export function gearDef(id: string): GearDef {
  return GEAR.find((g) => g.id === id)!;
}

export function gearBySlot(slot: GearSlot): GearDef[] {
  return GEAR.filter((g) => g.slot === slot);
}

/** Total price of every buyable gear item (free defaults excluded). */
export function totalGearCost(): number {
  return GEAR.reduce((sum, g) => sum + (g.free ? 0 : g.cost), 0);
}

/** Robe + turban colours per skin (THREE hex). Saffron is the original
 *  blue-robe / saffron-turban look, so equipping it changes nothing. */
export const SKIN_COLORS: Record<SkinId, { robe: number; turban: number }> = {
  saffron: { robe: 0x1d4ed8, turban: 0xf59e0b },
  crimson: { robe: 0x991b1b, turban: 0xfbbf24 },
  emerald: { robe: 0x047857, turban: 0xfde047 }
};

export const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  arrow: '🏹 ARROW TYPE',
  cannon: '💣 CANNON',
  commander: '📯 COMMANDER ABILITY',
  skin: '🎨 WARBAND COLOURS'
};

// ---------------------------------------------------------------------------
// Fortify — per-run fortifications, fixed slots on the causeway.
// ---------------------------------------------------------------------------

export type FortifyType = 'tower' | 'trap' | 'wall';

export interface FortifyDef {
  type: FortifyType;
  name: string;
  icon: string;
  /** One line, shown on the pre-level card. */
  effect: string;
  cost: number;
}

export const FORTIFY_DEFS: FortifyDef[] = [
  {
    type: 'tower',
    name: 'Archer Tower',
    icon: '🏹',
    effect: 'Fires an arrow every 1.2s at enemies ahead of it (range 26). Plain arrows — shields still block them from the front.',
    cost: 50
  },
  {
    type: 'trap',
    name: 'Spike Trap',
    icon: '💥',
    effect: 'Hidden ground spikes: 15 damage to every enemy that crosses them. Spikes ignore shields entirely.',
    cost: 30
  },
  {
    type: 'wall',
    name: 'Shield Wall',
    icon: '🛡️',
    effect: 'A stout barricade (150 HP). Enemies halt at it and hack it down — buying your army seconds.',
    cost: 40
  }
];

export function fortifyDef(type: FortifyType): FortifyDef {
  return FORTIFY_DEFS.find((f) => f.type === type)!;
}

/** At most 3 fortifications per run, one per fixed slot. Slots sit between
 *  the level's barriers (70 / 135 / 200 on level 1) so they never overlap
 *  a barrier visually. */
export const FORTIFY_SLOTS = 3;
export const FORTIFY_SLOT_Z = [45, 130, 215] as const;
/** Max spend on fortify in one run (tower + trap + wall). */
export const MAX_FORTIFY_PER_RUN = 120;

/** Wall HP / damage — tuned so a wall buys ~3–6s against a wave. */
export const WALL_HP = 150;
export const WALL_DPS_PER_ENEMY = 6;
/** Tower tuning. Damage rides CONSTANTS.ARROW_DAMAGE (scales with
 *  upgrades), so the tower stays relevant in later levels. */
export const TOWER_FIRE_INTERVAL = 1.2;
export const TOWER_RANGE = 26;
export const TRAP_DAMAGE = 15;

/**
 * Endless Siege: the causeway repeats, so a fortification left behind the
 * march is re-built ahead of the player (the siege engineers move it up
 * the road). Offsets are ahead of the player's current z, staggered so the
 * trap meets the next wave first, then the tower, then the wall.
 */
export const ENDLESS_FORTIFY_REDEPLOY: Record<FortifyType, number> = {
  trap: 35,
  tower: 55,
  wall: 75
};

/** Cost of one run's fortify picks (nulls = empty slots). */
export function fortifyCost(picks: (FortifyType | null)[]): number {
  return picks.reduce((sum, p) => sum + (p ? fortifyDef(p).cost : 0), 0);
}
