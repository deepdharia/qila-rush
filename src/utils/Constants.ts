export const CONSTANTS = {
  // Road & Level Dimensions
  ROAD_WIDTH: 13,
  ROAD_HALF_WIDTH: 6.2,
  LEVEL_LENGTH: 320,
  START_Z: 0,
  BOSS_ARENA_Z: 270,
  LEVEL_FINISH_Z: 310,

  // Player Squad
  PLAYER_BASE_SPEED: 8.5,
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
