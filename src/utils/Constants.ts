export const CONSTANTS = {
  // Road & Level Dimensions
  // Phase 4 balance: FortressEnvironment builds the road/parapets ONCE
  // from these defaults (never rebuilt per level), so they must cover the
  // longest level (510z) and match level 1's arena (310) / finish (350).
  // loadLevelConfig() still overwrites BOSS_ARENA_Z / LEVEL_FINISH_Z per
  // level at runtime; LEVEL_LENGTH here only sizes the static dressing.
  ROAD_WIDTH: 13,
  ROAD_HALF_WIDTH: 6.2,
  LEVEL_LENGTH: 510,
  START_Z: 0,
  BOSS_ARENA_Z: 310,
  LEVEL_FINISH_Z: 350,

  // Player Squad
  // Phase 4 balance: 8.5 -> 7.5. Runs were ~40s (march 320z at 8.5/s);
  // 7.5/s lands level 1 at ~50s and level 30 at ~70s. Lateral speed is
  // untouched, so steering stays as responsive as before.
  PLAYER_BASE_SPEED: 7.5,
  PLAYER_SPEED_BOOST: 1.0,
  PLAYER_LATERAL_SPEED: 18,
  INITIAL_SOLDIER_COUNT: 8,
  MAX_SOLDIER_COUNT: 120,

  // Combat
  FIRE_RATE_BASE: 3.2, // shots per second per shooter group
  ARROW_SPEED: 42,
  ARROW_DAMAGE: 10,
  ARROW_RANGE: 26,
  
  // Flaming Arrows Buff
  FIRE_DAMAGE_MULTIPLIER: 2.2,
  
  // Cannon / Topkhana Ability
  CANNON_COOLDOWN: 10.0, // seconds
  CANNON_DAMAGE: 160,
  CANNON_SPLASH_RADIUS: 5.5,

  // --- Phase 3: systems tuning (appended; existing values untouched) ---
  // These base values are the un-upgraded defaults. Game.ts mutates the
  // matching fields at level start from the player's owned upgrades, and
  // restores them from these bases on the next load.
  BASE_INITIAL_SOLDIER_COUNT: 8,
  BASE_FIRE_RATE: 3.2,
  BASE_ARROW_DAMAGE: 10,
  BASE_CANNON_COOLDOWN: 10.0,
  SAVE_KEY: 'qila-rush:save:v1',
  MAX_LIVES: 5,
  LIFE_REGEN_MS: 5 * 60 * 1000, // 1 life per 5 minutes

  // Colors
  COLORS: {
    SANDSTONE: 0xd4a373,
    SANDSTONE_DARK: 0xa66f44,
    SANDSTONE_LIGHT: 0xf4d0a7,
    BLUE_ROBE: 0x1d4ed8,
    BLUE_ACCENT: 0x38bdf8,
    RED_ROBE: 0xb91c1c,
    RED_ACCENT: 0xef4444,
    GOLD: 0xf59e0b,
    GOLD_LIGHT: 0xfef08a,
    BRONZE: 0x92400e,
    TURBAN_BLUE: 0xf59e0b, // Saffron turban on blue troops
    TURBAN_RED: 0x3f1212,  // Dark crimson turban / iron helm
    FOG: 0xd9b78c,
    SKY_TOP: 0x3b82f6,
    SKY_HORIZON: 0xfbbf24
  }
};
