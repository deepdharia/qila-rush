// Phase 1 (Doomfall engagement loops) — In-run war-bonus draft.
//
// After each wave cleared / barrier broken, the run pauses and the player
// picks 1 of 3 war bonuses. Bonuses stack within the run (same bonus can be
// picked again in a later draft, with a visible stack count) and reset
// completely when the run ends (win, lose, quit or restart). Nothing here
// is persisted to save — Game owns the run-scoped counts and applies the
// effects; this file only defines the catalogue and the draft roll.

export type WarBonusId =
  | 'reinforcements'
  | 'fire_rate'
  | 'volley_damage'
  | 'march_speed'
  | 'shield_wall'
  | 'coin_magnet'
  | 'flaming_arrows'
  | 'double_volley'
  | 'max_army'
  | 'cannon_reload'
  | 'stream_rate'
  | 'stream_width'
  | 'gate_luck';

export interface WarBonusDef {
  id: WarBonusId;
  /** Emoji icon shown on the card. */
  icon: string;
  name: string;
  /** The effect in ONE line (shown on the card). */
  effect: string;
  /** Short pill label for the HUD buff tray (stack count appended by Game). */
  pill: string;
}

export const WAR_BONUSES: WarBonusDef[] = [
  {
    id: 'reinforcements',
    icon: '🪖',
    name: 'Reinforcements',
    effect: '+15 warriors join your army right now',
    pill: '🪖 REINFORCED'
  },
  {
    id: 'fire_rate',
    icon: '⚡',
    name: 'Rapid Fire',
    effect: 'Your army shoots 20% faster',
    pill: '⚡ RAPID FIRE'
  },
  {
    id: 'volley_damage',
    icon: '🏹',
    name: 'Heavy Volley',
    effect: 'Every arrow hits 25% harder',
    pill: '🏹 HEAVY VOLLEY'
  },
  {
    id: 'march_speed',
    icon: '🥾',
    name: 'Forced March',
    effect: 'Your army marches 10% faster',
    pill: '🥾 FORCED MARCH'
  },
  {
    id: 'shield_wall',
    icon: '🛡️',
    name: 'Shield Wall',
    effect: 'Front ranks take 30% less damage',
    pill: '🛡️ SHIELD WALL'
  },
  {
    id: 'coin_magnet',
    icon: '🧲',
    name: 'Coin Magnet',
    effect: '+50% coins earned this run',
    pill: '🧲 COIN MAGNET'
  },
  {
    id: 'flaming_arrows',
    icon: '🔥',
    name: 'Flaming Arrows',
    effect: 'Arrows ignite enemies, burning them over time',
    pill: '🔥 FLAMING ARROWS'
  },
  {
    id: 'double_volley',
    icon: '🎯',
    name: 'Double Volley',
    effect: '25% chance each volley fires twice',
    pill: '🎯 DOUBLE VOLLEY'
  },
  {
    id: 'max_army',
    icon: '🏰',
    name: 'Bigger Warband',
    effect: 'Max army size +10 warriors',
    pill: '🏰 BIGGER WARBAND'
  },
  {
    id: 'cannon_reload',
    icon: '💣',
    name: 'Topkhana Reload',
    effect: 'Cannon recharges 25% faster, ready now',
    pill: '💣 FAST RELOAD'
  },
  // Phase 2 (Topkhana stream): stream bonuses — Game.pickDraftBonus applies
  // the effects; this catalogue only defines them for the draft roll.
  {
    id: 'stream_rate',
    icon: '🌊',
    name: 'Rapid Stream',
    effect: 'Cannon fires its stream 20% faster',
    pill: '🌊 RAPID STREAM'
  },
  {
    id: 'stream_width',
    icon: '👥',
    name: 'Twin Stream',
    effect: '+1 stream lane from the cannon',
    pill: '👥 TWIN STREAM'
  },
  {
    id: 'gate_luck',
    icon: '🍀',
    name: 'Lucky Gates',
    effect: 'Your next bad gate turns good',
    pill: '🍀 LUCKY GATE'
  }
];

export function warBonusDef(id: WarBonusId): WarBonusDef {
  return WAR_BONUSES.find((b) => b.id === id)!;
}

/**
 * Rolls exactly 3 distinct random bonuses for one draft. `exclude` drops
 * bonuses that would be useless right now (e.g. double-volley chance once
 * the barrier reward already grants a permanent double volley).
 */
export function rollDraft(
  exclude: ReadonlySet<WarBonusId> = new Set(),
  rng: () => number = Math.random
): WarBonusDef[] {
  const pool = WAR_BONUSES.filter((b) => !exclude.has(b.id));
  // Fisher–Yates shuffle, then take the first 3 (pool is always >= 3: at
  // most one bonus is ever excluded).
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
