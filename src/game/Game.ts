import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import { FortressEnvironment } from '../environment/FortressEnvironment';
import { PlayerArmy } from '../entities/PlayerArmy';
import { EnemyArmy, type EnemyUnit } from '../entities/EnemyArmy';
import { BossEnemy } from '../entities/BossEnemy';
import { GateManager } from '../entities/Gates';
import { BarrierManager, BarrierReward } from '../entities/Barriers';
import { FortificationManager } from '../entities/Fortifications';
import { SoldierModelFactory } from '../entities/SoldierModel';
import { ProjectileManager } from '../entities/Projectiles';
import { ParticleSystem } from '../entities/ParticleSystem';
import { CameraManager } from './CameraManager';
import { InputManager } from './InputManager';
import { SoundManager } from '../audio/SoundManager';
import { UIManager } from '../ui/UIManager';
import type { RunCoinBreakdown } from '../ui/UIManager';
// Phase 3: systems (addiction hooks) — localStorage save, level generator,
// coins economy, daily systems, share card.
import { SaveManager } from '../systems/SaveManager';
import { generateLevel, computeStars, TOTAL_LEVELS, BARRIER_REWARDS, type LevelConfig } from '../systems/Levels';
import {
  COIN_AWARDS,
  UPGRADES,
  BOOSTERS,
  computeUpgradeEffects,
  rollChestReward,
  reviveCost,
  upgradeCost,
  type UpgradeId,
  type ChestReward
} from '../systems/Economy';
import { todayKey, dailyChallengeSeed, type BoosterId } from '../systems/Daily';
import { rollDraft, warBonusDef, WAR_BONUSES, type WarBonusId } from '../systems/WarBonus';
import { renderShareCard, shareScoreCard } from '../systems/ShareCard';
// Phase 2 (Doomfall endless): Endless Siege mode — scaling waves on a
// repeating causeway, boss every 5 waves, local bests.
import {
  ENDLESS_SEGMENT,
  ENDLESS_WRAP_Z,
  ENDLESS_WRAP_SHIFT,
  isBossWave,
  endlessWaveCount,
  endlessWaveHp,
  endlessWaveSpeedMult,
  endlessWavePattern,
  endlessWaveTypes,
  endlessBossHp,
  endlessBossCoins,
  endlessLevelConfig
} from '../systems/Endless';
// Phase 4 (Doomfall enemy types): first-sighting banners per type.
import { ENEMY_TYPE_INTRO, type EnemyType } from '../systems/EnemyTypes';
// Phase 4: auto quality scaler (frame-time driven, manual toggle wins).
import {
  AutoQualityScaler,
  QUALITY_SETTINGS,
  type QualityLevel
} from '../systems/AutoQuality';
// Phase 0 (master plan): local-only telemetry — no network, no PII.
import { Telemetry } from '../systems/Telemetry';
// Phase 5 (Doomfall war-gear + fortify): gear catalogue, fortify pricing,
// skin colours.
import {
  FORTIFY_DEFS,
  GEAR,
  SKIN_COLORS,
  fortifyCost,
  fortifyDef,
  gearDef,
  type FortifyType,
  type SkinId
} from '../systems/WarGear';
import type { FortifySlotRow, GearRow } from '../ui/UIManager';

// Phase 1 (master plan): a phone is a coarse pointer (touch-first device)
// or a narrow viewport. matchMedia('(pointer: coarse)') catches touch
// phones/tablets even at desktop-like widths; the innerWidth < 768 fallback
// catches small windows and devices that report a fine pointer. Same test
// in FortressEnvironment / ParticleSystem (kept local per file so no shared
// helper has to live in a file this phase doesn't own).
const IS_PHONE =
  window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

// Phase 1 (master plan): per-frame allocation sweep — module-level scratch
// reused by update() / handleProjectileCollisions(). Every use below reads
// the scratch synchronously within the frame before the next use overwrites
// it; nothing here is stored or awaited.
const _playerPos = new THREE.Vector3();
const _bossTargetPos = new THREE.Vector3();
const _bossTarget: { position: THREE.Vector3; health: number } = {
  position: _bossTargetPos,
  health: 0
};
const _potentialTargets: { position: THREE.Vector3; health: number }[] = [];
const _targetPos = new THREE.Vector3();
const _dmgPos = new THREE.Vector3();
const _textPos = new THREE.Vector3();
const _activeEnemies: EnemyUnit[] = [];

export type GameState = 'menu' | 'playing' | 'paused' | 'draft' | 'victory' | 'defeat';

interface VictorySummary {
  levelId: number;
  levelName: string;
  stars: number;
  score: number;
  coinsEarned: number;
  kills: number;
  saved: number;
  isDaily: boolean;
}

// Phase 3 (Doomfall failure-pays): the last defeat, kept so the shop can
// return to it ("SPEND COINS" → buy → back to the same defeat screen).
// The breakdown is what that defeat banked; the balance is re-read live on
// return, so coins spent in the shop show up immediately.
interface LevelDefeatRecord {
  kind: 'level';
  progressPct: number;
  kills: number;
  score: number;
  reviveCost: number;
  breakdown: RunCoinBreakdown;
}

interface EndlessDefeatRecord {
  kind: 'endless';
  waves: number;
  kills: number;
  bestWaves: number;
  newBest: boolean;
  breakdown: RunCoinBreakdown;
}

type LastDefeat = LevelDefeatRecord | EndlessDefeatRecord;

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;

  // Subsystems
  private cameraManager: CameraManager;
  private inputManager: InputManager;
  public soundManager: SoundManager;
  private uiManager: UIManager;
  private environment: FortressEnvironment;
  private particles: ParticleSystem;
  private projectiles: ProjectileManager;
  private playerArmy: PlayerArmy;
  private enemyArmy: EnemyArmy;
  private boss: BossEnemy;
  private gateManager: GateManager;
  private barrierManager: BarrierManager;
  // Phase 5 (Doomfall fortify): per-run fortifications (tower / trap /
  // wall), built from the pre-level picks and cleared on every run reset.
  private fortifications: FortificationManager;

  // State
  private state: GameState = 'menu';
  private lastTime: number = 0;
  private cannonCooldownTimer: number = 0;
  private isHighQuality: boolean = true;
  private autoQuality: AutoQualityScaler;
  // Phase 0: local-only telemetry (see systems/Telemetry.ts) + the ?perf=1
  // live overlay. Neither changes gameplay; both feed the Phase 4 audit.
  private telemetry = new Telemetry();
  private runStartMs: number = 0;
  private perfEnabled: boolean = false;
  private perfOverlay: HTMLElement | null = null;
  private perfOverlayText: HTMLElement | null = null;
  private perfCopyBtn: HTMLElement | null = null;
  private frameTimes: number[] = [];
  private perfTimer: number = 0;
  private perfFps: number = 0;
  private perfFrameAvgMs: number = 0;
  private perfFrameP95Ms: number = 0;
  private bossEncounterTriggered: boolean = false;
  private enemyWavesSpawned: { [waveId: string]: boolean } = {};

  // --- Phase 2: game feel (time scale, combo, graze, haptics) ---
  // Time scale: 1 = normal. Hit-stop drives it to 0 briefly, slow-mo to
  // ~0.3. Driven by real time in loop() so it stays frame-rate independent.
  private timeScale: number = 1;
  private hitStopTimer: number = 0;
  private slowMoTimer: number = 0;
  private slowMoScale: number = 0.3;
  private scaledTime: number = 0;

  // Combo / kill streak: consecutive real kills inside the window raise the
  // score multiplier (x2 at 3, x3 at 6, x5 at 10). Exposed for the Systems
  // phase via the public getters below.
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private readonly COMBO_WINDOW: number = 2.5;
  private lastTotalKills: number = 0;
  private score: number = 0;

  // Near-miss graze: per-enemy previous signed distance to the player plane.
  // An enemy that slips past just outside melee range is a graze.
  private grazePrevDz: Map<object, number> = new Map();
  private grazeCount: number = 0;
  private readonly GRAZE_MIN_DX: number = 3.2;
  private readonly GRAZE_MAX_DX: number = 6.0;
  private readonly GRAZE_SCORE: number = 25;

  // Haptics throttle (boss hits can land several times a second).
  private lastBossHapticAt: number = 0;

  /** Score hook for the later Systems phase: (event, value) => void. */
  public onScoreEvent: ((type: 'kill' | 'graze' | 'combo-tier', value: number) => void) | null = null;

  /** Current combo multiplier (1, 2, 3 or 5). */
  public get comboMultiplier(): number {
    return this.comboTier();
  }

  /** Current kill-streak length. */
  public get currentCombo(): number {
    return this.comboCount;
  }

  /** Total score from kills (combo-multiplied) and graze bonuses. */
  public get totalScore(): number {
    return this.score;
  }

  /** Total near-miss grazes this run. */
  public get totalGrazes(): number {
    return this.grazeCount;
  }

  // --- Phase 3: systems state ---
  private save: SaveManager;
  private currentLevel: LevelConfig = generateLevel(1);
  private isDailyRun: boolean = false;
  private runCoins: number = 0; // coins earned this run (kills + grazes)
  private peakArmy: number = 0;
  private deathZ: number = 0;
  private revived: boolean = false;
  private victoryPending: boolean = false; // boss dying, slow-mo running
  private bankedKills: number = 0;
  private armourReduction: number = 0;
  private armourCarry: number = 0; // fractional blocked casualties, carried over
  private shieldLeft: number = 0; // shield booster: casualties absorbed
  private runCannonFactor: number = 1; // 0.5 with the Extra Cannon booster
  private lastVictory: VictorySummary | null = null;
  private pendingChest: ChestReward | null = null;

  // --- Phase 3 (Doomfall failure-pays): itemised run-coin components ---
  // runCoins is the sum of these four (all coin-magnet-scaled as earned).
  // The `banked*` fields are the values at the last banking event, so a
  // defeat → revive → defeat/win run credits every coin exactly once:
  // each banking event credits only the delta since the previous one.
  private killCoins: number = 0;
  private grazeCoins: number = 0;
  private bossCoins: number = 0; // endless boss-wave lump bonuses
  private waveCoins: number = 0; // endless wave-survival awards
  private bankedKillCoins: number = 0;
  private bankedGrazeCoins: number = 0;
  private bankedBossCoins: number = 0;
  private bankedWaveCoins: number = 0;
  private bankedRunCoins: number = 0;
  private bankedKillCount: number = 0;
  private bankedGrazeCount: number = 0;
  private bankedWaveCount: number = 0;
  private bankedBossCount: number = 0;
  private lastDefeat: LastDefeat | null = null;
  private shopReturnToDefeat: boolean = false;

  // --- Phase 1 (Doomfall draft): in-run war bonuses, run-scoped only ---
  // Stack counts per bonus id; never written to save, cleared on every
  // resetLevelState (win, lose, quit, restart). Effects that scale shared
  // CONSTANTS are recomputed from the upgrade bases below, never layered
  // on top of a previous run's values.
  private draftCounts = new Map<WarBonusId, number>();
  private draftOpen: boolean = false;
  private pendingDraft: 'barrier' | 'wave' | null = null;
  private spawnedWaves = new Set<number>();
  private clearedWaves = new Set<number>();
  private baseFireRate: number = CONSTANTS.BASE_FIRE_RATE;
  private baseArrowDamage: number = CONSTANTS.BASE_ARROW_DAMAGE;
  private baseMarchSpeed: number = CONSTANTS.BASE_PLAYER_SPEED;
  private baseMaxArmy: number = CONSTANTS.BASE_MAX_SOLDIER_COUNT;
  private draftShieldCarry: number = 0; // fractional shield-wall blocks
  private burnMap = new Map<EnemyUnit, { ticksLeft: number; timer: number; dmg: number }>();
  // Pre-level selection (level id + daily flag + chosen boosters).
  private pendingLevelId: number = 1;
  private pendingIsDaily: boolean = false;
  private selectedBoosters: Set<BoosterId> = new Set();

  // --- Phase 2 (Doomfall endless): Endless Siege run state ---
  // Separate from levels: no lives consumed, no revive, no finish line.
  // The run ends only on defeat or quit. `endlessWave` is the wave being
  // fought (1-based); a wave counts as survived once it is cleared.
  private isEndless: boolean = false;
  private endlessWave: number = 1;
  private endlessWavesCleared: number = 0;
  private endlessBossKills: number = 0;
  private endlessSegmentStart: number = 0; // world z of the current wave's segment
  private endlessWaveSpawned: boolean = false;
  private endlessGateZs: number[] = []; // live gate planes, for the FOV kick

  // --- Phase 4 (Doomfall enemy types): types already introduced this run,
  // so each first-sighting banner fires exactly once per run. ---
  private announcedEnemyTypes = new Set<EnemyType>();

  // --- Phase 5 (Doomfall war-gear + fortify) ---
  // Pre-level fortify picks (one per fixed slot, null = empty). Charged
  // ONCE when the run starts (see chargePendingFortify); picking on the
  // screen costs nothing, so leaving the screen never spends coins.
  private pendingFortify: (FortifyType | null)[] = [null, null, null];
  /** The picks this run actually paid for. A pause → Restart re-spawns
   *  these (no second charge — the coins were spent at run start); a new
   *  run from the pre-level screen replaces them with fresh picks. */
  private runFortify: (FortifyType | null)[] = [null, null, null];
  // True while the pre-level screen is staging an endless run (its START
  // button launches the siege instead of a level).
  private pendingIsEndless: boolean = false;
  // Commander ability: used once per run. War horn's damage boost rides
  // hornMult so applyDraftConstants() (which recomputes ARROW_DAMAGE from
  // the upgrade + draft bases) never overwrites it mid-run.
  private commanderUsed: boolean = false;
  private hornTimer: number = 0;
  private hornMult: number = 1;
  // Fire-arrow GEAR (not the barrier reward, not the draft): gives the
  // burn DoT in applyBurn. Tracked separately so barrier fire arrows keep
  // behaving exactly as before (no burn).
  private gearFireArrows: boolean = false;

  constructor() {
    this.canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

    // WebGL Renderer Setup
    // Phase 1 (master plan): no MSAA on phones, DPR capped at 1.5 on
    // phones (2 on desktop).
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !IS_PHONE,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_PHONE ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Phase 4: auto quality scaler. Starts at level 0 (high), matching the
    // renderer setup above; steps down/up only from real gameplay frame time.
    // Phase 1 (master plan): phones start at level 1 (medium) instead —
    // startAt() does not set manualOverride, so auto-scaling keeps working.
    this.autoQuality = new AutoQualityScaler((level) => this.applyQualityLevel(level));
    if (IS_PHONE) this.autoQuality.startAt(1);

    this.scene = new THREE.Scene();

    // Initialize systems
    this.soundManager = new SoundManager();
    this.uiManager = new UIManager();
    this.cameraManager = new CameraManager(55, window.innerWidth / window.innerHeight);
    this.inputManager = new InputManager(this.canvas);
    this.particles = new ParticleSystem(this.scene);
    this.projectiles = new ProjectileManager(this.scene, this.particles, this.soundManager);
    this.environment = new FortressEnvironment(this.scene);
    this.playerArmy = new PlayerArmy(this.scene, this.projectiles, this.soundManager, this.particles);
    this.enemyArmy = new EnemyArmy(this.scene, this.particles, this.soundManager);
    this.boss = new BossEnemy(this.scene, this.particles, this.soundManager);
    this.gateManager = new GateManager(this.scene, this.soundManager, this.particles);
    this.barrierManager = new BarrierManager(this.scene, this.soundManager, this.particles);
    this.fortifications = new FortificationManager(
      this.scene,
      this.projectiles,
      this.particles,
      this.soundManager
    );
    // Phase 5: trap damage rides the enemy army's own damage path (kind
    // 'trap' ignores shield front guard, and kills pay coins through the
    // normal pipeline). Wall-break banners go through the notification UI.
    this.fortifications.damageEnemy = (enemy, damage) =>
      this.enemyArmy.applyDamage(enemy, damage, {
        kind: 'trap',
        attackerX: this.playerArmy.currentX
      });
    this.fortifications.onEvent = (text, color) =>
      this.uiManager.showNotification(text, color);

    // Phase 3: persistence + score hookup.
    this.save = new SaveManager();
    // Phase 5: the saved warband skin colours the army behind the menu.
    const savedSkin = SKIN_COLORS[this.save.equippedGearValue('skin') as SkinId] ?? SKIN_COLORS.saffron;
    SoldierModelFactory.applyPlayerSkin(savedSkin.robe, savedSkin.turban);
    this.onScoreEvent = (type) => this.handleScoreEvent(type);
    this.uiManager.onAction = (action, data) => this.handleMenuAction(action, data);

    // Load the level-1 layout behind the menu backdrop.
    this.loadLevelConfig(generateLevel(1));
    this.setupUIListeners();
    this.onWindowResize();
    this.refreshMenu();

    // Phase 0: telemetry — one session per page load; ends on hide/unload.
    this.telemetry.sessionStart();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.telemetry.sessionEnd();
      else this.telemetry.sessionResume();
    });
    window.addEventListener('pagehide', () => this.telemetry.sessionEnd());

    // Phase 1 (master plan): auto-pause when the tab is hidden mid-run.
    // A SEPARATE listener from the Phase 0 telemetry one above — this one
    // only pauses, reusing the existing pause path (pauseGame guards on
    // state === 'playing', so menu/pause/victory/defeat are untouched).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });

    // Phase 1 (master plan): no long-press context menu over the canvas.
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Phase 0: ?perf=1 live overlay (draw calls, FPS/p95, heap, quality).
    this.initPerfOverlay();

    // Lives regen ticks while the main menu is open (timestamp-based,
    // survives reload). Guarded to the start screen so it never yanks the
    // player out of the map / shop / daily screens.
    window.setInterval(() => {
      if (this.uiManager.isStartScreenActive()) this.refreshMenu();
    }, 1000);

    // Cannon impact juice lives here: shake + dust + boom + hit-stop.
    this.projectiles.onCannonImpact = (pos) => this.handleCannonImpact(pos);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  // ---------- Phase 3: level loading ----------

  /**
   * Loads a level config into the world: rebuilds gates + barriers from the
   * config, points the shared CONSTANTS at this level's arena/finish, and
   * scales the boss. PlayerArmy/Projectiles read CONSTANTS at use time, so
   * upgrade effects applied in applyUpgradeConstants() take effect here too.
   */
  private loadLevelConfig(cfg: LevelConfig) {
    this.currentLevel = cfg;
    this.gateManager.dispose();
    this.barrierManager.dispose();
    this.gateManager = new GateManager(this.scene, this.soundManager, this.particles);
    this.barrierManager = new BarrierManager(this.scene, this.soundManager, this.particles);

    cfg.gates.forEach((g) =>
      this.gateManager.createGatePair(g.z, g.leftOp, g.leftVal, g.rightOp, g.rightVal)
    );
    // F5 fix: the camera's gate FOV kick follows this level's real gates.
    this.cameraManager.setGatePositions(cfg.gates.map((g) => g.z));
    cfg.barriers.forEach((b) => this.barrierManager.spawnBarrier(b.z, b.hp, b.reward));

    CONSTANTS.BOSS_ARENA_Z = cfg.bossArenaZ;
    CONSTANTS.LEVEL_FINISH_Z = cfg.finishZ;
    this.boss.maxHealth = cfg.bossHp > 0 ? cfg.bossHp : 600;
  }

  /** Applies owned upgrades to the shared CONSTANTS before a level starts. */
  private applyUpgradeConstants() {
    const fx = computeUpgradeEffects(this.save.snapshot().upgrades);
    CONSTANTS.INITIAL_SOLDIER_COUNT = this.currentLevel.startArmy + 2 * this.save.getUpgradeLevel('army');
    CONSTANTS.FIRE_RATE_BASE = fx.fireRate;
    CONSTANTS.ARROW_DAMAGE = fx.arrowDamage;
    CONSTANTS.CANNON_COOLDOWN = fx.cannonCooldown;
    this.armourReduction = fx.armourReduction;
    // Phase 1 (Doomfall draft): remember the upgrade-derived bases so the
    // draft's multipliers recompute from these, and a run reset restores
    // CONSTANTS exactly (draft bonuses never leak into the next level).
    this.baseFireRate = fx.fireRate;
    this.baseArrowDamage = fx.arrowDamage;
    this.baseMarchSpeed = CONSTANTS.BASE_PLAYER_SPEED;
    this.baseMaxArmy = CONSTANTS.BASE_MAX_SOLDIER_COUNT;
    CONSTANTS.PLAYER_BASE_SPEED = this.baseMarchSpeed;
    CONSTANTS.MAX_SOLDIER_COUNT = this.baseMaxArmy;
  }

  private setupUIListeners() {
    // Start Button — opens the level map (menu hub).
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.soundManager.init();
      this.openMap();
    });

    // Phase 2 (Doomfall endless): one tap opens the endless pre-run
    // screen (Phase 5: fortify before the siege, like a level).
    document.getElementById('btn-menu-endless')?.addEventListener('click', () => {
      this.soundManager.init();
      this.openEndlessPreLevel();
    });

    // Menu hub buttons
    document.getElementById('btn-menu-shop')?.addEventListener('click', () => {
      // Shop from the menu returns to the menu — never to a stale defeat.
      this.shopReturnToDefeat = false;
      this.openShop();
    });
    document.getElementById('btn-menu-daily')?.addEventListener('click', () => this.openDaily());
    document.getElementById('btn-map-back')?.addEventListener('click', () => this.refreshMenu());
    // Phase 3 (Doomfall failure-pays): leaving the shop from a defeat
    // returns to that same defeat screen (fresh balance, revive re-checked).
    document.getElementById('btn-shop-back')?.addEventListener('click', () => this.shopBack());
    document.getElementById('btn-daily-back')?.addEventListener('click', () => this.refreshMenu());
    document.getElementById('btn-prelevel-back')?.addEventListener('click', () => this.openMap());
    document.getElementById('btn-prelevel-start')?.addEventListener('click', () => this.startPendingLevel());
    document.getElementById('btn-claim-daily')?.addEventListener('click', () => this.claimDaily());

    // Pause / Resume
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
    });

    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.resumeGame();
    });

    // Restart buttons
    document.getElementById('btn-restart-pause')?.addEventListener('click', () => {
      this.restartGame();
    });

    document.getElementById('btn-pause-quit')?.addEventListener('click', () => {
      this.quitToMenu();
    });

    document.getElementById('btn-defeat-retry')?.addEventListener('click', () => {
      this.retryCurrentLevel();
    });

    // Phase 3 (Doomfall failure-pays): spend the coins this loss just
    // banked — the shop returns to this same defeat screen afterwards.
    document.getElementById('btn-defeat-shop')?.addEventListener('click', () => {
      this.openShopFromDefeat();
    });

    document.getElementById('btn-defeat-map')?.addEventListener('click', () => {
      this.openMap();
    });

    document.getElementById('btn-revive')?.addEventListener('click', () => {
      this.reviveRun();
    });

    // Victory buttons
    document.getElementById('btn-victory-next')?.addEventListener('click', () => {
      this.victoryNext();
    });

    document.getElementById('btn-victory-map')?.addEventListener('click', () => {
      this.openMap();
    });

    document.getElementById('btn-victory-chest')?.addEventListener('click', () => {
      this.openChest();
    });

    document.getElementById('btn-victory-share')?.addEventListener('click', () => {
      void this.shareScore();
    });

    // Chest buttons
    document.getElementById('chest-emoji-btn')?.addEventListener('click', () => {
      this.revealChest();
    });

    document.getElementById('btn-chest-continue')?.addEventListener('click', () => {
      this.chestContinue();
    });

    document.getElementById('btn-chest-map')?.addEventListener('click', () => {
      this.revealChest();
      this.openMap();
    });

    // Sound toggle
    document.getElementById('btn-sound')?.addEventListener('click', (e) => {
      const isAudible = this.soundManager.toggleMute();
      (e.currentTarget as HTMLElement).textContent = isAudible ? '🔊' : '🔇';
    });

    // Quality toggle
    document.getElementById('btn-quality')?.addEventListener('click', (e) => {
      this.toggleQuality();
      (e.currentTarget as HTMLElement).textContent = this.isHighQuality ? '⚡' : '🔋';
    });

    // Topkhana Special Ability Button
    document.getElementById('btn-topkhana')?.addEventListener('click', () => {
      this.triggerCannonAbility();
    });

    // Phase 5 (Doomfall war-gear): commander ability button, once per run.
    document.getElementById('btn-commander')?.addEventListener('click', () => {
      this.triggerCommanderAbility();
    });
  }

  // ---------- Phase 3: menu flow ----------

  /** Refresh the main menu wallet + stats (also called by the 1s lives tick). */
  private refreshMenu() {
    this.state = 'menu';
    this.save.refreshLives();
    const s = this.save.snapshot();
    this.uiManager.updateWallet(s.coins, s.lives, this.save.timeToNextLifeMs());
    let best = 0;
    for (const v of Object.values(s.bestScore)) best = Math.max(best, v);
    this.uiManager.renderMenuStats(s.totalWins, s.winStreak, best);
    this.uiManager.renderEndlessBest(s.endlessBestWaves, s.endlessBestKills);
    this.uiManager.showStartScreen();
  }

  private quitToMenu() {
    // Phase 2 (Doomfall endless): quitting mid-run banks the best so far —
    // a quit is never a lost best. Level quits keep forfeiting run coins.
    if (this.isEndless && (this.state === 'playing' || this.state === 'paused')) {
      this.bankEndlessRun();
    }
    // Phase 5: the run's fortifications leave with it, so the menu
    // backdrop shows the bare causeway again.
    this.fortifications.clearAll();
    this.isEndless = false;
    this.uiManager.hideModals();
    this.refreshMenu();
  }

  public openMap() {
    this.save.refreshLives();
    const rows = [];
    for (let id = 1; id <= TOTAL_LEVELS; id++) {
      const cfg = generateLevel(id);
      rows.push({
        id,
        name: cfg.name,
        stars: this.save.getStars(id),
        unlocked: this.save.isUnlocked(id),
        boss: cfg.boss
      });
    }
    this.uiManager.renderMap(
      rows,
      this.save.coins,
      this.save.isDailyChallengeDone(),
      `🪙 ${COIN_AWARDS.DAILY_CHALLENGE} + 🎁 booster`
    );
    this.uiManager.showMap();
    this.state = 'menu';
  }

  public openShop() {
    const s = this.save.snapshot();
    const rows = UPGRADES.map((def) => {
      const owned = this.save.getUpgradeLevel(def.id);
      const cost = upgradeCost(def, owned);
      return { def, owned, cost, affordable: cost !== null && s.coins >= cost };
    });
    // Phase 5 (Doomfall war-gear): buy-once gear, grouped by slot in the
    // shop's gear section (rendered under the 5 upgrade tracks).
    const gearRows: GearRow[] = GEAR.map((def) => ({
      def,
      owned: this.save.ownsGear(def.id),
      equipped: this.save.equippedGearValue(def.slot) === def.value,
      affordable: s.coins >= def.cost
    }));
    this.uiManager.renderShop(rows, s.coins, gearRows);
    this.uiManager.showShop();
    // Phase 3 (Doomfall failure-pays): the back button says where it goes.
    // buyUpgrade re-renders the shop through openShop, so the flag survives
    // a purchase and the player still returns to their defeat screen.
    const backBtn = document.getElementById('btn-shop-back');
    if (backBtn) {
      backBtn.textContent = this.shopReturnToDefeat ? '← BACK TO DEFEAT' : '← BACK TO MENU';
    }
    this.state = 'menu';
  }

  /**
   * Phase 3 (Doomfall failure-pays): opens the shop from a defeat screen.
   * The shop's back button returns to that same defeat screen (fresh coin
   * balance, revive affordability re-checked) instead of the main menu.
   */
  public openShopFromDefeat() {
    if (!this.lastDefeat) {
      this.shopReturnToDefeat = false;
      this.openShop();
      return;
    }
    this.shopReturnToDefeat = true;
    this.openShop();
  }

  /** Shop back button: to the defeat screen when the shop came from one. */
  private shopBack() {
    if (this.shopReturnToDefeat && this.lastDefeat) {
      this.returnToDefeat();
      return;
    }
    this.shopReturnToDefeat = false;
    this.refreshMenu();
  }

  /**
   * Re-shows the stored defeat screen after a shop visit. The breakdown is
   * what that defeat banked (unchanged by shopping); the balance is re-read
   * live, and the level revive offer is re-checked against it, so coins
   * spent in the shop show up immediately.
   */
  private returnToDefeat() {
    const d = this.lastDefeat;
    if (!d) {
      this.refreshMenu();
      return;
    }
    this.state = 'defeat';
    this.uiManager.hideModals();
    if (d.kind === 'endless') {
      this.uiManager.showEndlessDefeat({
        waves: d.waves,
        kills: d.kills,
        coins: d.breakdown.total,
        bestWaves: d.bestWaves,
        newBest: d.newBest,
        breakdown: d.breakdown,
        newBalance: this.save.coins
      });
    } else {
      this.uiManager.showDefeat(d.progressPct, d.kills, {
        score: d.score,
        reviveCost: d.reviveCost,
        canRevive: !this.revived && this.save.coins >= d.reviveCost,
        breakdown: d.breakdown,
        newBalance: this.save.coins
      });
    }
  }

  public openDaily() {
    this.save.ensureMissions();
    this.uiManager.renderDaily(
      this.save.dailyStreak,
      this.save.canClaimDaily(),
      this.save.missions
    );
    this.uiManager.showDaily();
    this.state = 'menu';
  }

  private dailyBaseLevel(): number {
    return Math.min(TOTAL_LEVELS, Math.max(1, this.save.highestCleared()));
  }

  public openPreLevel(levelId: number, isDaily: boolean) {
    const cfg = isDaily
      ? generateLevel(this.dailyBaseLevel(), dailyChallengeSeed(todayKey()))
      : generateLevel(levelId);
    this.pendingLevelId = levelId;
    this.pendingIsDaily = isDaily;
    this.pendingIsEndless = false;
    this.pendingFortify = [null, null, null];
    this.selectedBoosters = new Set();
    this.renderPreLevel(cfg, isDaily);
    this.uiManager.showPreLevel();
    this.state = 'menu';
  }

  /**
   * Phase 5 (Doomfall fortify): the endless pre-run screen — same
   * pre-level screen as levels (fortify slots included, boosters omitted:
   * endless runs never used boosters), with its own title and info line.
   * START launches the siege instead of a level.
   */
  public openEndlessPreLevel() {
    this.pendingIsEndless = true;
    this.pendingFortify = [null, null, null];
    this.selectedBoosters = new Set();
    this.renderEndlessPreLevel();
    this.uiManager.showPreLevel();
    this.state = 'menu';
  }

  /** Re-renders the endless pre-run screen without clearing the picks
   *  (fortify taps re-render through here). */
  private renderEndlessPreLevel() {
    this.uiManager.renderPreLevel(
      endlessLevelConfig(),
      0,
      0,
      [],
      this.save.coins,
      false,
      this.fortifyRows(),
      fortifyCost(this.pendingFortify),
      '♾️ ENDLESS SIEGE — FORTIFY & MARCH',
      'Survive as many waves as you can · Boss every 5 waves · No lives used · Fortifications rebuild ahead as you march'
    );
  }

  private renderPreLevel(cfg: LevelConfig, isDaily: boolean) {
    // Phase 5: an endless staging re-renders the endless screen (same
    // fortify slots, no boosters) instead of a level screen.
    if (this.pendingIsEndless) {
      this.renderEndlessPreLevel();
      return;
    }
    const levelId = isDaily ? this.dailyBaseLevel() : cfg.id;
    const boosters = BOOSTERS.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      desc: b.desc,
      cost: b.cost,
      owned: this.save.boosterCount(b.id),
      selected: this.selectedBoosters.has(b.id)
    }));
    this.uiManager.renderPreLevel(
      cfg,
      this.save.getStars(levelId),
      this.save.getBestScore(levelId),
      boosters,
      this.save.coins,
      isDaily,
      this.fortifyRows(),
      fortifyCost(this.pendingFortify)
    );
  }

  /**
   * Phase 5 (Doomfall fortify): one row per fixed slot for the pre-level
   * screen — the picked type (or empty) plus whether each type still fits
   * the wallet after the other slots' picks.
   */
  private fortifyRows(): FortifySlotRow[] {
    const total = fortifyCost(this.pendingFortify);
    return this.pendingFortify.map((picked, slot) => {
      const affordable = {} as Record<FortifyType, boolean>;
      for (const f of FORTIFY_DEFS) {
        const costWithoutSlot = total - (picked ? fortifyDef(picked).cost : 0);
        affordable[f.type] = this.save.coins >= costWithoutSlot + f.cost;
      }
      return { slot, picked, affordable };
    });
  }

  /** Tap a fortify type for a slot: select it (tap again to clear). The
   *  wallet check counts the other slots' picks, so the total can never
   *  exceed the coins on hand. Nothing is spent here — see
   *  chargePendingFortify, which charges once at START. */
  private fortifyPick(slot: number, type: FortifyType) {
    if (slot < 0 || slot >= this.pendingFortify.length) return;
    if (this.pendingFortify[slot] === type) {
      this.pendingFortify[slot] = null;
    } else {
      const total = fortifyCost(this.pendingFortify);
      const current = this.pendingFortify[slot];
      const costWithoutSlot = total - (current ? fortifyDef(current).cost : 0);
      if (this.save.coins < costWithoutSlot + fortifyDef(type).cost) {
        this.uiManager.showNotification(
          `🪙 NOT ENOUGH COINS — NEED ${fortifyDef(type).cost}`,
          '#ef4444'
        );
        return;
      }
      this.pendingFortify[slot] = type;
    }
    const cfg = this.pendingIsDaily
      ? generateLevel(this.dailyBaseLevel(), dailyChallengeSeed(todayKey()))
      : generateLevel(this.pendingLevelId);
    this.renderPreLevel(cfg, this.pendingIsDaily);
  }

  /**
   * Phase 5 (Doomfall fortify): charges the run's fortify picks ONCE, at
   * run start, through the one existing coin-spend path — never a second
   * ledger, so Phase 3's exactly-once banking is untouched. Returns false
   * (spending nothing) when the wallet can't cover the picks, and the run
   * does not start.
   */
  private chargePendingFortify(): boolean {
    const total = fortifyCost(this.pendingFortify);
    if (total <= 0) return true;
    if (!this.save.spendCoins(total)) {
      this.uiManager.showNotification(
        `🪙 NOT ENOUGH COINS FOR FORTIFY — NEED ${total}`,
        '#ef4444'
      );
      return false;
    }
    return true;
  }

  /**
   * Phase 5 (Doomfall war-gear): one tap buys AND equips unowned gear
   * (coins through the existing spend path); tapping owned gear just
   * equips it for free. Skins recolour the army immediately, so the
   * change is visible behind the menu without starting a run.
   */
  private gearAction(id: string) {
    if (!id) return;
    const def = gearDef(id);
    if (!def) return;
    if (!this.save.ownsGear(id)) {
      if (def.cost > 0 && !this.save.spendCoins(def.cost)) {
        this.uiManager.showNotification(`🪙 NOT ENOUGH COINS — NEED ${def.cost}`, '#ef4444');
        return;
      }
      this.save.markGearOwned(id);
      this.save.equipGear(def.slot, def.value);
      this.uiManager.showNotification(`⚔️ ${def.name.toUpperCase()} BOUGHT & EQUIPPED!`, '#4ade80');
    } else {
      this.save.equipGear(def.slot, def.value);
      this.uiManager.showNotification(`⚔️ ${def.name.toUpperCase()} EQUIPPED!`, '#4ade80');
    }
    if (def.slot === 'skin') {
      const colors = SKIN_COLORS[def.value as SkinId];
      SoldierModelFactory.applyPlayerSkin(colors.robe, colors.turban);
    }
    this.openShop();
  }

  private handleMenuAction(action: string, data: DOMStringMap) {
    switch (action) {
      case 'select-level':
        this.openPreLevel(Number(data.id), false);
        break;
      case 'daily-challenge':
        this.openPreLevel(this.dailyBaseLevel(), true);
        break;
      case 'buy-upgrade':
        this.buyUpgrade(data.id as UpgradeId);
        break;
      case 'gear-action':
        this.gearAction(data.id ?? '');
        break;
      case 'fortify-pick':
        this.fortifyPick(Number(data.slot), data.type as FortifyType);
        break;
      case 'toggle-booster':
        this.toggleBooster(data.id as BoosterId);
        break;
      case 'claim-mission':
        this.claimMission(Number(data.index));
        break;
      case 'draft-pick':
        this.pickDraftBonus(data.id as WarBonusId);
        break;
      default:
        break;
    }
  }

  private buyUpgrade(id: UpgradeId) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return;
    const owned = this.save.getUpgradeLevel(id);
    const cost = upgradeCost(def, owned);
    if (cost === null) {
      this.uiManager.showNotification('⭐ ALREADY MAXED!', '#fde047');
      return;
    }
    if (!this.save.spendCoins(cost)) {
      this.uiManager.showNotification(`🪙 NOT ENOUGH COINS — NEED ${cost}`, '#ef4444');
      return;
    }
    this.save.setUpgradeLevel(id, owned + 1);
    this.uiManager.showNotification(`⬆️ ${def.name.toUpperCase()} → LEVEL ${owned + 1}!`, '#4ade80');
    this.openShop();
  }

  /** Tap a booster: select owned one, or buy-and-select if affordable. */
  private toggleBooster(id: BoosterId) {
    if (this.selectedBoosters.has(id)) {
      this.selectedBoosters.delete(id);
    } else if (this.save.boosterCount(id) > 0) {
      this.selectedBoosters.add(id);
    } else {
      const def = BOOSTERS.find((b) => b.id === id)!;
      if (!this.save.spendCoins(def.cost)) {
        this.uiManager.showNotification(`🪙 NOT ENOUGH COINS — NEED ${def.cost}`, '#ef4444');
        return;
      }
      this.save.addBooster(id, 1);
      this.selectedBoosters.add(id);
      this.uiManager.showNotification(`🎁 ${def.name.toUpperCase()} BOUGHT & READY!`, '#4ade80');
    }
    const cfg = this.pendingIsDaily
      ? generateLevel(this.dailyBaseLevel(), dailyChallengeSeed(todayKey()))
      : generateLevel(this.pendingLevelId);
    this.renderPreLevel(cfg, this.pendingIsDaily);
  }

  private claimDaily() {
    const reward = this.save.claimDaily();
    if (!reward) {
      this.uiManager.showNotification('✅ ALREADY CLAIMED TODAY!', '#fde047');
      return;
    }
    this.uiManager.showNotification(`🎁 DAILY REWARD: ${reward.label.toUpperCase()}!`, '#4ade80');
    this.openDaily();
  }

  private claimMission(index: number) {
    const paid = this.save.claimMission(index);
    if (paid > 0) {
      this.uiManager.showNotification(`🎯 MISSION DONE — 🪙 +${paid}!`, '#4ade80');
    }
    this.openDaily();
  }

  // ---------- Phase 3: run start / end ----------

  /**
   * Starts a level. Lives gate: 0 lives blocks starting. Upgrades are applied
   * to CONSTANTS, selected boosters are consumed from inventory, and the
   * level config is loaded fresh. Phase 5: fortify picks are charged once
   * here (chargePendingFortify) and the pieces spawn after the run reset.
   * Returns false when the run did not start (no lives / can't pay fortify).
   */
  public startGame(levelId: number, isDaily: boolean = false): boolean {
    this.isEndless = false;
    this.save.refreshLives();
    if (this.save.lives <= 0) {
      this.uiManager.showNotification('❤️ OUT OF LIVES — WAIT FOR THE NEXT ONE!', '#ef4444');
      this.openMap();
      return false;
    }
    if (!this.chargePendingFortify()) return false;
    const isFirstEverRun = this.save.snapshot().gamesPlayed === 0;
    const cfg = isDaily
      ? generateLevel(this.dailyBaseLevel(), dailyChallengeSeed(todayKey()))
      : generateLevel(levelId);

    this.isDailyRun = isDaily;
    this.loadLevelConfig(cfg);
    this.applyUpgradeConstants();
    this.soundManager.init();
    this.uiManager.hideModals();
    this.resetLevelState();
    // Phase 5: the paid fortify picks spawn on their fixed slots now that
    // the run state is clean; the picks are consumed by this run.
    this.runFortify = [...this.pendingFortify];
    this.fortifications.spawnPicks(this.runFortify);
    this.enemyArmy.fortWalls = this.fortifications.walls;
    this.pendingFortify = [null, null, null];
    this.state = 'playing';
    this.save.recordGamePlayed();

    // Consume selected boosters (from inventory) for this run.
    if (this.selectedBoosters.has('warriors')) {
      if (this.save.useBooster('warriors')) {
        this.playerArmy.addWarriors(10);
        this.uiManager.updateArmyCount(this.playerArmy.count);
      }
    }
    if (this.selectedBoosters.has('shield')) {
      if (this.save.useBooster('shield')) {
        this.shieldLeft = 10;
        this.uiManager.showNotification('🛡️ BATTLE SHIELD — ABSORBS 10 HITS!', '#38bdf8');
      }
    }
    if (this.selectedBoosters.has('cannon')) {
      if (this.save.useBooster('cannon')) {
        this.runCannonFactor = 0.5;
        this.cannonCooldownTimer = 0;
      }
    }
    this.peakArmy = this.playerArmy.count;
    this.selectedBoosters = new Set();

    // FTUE: level 1 is a guaranteed win — generous gates, weak waves, plus a
    // free first-battle shield and steering hints via the notification system.
    if (isFirstEverRun && cfg.id === 1) {
      this.shieldLeft = Math.max(this.shieldLeft, 10);
      this.uiManager.showNotification('🛡️ FIRST-BATTLE SHIELD — ABSORBS 10 HITS!', '#38bdf8');
      window.setTimeout(() => {
        if (this.state === 'playing') this.uiManager.showNotification('👆 DRAG TO STEER — AIM FOR THE BLUE GATES!', '#38bdf8');
      }, 2500);
      window.setTimeout(() => {
        if (this.state === 'playing') this.uiManager.showNotification('🛡️ BLUE GATES ADD WARRIORS — GOLD MULTIPLIES THEM!', '#f59e0b');
      }, 8000);
      window.setTimeout(() => {
        if (this.state === 'playing') this.uiManager.showNotification('🏹 YOUR ARMY FIRES ON ITS OWN — JUST STEER!', '#fef08a');
      }, 14000);
    }
    // Phase 0: telemetry — run attempt (army after upgrades + boosters).
    this.runStartMs = performance.now();
    this.telemetry.attempt({
      levelId: cfg.id,
      isDaily,
      isEndless: false,
      startArmy: this.playerArmy.count
    });
    return true;
  }

  private startPendingLevel() {
    // Phase 5: the pre-level screen stages either a level or an endless
    // run; a failed fortify charge leaves the screen open.
    if (this.pendingIsEndless) {
      this.startEndless();
      return;
    }
    this.startGame(this.pendingLevelId, this.pendingIsDaily);
  }

  /**
   * Phase 2 (Doomfall endless): starts an Endless Siege run. One tap from
   * the main menu — no lives gate (endless never consumes level-map lives),
   * no pre-level screen, no boosters, no FTUE hints. Upgrades apply, the
   * war-bonus draft fires after every wave clear, and the run ends only on
   * defeat or quit. Phase 3: an endless run does NOT count toward
   * gamesPlayed — FTUE triggers on level runs only, so a player's very
   * first run ever being endless no longer skips the level-1 hints on
   * their first level run.
   */
  public startEndless(): boolean {
    this.isEndless = true;
    this.isDailyRun = false;
    if (!this.chargePendingFortify()) return false;
    this.loadLevelConfig(endlessLevelConfig());
    this.applyUpgradeConstants();
    this.soundManager.init();
    this.uiManager.hideModals();
    this.resetLevelState();
    // Phase 5: the paid fortify picks spawn on their fixed slots; in the
    // siege they rebuild ahead of the march (see updateEndless).
    this.runFortify = [...this.pendingFortify];
    this.fortifications.spawnPicks(this.runFortify);
    this.enemyArmy.fortWalls = this.fortifications.walls;
    this.pendingFortify = [null, null, null];
    this.state = 'playing';
    this.selectedBoosters = new Set();
    this.uiManager.showNotification('♾️ ENDLESS SIEGE — SURVIVE AS MANY WAVES AS YOU CAN!', '#f59e0b');
    // Phase 0: telemetry — siege attempt (levelId -1 = endless, not a level).
    this.runStartMs = performance.now();
    this.telemetry.attempt({ levelId: -1, isEndless: true, startArmy: this.playerArmy.count });
    return true;
  }

  private retryCurrentLevel() {
    // Phase 2 (Doomfall endless): retrying an endless run restarts the
    // siege — no lives check, endless never touches the lives system.
    if (this.isEndless) {
      this.startEndless();
      return;
    }
    this.save.refreshLives();
    if (this.save.lives <= 0) {
      this.uiManager.showNotification('❤️ OUT OF LIVES — WAIT FOR THE NEXT ONE!', '#ef4444');
      this.openMap();
      return;
    }
    this.startGame(this.currentLevel.id, this.isDailyRun);
  }

  public pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    // Phase 2 (Doomfall endless): pause buttons say what they do in a siege.
    const quitBtn = document.getElementById('btn-pause-quit');
    if (quitBtn) quitBtn.textContent = this.isEndless ? 'QUIT TO MENU' : 'QUIT TO MAP';
    const restartBtn = document.getElementById('btn-restart-pause');
    if (restartBtn) restartBtn.textContent = this.isEndless ? 'RESTART SIEGE' : 'RESTART LEVEL';
    this.uiManager.showPause(true);
  }

  public resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.uiManager.showPause(false);
  }

  public restartGame() {
    this.uiManager.hideModals();
    // Phase 2 (Doomfall endless): a siege restart needs a fresh causeway —
    // the run spawns gates/barriers dynamically, so reload the stripped
    // endless config (fresh managers) before resetting run state.
    if (this.isEndless) this.loadLevelConfig(endlessLevelConfig());
    this.resetLevelState();
    // Phase 5: a restart is the same paid run, not a new purchase — the
    // fortifications come back (no second charge).
    this.fortifications.spawnPicks(this.runFortify);
    this.enemyArmy.fortWalls = this.fortifications.walls;
    this.state = 'playing';
  }

  private resetLevelState() {
    this.playerArmy.reset();
    this.enemyArmy.clearAll();
    this.boss.reset();
    this.gateManager.reset();
    this.barrierManager.reset();
    this.inputManager.reset();
    this.cannonCooldownTimer = 0;
    this.bossEncounterTriggered = false;
    this.enemyWavesSpawned = {};

    this.cameraManager.setBossMode(false);
    this.soundManager.setBossMode(false);
    this.uiManager.showBossHUD(false);
    this.uiManager.updateArmyCount(this.playerArmy.count);
    this.refreshDraftBuffs();
    this.uiManager.updateCannonCooldown(0);
    this.uiManager.updateScore(0, 0, 1);
    this.uiManager.updateRunCoins(0);

    // Phase 2 state reset
    this.timeScale = 1;
    this.hitStopTimer = 0;
    this.slowMoTimer = 0;
    this.scaledTime = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.lastTotalKills = 0;
    this.score = 0;
    this.grazePrevDz.clear();
    this.grazeCount = 0;
    this.lastBossHapticAt = 0;

    // Phase 3 run state reset
    this.runCoins = 0;
    this.peakArmy = this.playerArmy.count;
    this.deathZ = 0;
    this.revived = false;
    this.victoryPending = false;
    this.bankedKills = 0;
    this.armourCarry = 0;
    this.shieldLeft = 0;
    this.runCannonFactor = 1;
    this.lastVictory = null;
    this.pendingChest = null;

    // Phase 3 (Doomfall failure-pays): itemised coin components and their
    // banked watermarks reset with the run; a fresh run has no defeat to
    // return to from the shop.
    this.killCoins = 0;
    this.grazeCoins = 0;
    this.bossCoins = 0;
    this.waveCoins = 0;
    this.bankedKillCoins = 0;
    this.bankedGrazeCoins = 0;
    this.bankedBossCoins = 0;
    this.bankedWaveCoins = 0;
    this.bankedRunCoins = 0;
    this.bankedKillCount = 0;
    this.bankedGrazeCount = 0;
    this.bankedWaveCount = 0;
    this.bankedBossCount = 0;
    this.lastDefeat = null;
    this.shopReturnToDefeat = false;

    // Phase 1 (Doomfall draft): run-scoped bonuses are gone when the run
    // ends — win, lose, quit or restart. Nothing is persisted to save.
    this.draftCounts.clear();
    this.draftShieldCarry = 0;
    this.burnMap.clear();
    this.pendingDraft = null;
    this.draftOpen = false;
    this.spawnedWaves.clear();
    this.clearedWaves.clear();
    this.applyDraftConstants();
    this.uiManager.hideDraft();

    // Phase 2 (Doomfall endless): siege state resets with the run; a fresh
    // endless run (or a siege restart) arms segment 1 immediately.
    this.endlessWave = 1;
    this.endlessWavesCleared = 0;
    this.endlessBossKills = 0;
    this.endlessSegmentStart = 0;
    this.endlessWaveSpawned = false;
    this.endlessGateZs = [];
    this.uiManager.updateWaveChip(0, false);
    if (this.isEndless) this.armEndlessSegment();

    // Phase 4 (Doomfall enemy types): first-sighting banners re-arm per run.
    this.announcedEnemyTypes.clear();

    // Phase 5 (Doomfall war-gear + fortify): fortifications are per-run —
    // the pieces leave with the run (a fresh run spawns its own picks) —
    // and the commander ability re-arms. The equipped gear loadout is
    // (re-)applied here so restarts get the same loadout as run start.
    this.fortifications.clearAll();
    this.commanderUsed = false;
    this.hornTimer = 0;
    this.hornMult = 1;
    this.gearFireArrows = false;
    this.applyGearLoadout();
  }

  /**
   * Phase 5 (Doomfall war-gear): applies the saved equipped loadout to
   * this run — arrow type flags on the army, cannon damage/splash/cooldown
   * on the shared CONSTANTS (restored from the upgrade bases first, so a
   * variant never stacks on a previous run's values), warband skin colours
   * on the shared soldier materials, and the commander button. Called on
   * every run reset, so restarts match run starts.
   */
  private applyGearLoadout() {
    const arrow = this.save.equippedGearValue('arrow');
    const cannon = this.save.equippedGearValue('cannon');
    const commander = this.save.equippedGearValue('commander');
    const skin = this.save.equippedGearValue('skin') as SkinId;

    // Arrows: exactly one type active. Fire also arms the gear burn DoT
    // (applyBurn); piercing and volley ride their own army flags.
    this.gearFireArrows = arrow === 'fire';
    this.playerArmy.isFlamingArrows = arrow === 'fire';
    this.playerArmy.isPiercingArrows = arrow === 'piercing';
    this.playerArmy.volleyExtraArrows = arrow === 'volley' ? 2 : 0;

    // Cannon: damage + splash are CONSTANTS read at spawn time; cooldown
    // rides runCannonFactor (already reset to 1 above, boosters and the
    // draft multiply it further after this). Values are set from the base
    // 160 / 5.5 every run, never scaled off a previous run's value.
    if (cannon === 'rapid') {
      CONSTANTS.CANNON_DAMAGE = 144;
      CONSTANTS.CANNON_SPLASH_RADIUS = 5.5;
      this.runCannonFactor *= 0.7;
    } else if (cannon === 'siege') {
      CONSTANTS.CANNON_DAMAGE = 240;
      CONSTANTS.CANNON_SPLASH_RADIUS = 8;
      this.runCannonFactor *= 1.25;
    } else {
      CONSTANTS.CANNON_DAMAGE = 160;
      CONSTANTS.CANNON_SPLASH_RADIUS = 5.5;
    }

    // Skin: shared materials, so the whole warband recolours at once.
    const colors = SKIN_COLORS[skin] ?? SKIN_COLORS.saffron;
    SoldierModelFactory.applyPlayerSkin(colors.robe, colors.turban);

    // Commander: the HUD button shows only while an ability is equipped.
    if (commander === 'warhorn') {
      this.uiManager.showCommanderButton('📯', 'WAR HORN');
    } else if (commander === 'rally') {
      this.uiManager.showCommanderButton('🚩', 'RALLY');
    } else {
      this.uiManager.hideCommanderButton();
    }
    this.refreshDraftBuffs();
  }

  /**
   * Phase 5 (Doomfall war-gear): commander ability, once per run. War
   * horn: +50% arrow damage for 10s (hornMult, so draft recomputes keep
   * it). Rally banner: 15 fresh warriors join right now.
   */
  private triggerCommanderAbility() {
    if (this.state !== 'playing' || this.commanderUsed) return;
    const commander = this.save.equippedGearValue('commander');
    if (commander === 'warhorn') {
      this.commanderUsed = true;
      this.hornMult = 1.5;
      this.hornTimer = 10;
      this.applyDraftConstants();
      this.uiManager.setCommanderUsed(true);
      this.uiManager.showNotification('📯 WAR HORN! +50% ARROW DAMAGE FOR 10s!', '#fde047');
      this.soundManager.playGateChime(3);
    } else if (commander === 'rally') {
      this.commanderUsed = true;
      this.playerArmy.addWarriors(15);
      this.uiManager.updateArmyCount(this.playerArmy.count);
      this.uiManager.setCommanderUsed(true);
      this.uiManager.showNotification('🚩 RALLY BANNER! +15 WARRIORS JOIN THE MARCH!', '#4ade80');
      this.soundManager.playGateChime(3);
    }
    this.refreshDraftBuffs();
    this.vibrate(40);
  }

  /** HUD buff pills for the equipped gear (non-default items only). */
  private gearLabels(): string[] {
    const labels: string[] = [];
    const arrow = this.save.equippedGearValue('arrow');
    if (arrow === 'piercing') labels.push('🎯 PIERCING ARROWS');
    else if (arrow === 'volley') labels.push('🌧️ VOLLEY ARROWS');
    const cannon = this.save.equippedGearValue('cannon');
    if (cannon === 'rapid') labels.push('⚡ RAPID CANNON');
    else if (cannon === 'siege') labels.push('🏰 SIEGE CANNON');
    const commander = this.save.equippedGearValue('commander');
    if (commander === 'warhorn') {
      labels.push(this.commanderUsed ? '📯 WAR HORN USED' : '📯 WAR HORN READY');
    } else if (commander === 'rally') {
      labels.push(this.commanderUsed ? '🚩 RALLY USED' : '🚩 RALLY READY');
    }
    return labels;
  }

  /**
   * Applies a quality level to the renderer. Shared by the manual toggle
   * and the auto scaler, so both paths produce identical renderer state.
   * Level 0 = high (shadows on, DPR cap 2), 1 = medium, 2 = low (DPR 1).
   */
  private applyQualityLevel(level: QualityLevel) {
    const settings = QUALITY_SETTINGS[level];
    this.isHighQuality = level === 0;
    this.renderer.shadowMap.enabled = settings.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatioCap));
  }

  private toggleQuality() {
    // Manual pick wins: once the player toggles, the auto scaler stands
    // down for the session and never overrides their choice.
    this.autoQuality.setManual(this.isHighQuality ? 2 : 0);
  }

  // ---------- Phase 2: time scale (hit-stop + slow-mo) ----------

  /** Brief freeze (~60-90ms) on big hits. Time-scale dip, never a thread block. */
  private triggerHitStop(durationMs: number) {
    this.hitStopTimer = Math.max(this.hitStopTimer, durationMs / 1000);
  }

  /** Slow motion: scale ~0.3 for `duration` seconds, then eases back to 1. */
  private triggerSlowMo(duration: number, scale: number = 0.3) {
    this.slowMoTimer = Math.max(this.slowMoTimer, duration);
    this.slowMoScale = scale;
  }

  /** Advances timers in real time and eases timeScale toward its target. */
  private updateTimeScale(rawDt: number) {
    if (this.hitStopTimer > 0) this.hitStopTimer -= rawDt;
    if (this.slowMoTimer > 0) this.slowMoTimer -= rawDt;

    const target = this.hitStopTimer > 0 ? 0 : this.slowMoTimer > 0 ? this.slowMoScale : 1;
    // Snap down fast (punch), ease back up slowly (recovery).
    const rate = target < this.timeScale ? 30 : 3.5;
    this.timeScale += (target - this.timeScale) * (1 - Math.exp(-rate * rawDt));
    if (Math.abs(this.timeScale - target) < 0.005) this.timeScale = target;
  }

  // ---------- Phase 2: haptics ----------

  /** Guarded vibrate: gameplay only, never in menus, muted = silent, desktop = no-op. */
  private vibrate(pattern: number | number[]) {
    if (this.state !== 'playing') return;
    if (this.soundManager.isMuted()) return;
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibration unsupported or denied — feel is optional.
    }
  }

  // ---------- Phase 2: combo / kill streak ----------

  private comboTier(): number {
    if (this.comboCount >= 10) return 5;
    if (this.comboCount >= 6) return 3;
    if (this.comboCount >= 3) return 2;
    return 1;
  }

  /** Called once per real kill (polled from EnemyArmy.totalKills). */
  private registerKill() {
    const prevTier = this.comboTier();
    this.comboCount++;
    this.comboTimer = this.COMBO_WINDOW;

    const tier = this.comboTier();
    this.score += 10 * tier;
    this.onScoreEvent?.('kill', 10 * tier);

    if (tier > prevTier) {
      const front = this.playerArmy.getFrontPosition();
      this.particles.spawnFloatingText(
        front.clone().add(new THREE.Vector3(0, 4.5, 4)),
        `COMBO x${tier}!`,
        'combo'
      );
      this.soundManager.playComboUp(tier);
      this.uiManager.showNotification(`🔥 COMBO x${tier}!`, '#fde047');
      this.onScoreEvent?.('combo-tier', tier);
    }
  }

  // ---------- Phase 2: near-miss graze ----------

  /**
   * Phase 4: first time a new enemy type appears in this run, banner what
   * it does — once per type per run, so it teaches without nagging.
   */
  private announceNewEnemyTypes() {
    for (const e of this.enemyArmy.enemies) {
      if (!e.active || e.type === 'regular') continue;
      if (this.announcedEnemyTypes.has(e.type)) continue;
      this.announcedEnemyTypes.add(e.type);
      this.uiManager.showNotification(ENEMY_TYPE_INTRO[e.type], '#f59e0b');
    }
  }

  /**
   * Named graze hook for the Systems phase: awards the bonus for an enemy
   * soldier slipping past just outside melee range. Also fires onScoreEvent.
   */
  public awardGrazeBonus(position: THREE.Vector3) {
    this.grazeCount++;
    this.score += this.GRAZE_SCORE;
    this.particles.spawnFloatingText(
      position.clone().add(new THREE.Vector3(0, 2.5, 0)),
      `GRAZE +${this.GRAZE_SCORE}`,
      'graze'
    );
    this.soundManager.playGraze();
    this.onScoreEvent?.('graze', this.GRAZE_SCORE);
  }

  /** Scans live enemies for a plane-crossing just outside melee range. */
  private scanGraze(playerPos: THREE.Vector3) {
    const enemies = this.enemyArmy.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active) {
        this.grazePrevDz.delete(e);
        continue;
      }
      const dz = e.position.z - playerPos.z;
      const prevDz = this.grazePrevDz.get(e);
      if (prevDz !== undefined && prevDz > 0 && dz <= 0) {
        // Crossed the player plane this frame without clashing.
        const dx = Math.abs(e.position.x - playerPos.x);
        if (dx >= this.GRAZE_MIN_DX && dx <= this.GRAZE_MAX_DX) {
          this.awardGrazeBonus(e.position);
        }
      }
      this.grazePrevDz.set(e, dz);
    }
  }

  // ---------- Phase 2: cannon impact ----------

  private handleCannonImpact(pos: THREE.Vector3) {
    if (this.state !== 'playing') return;
    const groundPos = new THREE.Vector3(pos.x, Math.max(0.3, pos.y), pos.z);
    this.cameraManager.shake(0.9, 0.6);
    this.particles.spawnDustBurst(groundPos, 24);
    this.particles.spawnSparks(groundPos, 8, 0xf97316);
    this.soundManager.playCannonImpact();
    this.triggerHitStop(70);
    this.vibrate(60);
  }

  public triggerCannonAbility() {
    if (this.state !== 'playing' || this.cannonCooldownTimer > 0) return;

    this.cannonCooldownTimer = CONSTANTS.CANNON_COOLDOWN * this.runCannonFactor;
    this.cameraManager.shake(0.8, 0.5);
    this.vibrate(40);

    // Fire 3 Royal Bronze Cannonballs along the road ahead
    const front = this.playerArmy.getFrontPosition();
    const targets = [
      new THREE.Vector3(front.x - 2.5, 0, front.z + 18),
      new THREE.Vector3(front.x, 0, front.z + 24),
      new THREE.Vector3(front.x + 2.5, 0, front.z + 18)
    ];

    targets.forEach((targetPos, idx) => {
      setTimeout(() => {
        const startPos = new THREE.Vector3(
          front.x + (idx - 1) * 3.0,
          2.0,
          front.z - 4.0
        );
        this.projectiles.spawnCannonball(startPos, targetPos);
      }, idx * 120);
    });

    this.uiManager.showNotification('💣 TOPKHANA CANNON BOMBARDMENT!', '#f59e0b');
  }

  // ---------- Phase 3: score hook -> coins, missions, HUD ----------

  /** Every real kill/graze pays coins and feeds missions; HUD stays live. */
  private handleScoreEvent(type: 'kill' | 'graze' | 'combo-tier') {
    this.uiManager.updateScore(this.score, this.comboCount, this.comboTier());
    // Phase 1 (Doomfall draft): coin magnet multiplies run coin earnings.
    // Phase 3 (failure-pays): the same amounts are tracked per source, so
    // the defeat screen can itemise exactly what the run earned.
    const coinMult = this.coinMultiplier();
    if (type === 'kill') {
      const earned = Math.round(COIN_AWARDS.KILL * coinMult);
      this.runCoins += earned;
      this.killCoins += earned;
      this.save.recordMission('kill');
      this.uiManager.updateRunCoins(this.runCoins);
    } else if (type === 'graze') {
      const earned = Math.round(COIN_AWARDS.GRAZE * coinMult);
      this.runCoins += earned;
      this.grazeCoins += earned;
      this.save.recordMission('graze');
      this.uiManager.updateRunCoins(this.runCoins);
    }
  }

  /**
   * Casualty reduction: the shield booster absorbs hits first, then armour
   * blocks a fraction of what remains (fractional blocks carry over, so a
   * 10% armour really does save every 10th single casualty).
   */
  private applyCasualtyLoss(raw: number): number {
    let remaining = raw;
    if (this.shieldLeft > 0 && remaining > 0) {
      const absorbed = Math.min(this.shieldLeft, remaining);
      this.shieldLeft -= absorbed;
      remaining -= absorbed;
      this.uiManager.showNotification(`🛡️ SHIELD ABSORBED ${absorbed}!`, '#38bdf8');
    }
    if (remaining > 0 && this.armourReduction > 0) {
      this.armourCarry += remaining * this.armourReduction;
      const blocked = Math.floor(this.armourCarry);
      this.armourCarry -= blocked;
      if (blocked > 0) {
        this.uiManager.showNotification(`⛓️ ARMOUR BLOCKED ${blocked}!`, '#94a3b8');
      }
      remaining -= blocked;
    }
    // Phase 1 (Doomfall draft): shield wall — each stack cuts casualties
    // by a further 30% (multiplicative: 0.7^stacks). Fractional blocks
    // carry over, like armour, so small clashes still benefit over time.
    const wallStacks = this.draftStacks('shield_wall');
    if (remaining > 0 && wallStacks > 0) {
      const reduction = 1 - Math.pow(0.7, wallStacks);
      this.draftShieldCarry += remaining * reduction;
      const blocked = Math.floor(this.draftShieldCarry);
      this.draftShieldCarry -= blocked;
      if (blocked > 0) {
        this.uiManager.showNotification(`🛡️ SHIELD WALL BLOCKED ${blocked}!`, '#38bdf8');
      }
      remaining -= blocked;
    }
    return remaining;
  }

  private spawnWaveTriggers(playerZ: number) {
    // Data-driven waves from the loaded level config.
    const waves = this.currentLevel.waves;
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      const key = `w${i}`;
      if (playerZ > w.triggerZ && !this.enemyWavesSpawned[key]) {
        this.enemyWavesSpawned[key] = true;
        // Phase 1 (Doomfall draft): remember the wave so its clear can
        // trigger a draft once all its enemies are gone.
        this.spawnedWaves.add(i);
        // Phase 4: wave composition (runners/shields/champion/elephant)
        // rides in the wave def; absent = all regular (level 1).
        this.enemyArmy.spawnWave(w.spawnZ, w.pattern, w.count, 0, { types: w.types });
      }
    }

    // Boss Arena Trigger
    if (
      this.currentLevel.boss &&
      playerZ > this.currentLevel.bossArenaZ - 5 &&
      !this.bossEncounterTriggered
    ) {
      this.bossEncounterTriggered = true;
      this.boss.activate();
      this.cameraManager.setBossMode(true);
      this.cameraManager.shake(0.9, 0.8);
      this.vibrate([40, 50, 80]);
      this.uiManager.showBossHUD(true);
      this.uiManager.showNotification('👑 COMMANDER SHER KHAN ARRIVES!', '#ef4444');
    }
  }

  // ---------- Phase 2 (Doomfall endless): Endless Siege ----------

  /**
   * Per-frame endless bookkeeping, after the level wave triggers:
   * segment advance (70z per wave), wave spawning, world wrap.
   */
  private updateEndless(playerZ: number) {
    // Segment advance: the player crossed into the next wave's stretch.
    if (playerZ > this.endlessSegmentStart + ENDLESS_SEGMENT) {
      this.endlessSegmentStart += ENDLESS_SEGMENT;
      this.endlessWave += 1;
      this.endlessWaveSpawned = false;
      this.armEndlessSegment();
    }

    // Spawn this segment's wave once the player is 8z in. Boss waves spawn
    // nothing here — the armed arena triggers Sher Khan instead.
    if (!this.endlessWaveSpawned && playerZ > this.endlessSegmentStart + 8) {
      this.endlessWaveSpawned = true;
      if (!isBossWave(this.endlessWave)) {
        this.spawnedWaves.add(this.endlessWave);
        this.enemyArmy.spawnWave(
          playerZ + 32,
          endlessWavePattern(this.endlessWave),
          endlessWaveCount(this.endlessWave),
          0,
          {
            hp: endlessWaveHp(this.endlessWave),
            speedMult: endlessWaveSpeedMult(this.endlessWave),
            // Phase 4: endless type on-ramp (runners w2, shields w3,
            // champion w4+ every 4th, elephant w8+ every 8th).
            types: endlessWaveTypes(this.endlessWave)
          }
        );
      }
    }

    // Wrap the world before the player runs off the built road (~530z).
    if (playerZ > ENDLESS_WRAP_Z) this.wrapEndlessWorld();

    // Phase 5 (Doomfall fortify): in the siege, fortifications left behind
    // the march are rebuilt ahead of the player (same piece, same HP).
    this.fortifications.updateEndless(playerZ);
  }

  /**
   * Dresses the current segment: one gate pair ~22z in (army growth, same
   * good-side/bad-side shape as levels), a barrier ~45z in on every even
   * wave (breakable for a reward), and — on boss waves — the arena: Sher
   * Khan's HP is set and the boss is re-anchored ahead of the arena, since
   * the boss otherwise still sits at the old arena's position.
   */
  private armEndlessSegment() {
    const start = this.endlessSegmentStart;
    const wave = this.endlessWave;

    const addBase = 5 + Math.floor(wave / 4);
    const goodFirst = Math.random() < 0.5;
    const goodIsMult = Math.random() < 0.5;
    const goodOp = goodIsMult ? 'mult' : 'add';
    const goodVal = goodIsMult
      ? wave >= 6 && Math.random() < 0.5
        ? 3
        : 2
      : addBase + Math.floor(Math.random() * 10);
    const hazard = wave >= 4 && Math.random() < 0.3;
    const otherOp = hazard ? 'sub' : 'add';
    const otherVal = hazard
      ? 3 + Math.floor(Math.random() * 5)
      : Math.max(3, addBase - 2 + Math.floor(Math.random() * 6));
    this.gateManager.createGatePair(
      start + 22,
      goodFirst ? goodOp : otherOp,
      goodFirst ? goodVal : otherVal,
      goodFirst ? otherOp : goodOp,
      goodFirst ? otherVal : goodVal
    );
    this.endlessGateZs.push(start + 22);
    this.cameraManager.setGatePositions(this.endlessGateZs);

    if (wave % 2 === 0) {
      const reward = BARRIER_REWARDS[(Math.floor(wave / 2) - 1) % BARRIER_REWARDS.length];
      this.barrierManager.spawnBarrier(
        start + 45,
        Math.round(50 * (1 + 0.08 * (wave - 1))),
        {
          type: reward.type,
          warriorsReward: reward.warriorsReward + Math.floor(wave / 5) * 2,
          label: reward.label
        }
      );
    }

    if (isBossWave(wave)) {
      const arenaZ = start + 55;
      this.currentLevel.bossArenaZ = arenaZ;
      CONSTANTS.BOSS_ARENA_Z = arenaZ;
      this.boss.maxHealth = endlessBossHp(wave / 5);
      this.bossEncounterTriggered = false;
      this.boss.reset();
    }
  }

  /**
   * Slides the whole world back 350z (5 segments) so the march never runs
   * off the built road. Everything shifts together — player, live enemies,
   * gates, barriers, segment/arena bookkeeping — so relative positions are
   * unchanged and the camera (which follows the player) sees no jump.
   * Spent gates/barriers far behind are pruned first, so a long run does
   * not accumulate canvas textures. A wrap can never land mid-boss-fight:
   * the arena hold caps the player below the wrap line.
   */
  private wrapEndlessWorld() {
    const shift = ENDLESS_WRAP_SHIFT;
    const playerZ = this.playerArmy.currentZ;

    this.gateManager.pruneBefore(playerZ - 5);
    this.barrierManager.pruneBefore(playerZ - 5);

    this.playerArmy.currentZ -= shift;
    this.playerArmy.group.position.z -= shift;

    for (const e of this.enemyArmy.enemies) {
      if (!e.active) continue;
      e.position.z -= shift;
      e.visual.root.position.z -= shift;
    }

    this.gateManager.shiftZ(-shift);
    this.barrierManager.shiftZ(-shift);
    // Phase 5: fortifications slide with the world (their shared wall
    // refs move too); updateEndless redeploys any left behind the march.
    this.fortifications.shiftZ(-shift);

    this.endlessSegmentStart -= shift;
    this.currentLevel.bossArenaZ -= shift;
    CONSTANTS.BOSS_ARENA_Z -= shift;
    this.endlessGateZs = this.endlessGateZs
      .map((z) => z - shift)
      .filter((z) => z > this.playerArmy.currentZ - 10);
    this.cameraManager.setGatePositions(this.endlessGateZs);

    // Inactive boss re-anchors to the shifted arena; an active boss
    // (defensive only — the hold normally prevents a wrap mid-fight)
    // shifts with the player instead.
    if (this.boss.active) {
      this.boss.position.z -= shift;
      this.boss.root.position.z -= shift;
    } else {
      this.boss.reset();
    }
  }

  public update(time: number, dt: number) {
    if (this.state !== 'playing') {
      // Keep background environment animated on pause/menu
      this.environment.update(time);
      return;
    }

    // Input
    this.inputManager.update(dt);
    this.playerArmy.targetX = this.inputManager.currentTargetX;

    // Cannon Cooldown
    if (this.cannonCooldownTimer > 0) {
      this.cannonCooldownTimer = Math.max(0, this.cannonCooldownTimer - dt);
      const fullCd = CONSTANTS.CANNON_COOLDOWN * this.runCannonFactor;
      this.uiManager.updateCannonCooldown(this.cannonCooldownTimer / fullCd);
    }

    // Phase 5 (Doomfall war-gear): the war horn's 10s damage boost runs
    // down in real play time; when it ends the draft recompute drops the
    // multiplier cleanly (no stale +50% leaking into the next draft).
    if (this.hornTimer > 0) {
      this.hornTimer -= dt;
      if (this.hornTimer <= 0) {
        this.hornTimer = 0;
        this.hornMult = 1;
        this.applyDraftConstants();
        this.uiManager.showNotification('📯 THE WAR HORN FADES…', '#94a3b8');
      }
    }

    // Gather potential targets for army auto-aiming
    // Phase 1 (master plan): reused list + reused boss target — PlayerArmy
    // only reads these synchronously inside update(), never stores them.
    const potentialTargets = _potentialTargets;
    potentialTargets.length = 0;

    // 1. Barriers
    const activeBarriers = this.barrierManager.getActiveTargets();
    activeBarriers.forEach(b => potentialTargets.push(b));

    // 2. Enemies
    const activeEnemies = this.enemyArmy.getActiveTargets();
    activeEnemies.forEach(e => potentialTargets.push(e));

    // 3. Boss
    if (this.boss.active && !this.boss.isDefeated) {
      _bossTargetPos.copy(this.boss.position);
      _bossTargetPos.y += 1.8;
      _bossTarget.health = this.boss.health;
      potentialTargets.push(_bossTarget);
    }

    // Update Player Squad
    this.playerArmy.update(dt, potentialTargets);
    // Boss arena hold (F1 fix): once the boss is live, the army holds the
    // line at bossArenaZ + 6 instead of marching past it. Boss levels have
    // no finish-line win trigger, so without this a boss that survives the
    // pass-by window left the run unwinnable and unending. Steering still
    // works while held (isMoving stays true), so boss slams stay dodgeable.
    if (this.currentLevel.boss && this.boss.active && !this.boss.isDefeated) {
      const holdZ = this.currentLevel.bossArenaZ + 6;
      if (this.playerArmy.currentZ > holdZ) {
        this.playerArmy.currentZ = holdZ;
        this.playerArmy.group.position.z = holdZ;
      }
    }
    // Phase 1 (master plan): reused scratch instead of a fresh Vector3
    // every frame. All uses below (spawnWaveTriggers, updateEndless,
    // enemy/boss updates, gate/barrier checks, camera, HUD) read .x/.z
    // synchronously within this frame.
    const playerPos = _playerPos.set(this.playerArmy.currentX, 0, this.playerArmy.currentZ);
    this.peakArmy = Math.max(this.peakArmy, this.playerArmy.count);

    // Spawn Enemy Waves based on progression
    this.spawnWaveTriggers(playerPos.z);

    // Phase 2 (Doomfall endless): segment advance, wave spawning, world wrap.
    if (this.isEndless) this.updateEndless(playerPos.z);

    // Phase 5 (Doomfall fortify): towers fire, traps trigger, walls break.
    // Runs before projectiles.update so tower arrows fly the same frame.
    this.fortifications.update(dt, this.enemyArmy.enemies);

    // Update Enemies
    this.enemyArmy.update(dt, playerPos.z, playerPos.x, (casualties) => {
      const lost = this.applyCasualtyLoss(casualties);
      if (lost > 0) this.playerArmy.setSquadCount(this.playerArmy.count - lost);
      this.cameraManager.shake(0.35, 0.2);
      this.uiManager.updateArmyCount(this.playerArmy.count);
    });

    // Near-miss graze: enemies slipping past just outside melee range.
    this.scanGraze(playerPos);

    // Phase 4: first sighting of a new enemy type banners what it does.
    this.announceNewEnemyTypes();

    // Phase 1 (Doomfall draft): burn damage-over-time ticks, then wave
    // clears (a spawned wave with no live enemies left queues one draft).
    this.tickBurns(dt);
    this.checkWaveClears();

    // Update Boss
    if (this.boss.active) {
      this.boss.update(dt, playerPos.x, playerPos.z, (slamCasualties) => {
        const lost = this.applyCasualtyLoss(slamCasualties);
        if (lost > 0) this.playerArmy.setSquadCount(this.playerArmy.count - lost);
        this.cameraManager.shake(0.7, 0.4);
        this.uiManager.updateArmyCount(this.playerArmy.count);
        this.uiManager.showNotification('⚠️ BOSS GROUND SLAM!', '#dc2626');
      });
      this.uiManager.updateBossHealth(this.boss.health, this.boss.maxHealth);
    }

    // Update Gates & Check Collisions
    this.gateManager.update(time);
    this.gateManager.checkPlayerCollision(playerPos.x, playerPos.z, (op, val) => {
      if (op === 'add') {
        this.playerArmy.addWarriors(val);
        this.uiManager.showNotification(`+${val} WARRIORS!`, '#f59e0b');
      } else if (op === 'mult') {
        this.playerArmy.multiplyWarriors(val);
        this.uiManager.showNotification(`×${val} ARMY MULTIPLIER!`, '#f59e0b');
        // Big multiplier gates hit different: slow-mo + a taller chime.
        if (val >= 3) {
          this.triggerSlowMo(0.8, 0.3);
          this.vibrate([30, 40, 50]);
        }
        this.soundManager.playGateChime(val);
        _textPos.set(playerPos.x, 4.5, playerPos.z + 3);
        this.particles.spawnFloatingText(
          _textPos,
          `×${val}`,
          'combo'
        );
      } else if (op === 'sub') {
        this.playerArmy.setSquadCount(this.playerArmy.count - val);
        this.uiManager.showNotification(`-${val} HAZARD!`, '#ef4444');
      }
      // Good gates (add/mult) count toward the daily "pass N gates" mission.
      if (op !== 'sub') this.save.recordMission('gates');
      this.cameraManager.shake(0.25, 0.15);
      this.uiManager.updateArmyCount(this.playerArmy.count);
    });

    // Check Barrier Player Ramming
    this.barrierManager.checkPlayerCollision(playerPos.z, (casualties) => {
      const lost = this.applyCasualtyLoss(casualties);
      if (lost > 0) this.playerArmy.setSquadCount(this.playerArmy.count - lost);
      this.cameraManager.shake(0.4, 0.25);
      this.uiManager.updateArmyCount(this.playerArmy.count);
    });

    // Update Projectiles & Check Hits
    this.projectiles.update(dt);
    this.handleProjectileCollisions();

    // Update Particles
    this.particles.update(dt);

    // Update Environment
    this.environment.update(time);

    // Update Camera
    this.cameraManager.update(dt, playerPos.x, playerPos.z, this.playerArmy.count);

    // Update Progress HUD
    if (this.isEndless) {
      // Endless: the bar is progress through the current wave's segment,
      // and the wave chip (top HUD) carries the wave number.
      const segPct = ((playerPos.z - this.endlessSegmentStart) / ENDLESS_SEGMENT) * 100;
      this.uiManager.updateProgress(segPct, `ENDLESS SIEGE — WAVE ${this.endlessWave}`);
      this.uiManager.updateWaveChip(this.endlessWave, true);
    } else {
      const progressPct = (playerPos.z / CONSTANTS.BOSS_ARENA_Z) * 100;
      let sectionName = 'FORTRESS CAUSEWAY';
      if (playerPos.z > 140 && playerPos.z < 260) sectionName = 'OUTER BASTION';
      else if (playerPos.z >= 260) sectionName = 'INNER COURTYARD';
      this.uiManager.updateProgress(progressPct, sectionName);
    }
    this.uiManager.updateDragHint(dt);

    // Combo: poll real kills (projectile kills + clash kills) and decay the
    // streak when the window lapses without a kill.
    const newKills = this.enemyArmy.totalKills - this.lastTotalKills;
    if (newKills > 0) {
      this.lastTotalKills = this.enemyArmy.totalKills;
      for (let k = 0; k < newKills; k++) this.registerKill();
    }
    // Phase 4: elite kill bonuses (champion +10, elephant +25) land in the
    // normal kill-coin stream — coin-magnet scaled like any kill coin, and
    // banked exactly once via killCoins (bankRunCoinsDelta reads the delta).
    const bonusCoins = this.enemyArmy.consumeBonusCoins();
    if (bonusCoins > 0) {
      const earned = Math.round(bonusCoins * this.coinMultiplier());
      this.runCoins += earned;
      this.killCoins += earned;
      this.uiManager.updateRunCoins(this.runCoins);
    }
    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboTimer = 0;
        this.uiManager.updateScore(this.score, 0, 1);
      }
    }

    // Win & Loss Check
    this.checkGameState();

    // Phase 1 (Doomfall draft): open a queued draft at the end of the
    // frame, after win/loss is settled — never twice for one event, never
    // during the boss fight, never on a run that just ended.
    this.maybeOpenDraft();
  }

  private handleProjectileCollisions() {
    const activeProjectiles = this.projectiles.getActiveProjectiles();
    const activeBarriers = this.barrierManager.getActiveTargets();
    // Phase 1 (master plan): reused list instead of a fresh .filter()
    // array every frame. Only iterated within this method.
    const activeEnemies = _activeEnemies;
    activeEnemies.length = 0;
    for (let i = 0; i < this.enemyArmy.enemies.length; i++) {
      const e = this.enemyArmy.enemies[i];
      if (e.active) activeEnemies.push(e);
    }

    for (let i = 0; i < activeProjectiles.length; i++) {
      const p = activeProjectiles[i];
      if (!p.active) continue;

      const pPos = p.mesh.position;

      // 1. Check against Barriers
      for (let j = 0; j < activeBarriers.length; j++) {
        const b = activeBarriers[j].barrierRef;
        if (b.destroyed) continue;

        if (Math.abs(pPos.z - b.z) < 1.0 && Math.abs(pPos.x - b.x) < b.width / 2 + 0.5 && pPos.y < 3.4) {
          this.projectiles.deactivate(p);
          _dmgPos.set(pPos.x, 2.2, b.z - 0.8);
          this.particles.spawnDamageNumber(
            _dmgPos,
            p.damage,
            'barrier'
          );
          this.barrierManager.applyDamage(b, p.damage, (reward) => {
            this.handleBarrierReward(reward);
          });
          break;
        }
      }
      if (!p.active) continue;

      // 2. Check against Enemies
      for (let j = 0; j < activeEnemies.length; j++) {
        const e = activeEnemies[j];
        if (!e.active) continue;

        _targetPos.copy(e.position);
        _targetPos.y += 0.8;
        const dist = pPos.distanceTo(_targetPos);
        if (dist < 1.1) {
          this.projectiles.deactivate(p);
          // Phase 4: damage kind rides into applyDamage — a shield-bearer's
          // front guard blunts plain arrows only (fire / cannon go through
          // at full strength). The returned value is what was actually
          // dealt, so the floating number shows the real (reduced) hit.
          const dealt = this.enemyArmy.applyDamage(e, p.damage, {
            kind: p.isCannonball ? 'cannon' : p.isFire ? 'fire' : p.isPiercing ? 'piercing' : 'arrow',
            attackerX: this.playerArmy.currentX
          });
          this.particles.spawnDamageNumber(
            _dmgPos.copy(e.position).setY(e.position.y + 1.6),
            dealt,
            p.isFire ? 'fire' : 'hit'
          );

          // Phase 1 (Doomfall draft): a fire arrow (not a cannonball) from
          // a flaming-arrows draft pick ignites the enemy — burn ticks
          // over the next 2s, refreshed on re-hit.
          if (p.isFire && !p.isCannonball) this.applyBurn(e);

          // Splash damage for cannon or fire
          if (p.splashRadius > 0) {
            this.particles.spawnExplosion(pPos, p.splashRadius);
            activeEnemies.forEach(otherE => {
              if (otherE.active && otherE !== e) {
                const splashDist = pPos.distanceTo(otherE.position);
                if (splashDist < p.splashRadius) {
                  const splashDealt = this.enemyArmy.applyDamage(otherE, p.damage * 0.7, {
                    kind: 'splash',
                    attackerX: this.playerArmy.currentX
                  });
                  this.particles.spawnDamageNumber(
                    _dmgPos.copy(otherE.position).setY(otherE.position.y + 1.6),
                    splashDealt,
                    'fire'
                  );
                }
              }
            });
          }
          break;
        }
      }
      if (!p.active) continue;

      // 3. Check against Boss
      if (this.boss.active && !this.boss.isDefeated) {
        _targetPos.copy(this.boss.position);
        _targetPos.y += 2.0;
        const bossDist = pPos.distanceTo(_targetPos);
        if (bossDist < 3.2) {
          this.projectiles.deactivate(p);
          const prevHealth = this.boss.health;
          const wasKilled = this.boss.takeDamage(p.damage);
          this.particles.spawnDamageNumber(
            _dmgPos.copy(this.boss.position).setY(this.boss.position.y + 4.2),
            p.damage,
            'boss'
          );
          // Boss-hit haptic, throttled so volleys don't buzz constantly.
          const nowMs = performance.now();
          if (nowMs - this.lastBossHapticAt > 150) {
            this.lastBossHapticAt = nowMs;
            this.vibrate(25);
          }
          if (wasKilled) {
            this.handleBossDefeated();
          } else if (
            prevHealth > this.boss.maxHealth * 0.7 &&
            this.boss.health <= this.boss.maxHealth * 0.7
          ) {
            // Phase 2 transition: Sher Khan enrages — freeze the moment.
            this.triggerHitStop(90);
            this.cameraManager.shake(0.8, 0.5);
            this.soundManager.playBossRoar();
            this.vibrate([50, 60, 80]);
            this.uiManager.showNotification('😡 SHER KHAN ENRAGED!', '#ef4444');
          }
        }
      }
    }
  }

  private handleBarrierReward(reward: BarrierReward) {
    this.cameraManager.shake(0.6, 0.4);
    // Barrier shatter is a big hit: freeze the frame, then rumble.
    this.triggerHitStop(80);
    this.vibrate([30, 40, 60]);
    // Breaking a barrier counts toward the daily mission.
    this.save.recordMission('barriers');

    if (reward.type === 'fire_arrows') {
      this.playerArmy.isFlamingArrows = true;
      this.uiManager.showNotification('🔥 FLAMING ARROWS UNLOCKED!', '#f97316');
    } else if (reward.type === 'double_shot') {
      this.playerArmy.isDoubleShot = true;
      this.uiManager.showNotification('🏹 DOUBLE VOLLEY UNLOCKED!', '#38bdf8');
    } else if (reward.type === 'cannon_bonus') {
      this.cannonCooldownTimer = 0;
      this.uiManager.showNotification('💣 TOPKHANA CANNON READY!', '#f59e0b');
    }

    if (reward.warriorsReward > 0) {
      this.playerArmy.addWarriors(reward.warriorsReward);
    }

    this.refreshDraftBuffs();
    this.uiManager.updateArmyCount(this.playerArmy.count);

    // Phase 1 (Doomfall draft): the fixed barrier reward above stays
    // exactly as it was — the draft is an ADDITIONAL choice layer. Queue
    // one draft for this barrier break; it opens at the end of the frame
    // (maybeOpenDraft), so the reward + draft never double-fire.
    this.queueDraft('barrier');
  }

  // ---------- Phase 1 (Doomfall draft): in-run war-bonus draft ----------

  /** Stack count for one bonus this run (0 = never picked this run). */
  private draftStacks(id: WarBonusId): number {
    return this.draftCounts.get(id) ?? 0;
  }

  /** Coin multiplier from coin-magnet stacks (1 + 50% per stack). */
  private coinMultiplier(): number {
    return 1 + 0.5 * this.draftStacks('coin_magnet');
  }

  /**
   * Recomputes the draft-scaled CONSTANTS from the upgrade bases. Called
   * after every draft pick and on every run reset, so bonuses stack
   * cleanly and never leak into the next level.
   */
  private applyDraftConstants() {
    CONSTANTS.FIRE_RATE_BASE = this.baseFireRate * Math.pow(1.2, this.draftStacks('fire_rate'));
    // Phase 5: the war horn's +50% rides hornMult, so a draft pick taken
    // while the horn is blowing never overwrites the boost.
    CONSTANTS.ARROW_DAMAGE =
      this.baseArrowDamage * Math.pow(1.25, this.draftStacks('volley_damage')) * this.hornMult;
    CONSTANTS.PLAYER_BASE_SPEED = this.baseMarchSpeed * Math.pow(1.1, this.draftStacks('march_speed'));
    CONSTANTS.MAX_SOLDIER_COUNT = this.baseMaxArmy + 10 * this.draftStacks('max_army');
  }

  /** HUD buff pills for the stacked draft bonuses (flaming arrows shares
   *  the 🔥 pill that updateBuffs already renders from isFlamingArrows). */
  private draftLabels(): string[] {
    const labels: string[] = [];
    for (const [id, count] of this.draftCounts) {
      if (id === 'flaming_arrows') continue;
      labels.push(`${warBonusDef(id).pill} ×${count}`);
    }
    return labels;
  }

  private refreshDraftBuffs() {
    this.uiManager.updateBuffs(
      this.playerArmy.isFlamingArrows,
      this.playerArmy.isDoubleShot,
      [...this.draftLabels(), ...this.gearLabels()]
    );
  }

  /**
   * Queues at most one draft. Coalesces a barrier break and a wave clear
   * landing in the same frame into a single draft, and never queues during
   * the boss fight, while a draft is already open/queued, or off the
   * playing state. The draft itself opens at the end of the frame.
   */
  private queueDraft(source: 'barrier' | 'wave') {
    if (this.pendingDraft || this.draftOpen) return;
    if (this.state !== 'playing') return;
    if (this.bossEncounterTriggered || this.boss.active) return;
    this.pendingDraft = source;
  }

  /** A spawned wave is cleared once no enemy is live anywhere. */
  private checkWaveClears() {
    if (this.spawnedWaves.size === 0) return;
    if (this.bossEncounterTriggered || this.boss.active) return;
    // Queued soldiers still waiting for a pool slot count as live: a wave
    // is not cleared until everything has spawned AND died.
    if (this.enemyArmy.hasPendingSpawns()) return;
    for (const e of this.enemyArmy.enemies) {
      if (e.active) return;
    }
    let clearedAny = false;
    let newlyCleared = 0;
    for (const w of this.spawnedWaves) {
      if (!this.clearedWaves.has(w)) {
        this.clearedWaves.add(w);
        clearedAny = true;
        newlyCleared++;
      }
    }
    if (clearedAny) {
      // Phase 2 (Doomfall endless): each cleared wave is one wave survived.
      // Overlapping waves (next wave spawned while stragglers lived) count
      // individually when they all finally clear.
      // Phase 3 (failure-pays): every wave survived pays a small lump sum
      // (coin-magnet scaled), so a siege always funds the next run.
      if (this.isEndless) {
        this.endlessWavesCleared += newlyCleared;
        const waveEarned = newlyCleared * Math.round(COIN_AWARDS.ENDLESS_WAVE * this.coinMultiplier());
        this.runCoins += waveEarned;
        this.waveCoins += waveEarned;
        this.uiManager.updateRunCoins(this.runCoins);
      }
      this.queueDraft('wave');
    }
  }

  /**
   * Opens a queued draft: freezes the run by switching to the 'draft'
   * state — update() early-returns in any non-'playing' state, so enemies,
   * projectiles, timers and the march all stop, and the loop's 0.05s dt
   * clamp makes the resume clean with no double-tick. Exactly 3 distinct
   * bonuses are offered; double-volley chance is never offered once the
   * barrier reward already grants a permanent double volley.
   */
  private maybeOpenDraft() {
    if (!this.pendingDraft || this.draftOpen) return;
    if (this.state !== 'playing' || this.victoryPending) return;
    if (this.bossEncounterTriggered || this.boss.active) return;
    if (this.playerArmy.count <= 0) return;
    const source = this.pendingDraft;
    this.pendingDraft = null;

    const exclude = new Set<WarBonusId>();
    if (this.playerArmy.isDoubleShot) exclude.add('double_volley');
    const choices = rollDraft(exclude).map((def) => ({
      def,
      stackCount: this.draftStacks(def.id)
    }));
    this.draftOpen = true;
    this.state = 'draft';
    this.uiManager.showDraft(choices, source);
    this.soundManager.playGateChime(2);
  }

  /** Applies the tapped bonus, then resumes the run cleanly. */
  private pickDraftBonus(id: WarBonusId) {
    if (!this.draftOpen || this.state !== 'draft') return;
    if (!WAR_BONUSES.some((b) => b.id === id)) return;
    // Phase 0: telemetry — which draft picks get taken.
    this.telemetry.draft({ bonusId: id, levelId: this.currentLevel.id });
    const next = this.draftStacks(id) + 1;
    this.draftCounts.set(id, next);
    const def = warBonusDef(id);

    switch (id) {
      case 'reinforcements':
        this.playerArmy.addWarriors(15);
        this.uiManager.updateArmyCount(this.playerArmy.count);
        break;
      case 'fire_rate':
      case 'volley_damage':
      case 'march_speed':
      case 'max_army':
        this.applyDraftConstants();
        break;
      case 'shield_wall':
        // Effect lives in applyCasualtyLoss via draftStacks('shield_wall').
        break;
      case 'coin_magnet':
        // Effect lives in handleScoreEvent / completeLevel.
        break;
      case 'flaming_arrows':
        // Grants fire arrows if the barrier reward hasn't already; the
        // burn itself scales with the stack count (see applyBurn).
        this.playerArmy.isFlamingArrows = true;
        break;
      case 'double_volley':
        this.playerArmy.doubleVolleyChance = Math.min(1, 0.25 * next);
        break;
      case 'cannon_reload':
        this.runCannonFactor *= 0.75;
        this.cannonCooldownTimer = 0;
        this.uiManager.updateCannonCooldown(0);
        break;
    }

    this.refreshDraftBuffs();
    this.uiManager.showNotification(
      `${def.icon} ${def.name.toUpperCase()}${next > 1 ? ` ×${next}` : ''}!`,
      '#fde047'
    );
    this.draftOpen = false;
    this.uiManager.hideDraft();
    this.state = 'playing';
    this.vibrate(30);
  }

  /**
   * Ignites an enemy hit by a fire arrow: 4 burn ticks of 0.5s, 2 damage
   * per tick per flaming-arrows stack. Re-hitting refreshes the burn.
   * Stacks come from the flaming-arrows draft pick, plus 1 for equipped
   * fire-arrow GEAR (Phase 5: fire arrows burn by definition). The barrier
   * fire-arrows reward alone still grants no burn, exactly as before.
   */
  private applyBurn(enemy: EnemyUnit) {
    const stacks = this.draftStacks('flaming_arrows') + (this.gearFireArrows ? 1 : 0);
    if (stacks <= 0) return;
    this.burnMap.set(enemy, { ticksLeft: 4, timer: 0.5, dmg: 2 * stacks });
  }

  /** Ticks active burns; dead/inactive enemies drop out of the map. */
  private tickBurns(dt: number) {
    if (this.burnMap.size === 0) return;
    for (const [enemy, burn] of this.burnMap) {
      if (!enemy.active || enemy.health <= 0) {
        this.burnMap.delete(enemy);
        continue;
      }
      burn.timer -= dt;
      if (burn.timer <= 0) {
        burn.timer += 0.5;
        burn.ticksLeft--;
        // Phase 4: burn is fire damage — it ignores a shield-bearer's
        // front guard at full strength (see applyDamage DamageKind).
        this.enemyArmy.applyDamage(enemy, burn.dmg, { kind: 'burn' });
        if (burn.ticksLeft <= 0 || !enemy.active) this.burnMap.delete(enemy);
      }
    }
  }

  private handleBossDefeated() {
    this.cameraManager.shake(1.0, 0.8);
    this.soundManager.playWinStinger();
    // Victory slow-mo + petal storm: the world slows as saffron petals rain.
    this.triggerSlowMo(1.2, 0.3);
    this.vibrate([50, 60, 50, 60, 120]);
    this.particles.spawnVictoryPetals(this.boss.position.clone(), 40);

    // Confetti rain of saffron petals
    const front = this.playerArmy.getFrontPosition();
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.particles.spawnVictoryPetals(front, 35);
      }, i * 350);
    }

    // Phase 2 (Doomfall endless): a boss wave cleared is a checkpoint, not
    // a victory — the siege continues into the next wave.
    if (this.isEndless) {
      this.handleEndlessBossDefeated();
      return;
    }

    this.uiManager.showNotification('🏆 VICTORY! SULTAN SHER KHAN HAS FALLEN!', '#fde047');
    this.victoryPending = true;

    setTimeout(() => {
      this.completeLevel();
    }, 2800);
  }

  /**
   * Phase 2 (Doomfall endless): boss-wave checkpoint. The boss wave counts
   * as a survived wave, pays a lump coin bonus (coin-magnet scaled), and
   * the run continues — boss HUD off, arena disarmed, and a war-bonus draft
   * opens so the build keeps growing into the next waves.
   */
  private handleEndlessBossDefeated() {
    const wave = this.endlessWave;
    this.endlessBossKills += 1;
    this.endlessWavesCleared += 1;
    const bonus = Math.round(endlessBossCoins(wave) * this.coinMultiplier());
    this.runCoins += bonus;
    this.bossCoins += bonus;
    // Phase 3 (failure-pays): a boss wave survived pays the wave award too,
    // like any other wave — the boss lump sum above is on top of it.
    const waveEarned = Math.round(COIN_AWARDS.ENDLESS_WAVE * this.coinMultiplier());
    this.runCoins += waveEarned;
    this.waveCoins += waveEarned;
    this.uiManager.updateRunCoins(this.runCoins);
    this.uiManager.showNotification(
      `👑 SHER KHAN FALLEN — WAVE ${wave} CLEARED! 🪙 +${bonus}`,
      '#fde047'
    );
    this.cameraManager.setBossMode(false);
    this.soundManager.setBossMode(false);
    this.uiManager.showBossHUD(false);
    this.bossEncounterTriggered = false;
    this.boss.reset();
    // QA fix: disarm this wave's arena. spawnWaveTriggers re-fires while
    // playerZ stays past a stale bossArenaZ, and the next boss wave is 5
    // segments away — without this, Sher Khan re-spawned at full HP on
    // the very next frame, forever (soft-lock + infinite boss coins).
    // The next boss wave re-arms both values in armEndlessSegment.
    this.currentLevel.bossArenaZ = 100000;
    CONSTANTS.BOSS_ARENA_Z = 100000;
    this.queueDraft('wave');
  }

  // ---------- Phase 3: level end, chest, revive, share ----------

  /** Shared victory path (boss kill or finish line on boss-less levels). */
  private completeLevel() {
    // Boss slow-mo runs while state is still 'playing'; a pause tap during
    // those 2.8s must not swallow the victory, so 'paused' is accepted too.
    // 'draft' is accepted for the same reason: a victory timer firing while
    // a draft is open must still complete (hideModals closes the draft).
    if (this.state !== 'playing' && this.state !== 'paused' && this.state !== 'draft') return;
    this.state = 'victory';
    this.victoryPending = false;
    this.uiManager.hideModals();

    const cfg = this.currentLevel;
    const saved = this.playerArmy.count;
    const kills = this.enemyArmy.totalKills + (cfg.boss ? 1 : 0);
    const stars = computeStars(saved, kills, cfg.totalEnemies);
    // Phase 1 (Doomfall draft): coin magnet multiplies the win + daily
    // bonus. runCoins are already magnet-multiplied as they were earned,
    // so only this portion is scaled here (no double-counting).
    // Phase 3 (failure-pays): a revive already banked the run coins earned
    // before the first death — bank only the still-unbanked remainder, so
    // a revive-then-win run credits every coin exactly once. The win bonus
    // is credited separately, on top. The victory screen still reports the
    // run's TOTAL earnings (already-banked + this win), as before.
    const alreadyBanked = this.bankedRunCoins;
    const runBreakdown = this.bankRunCoinsDelta();
    const winBonus = Math.round(
      (cfg.winCoins + (this.isDailyRun ? COIN_AWARDS.DAILY_CHALLENGE : 0)) * this.coinMultiplier()
    );
    const winCoins = alreadyBanked + runBreakdown.total + winBonus;

    if (!this.isDailyRun) {
      this.save.setStars(cfg.id, stars);
      this.save.setBestScore(cfg.id, this.score);
    }
    this.save.addCoins(winBonus);
    this.save.recordWin();
    this.save.gainLife(); // +1 life on level complete
    this.bankRunKills(kills);
    this.save.recordMission('wins');
    this.save.recordMission('coins', winBonus);
    if (this.isDailyRun) this.save.markDailyChallengeDone();

    this.lastVictory = {
      levelId: cfg.id,
      levelName: cfg.name,
      stars,
      score: this.score,
      coinsEarned: winCoins,
      kills,
      saved,
      isDaily: this.isDailyRun
    };

    // Phase 0: telemetry — real win data for the Phase 4 difficulty audit.
    this.telemetry.win({
      levelId: cfg.id,
      saved,
      kills,
      stars,
      seconds: this.runSeconds(),
      isDaily: this.isDailyRun,
      isEndless: this.isEndless
    });

    this.uiManager.showVictory(saved, kills, {
      stars,
      score: this.score,
      coins: winCoins,
      best: this.save.getBestScore(cfg.id)
    });
  }

  /** Banks kill totals incrementally, so a defeat-then-revive-then-win run
   *  counts every kill exactly once. */
  private bankRunKills(kills: number) {
    const delta = kills - this.bankedKills;
    if (delta <= 0) return;
    this.bankedKills = kills;
    this.save.recordKills(delta);
  }

  /**
   * Phase 3 (Doomfall failure-pays): banks the run coins earned since the
   * last banking event — and only those — then returns the per-source
   * breakdown of what THIS call credited, for the defeat screen. The
   * watermarks make every coin land exactly once: a level defeat banks the
   * run so far, a revive continues earning, and a second defeat (or the
   * win) banks only what came after the revive. Safe to call when nothing
   * is owed (returns a zero breakdown, banks nothing).
   */
  private bankRunCoinsDelta(): RunCoinBreakdown {
    const breakdown: RunCoinBreakdown = {
      killCount: this.enemyArmy.totalKills - this.bankedKillCount,
      killCoins: this.killCoins - this.bankedKillCoins,
      grazeCount: this.grazeCount - this.bankedGrazeCount,
      grazeCoins: this.grazeCoins - this.bankedGrazeCoins,
      waveCount: this.endlessWavesCleared - this.bankedWaveCount,
      waveCoins: this.waveCoins - this.bankedWaveCoins,
      bossCount: this.endlessBossKills - this.bankedBossCount,
      bossCoins: this.bossCoins - this.bankedBossCoins,
      total: 0
    };
    breakdown.total =
      breakdown.killCoins + breakdown.grazeCoins + breakdown.waveCoins + breakdown.bossCoins;
    if (breakdown.total > 0) {
      this.save.addCoins(breakdown.total);
      this.save.recordMission('coins', breakdown.total);
    }
    this.bankedKillCount = this.enemyArmy.totalKills;
    this.bankedKillCoins = this.killCoins;
    this.bankedGrazeCount = this.grazeCount;
    this.bankedGrazeCoins = this.grazeCoins;
    this.bankedWaveCount = this.endlessWavesCleared;
    this.bankedWaveCoins = this.waveCoins;
    this.bankedBossCount = this.endlessBossKills;
    this.bankedBossCoins = this.bossCoins;
    this.bankedRunCoins = this.runCoins;
    return breakdown;
  }

  private checkGameState() {
    if (this.state !== 'playing' || this.victoryPending) return;
    // Defeat if army wiped out
    if (this.playerArmy.count <= 0) {
      this.state = 'defeat';
      this.playerArmy.isMoving = false;
      this.soundManager.playLoseStinger();
      this.deathZ = this.playerArmy.currentZ;
      // Phase 2 (Doomfall endless): a siege defeat costs no life and
      // touches no win streak — it banks the run and shows the siege
      // defeat screen (waves, kills, coins, best).
      if (this.isEndless) {
        this.endlessDefeat();
        return;
      }
      this.save.recordLoss();
      this.save.loseLife(); // losing a level costs 1 life
      this.bankRunKills(this.enemyArmy.totalKills);
      // Phase 3 (Doomfall failure-pays): a lost level still pays — bank
      // the run's coins now (delta-based, so a revive-then-die-again run
      // never double-banks) and show the itemised breakdown + new balance.
      const breakdown = this.bankRunCoinsDelta();
      const progressPct = (this.playerArmy.currentZ / CONSTANTS.BOSS_ARENA_Z) * 100;
      const cost = reviveCost(this.currentLevel.id);
      this.lastDefeat = {
        kind: 'level',
        progressPct,
        kills: this.enemyArmy.totalKills,
        score: this.score,
        reviveCost: cost,
        breakdown
      };
      this.uiManager.showDefeat(progressPct, this.enemyArmy.totalKills, {
        score: this.score,
        reviveCost: cost,
        canRevive: !this.revived && this.save.coins >= cost,
        breakdown,
        newBalance: this.save.coins
      });
      // Phase 0: telemetry — boss HP left + progress at defeat.
      this.telemetry.defeat({
        levelId: this.currentLevel.id,
        kind: 'level',
        progressPct: Math.round(progressPct),
        bossHpRemaining: this.currentLevel.boss ? Math.max(0, Math.round(this.boss.health)) : null,
        bossHpMax: this.currentLevel.boss ? this.boss.maxHealth : null,
        kills: this.enemyArmy.totalKills,
        seconds: this.runSeconds(),
        isDaily: this.isDailyRun,
        isEndless: false
      });
      return;
    }
    // Boss-less levels end at the finish line.
    if (!this.currentLevel.boss && this.playerArmy.currentZ >= this.currentLevel.finishZ) {
      this.completeLevel();
    }
  }

  /**
   * Phase 2 (Doomfall endless): banks one endless run — coins earned (same
   * kill/graze rates as levels, already magnet-scaled as earned), kill
   * totals, and the local bests. Shared by defeat and pause-quit, so a quit
   * is never a lost best. Safe to call once per run: defeat and quit are
   * mutually exclusive exits (quit is only reachable from pause).
   * Phase 3: coin banking is delta-based (bankRunCoinsDelta), so the
   * breakdown returned here is exactly what this call credited.
   */
  private bankEndlessRun(): {
    newBestWaves: boolean;
    newBestKills: boolean;
    breakdown: RunCoinBreakdown;
  } {
    const kills = this.enemyArmy.totalKills + this.endlessBossKills;
    const breakdown = this.bankRunCoinsDelta();
    this.bankRunKills(kills);
    const best = this.save.recordEndlessBest(this.endlessWavesCleared, kills);
    return { ...best, breakdown };
  }

  /** Phase 2 (Doomfall endless): defeat ends the siege, period — no revive. */
  private endlessDefeat() {
    const kills = this.enemyArmy.totalKills + this.endlessBossKills;
    const banked = this.bankEndlessRun();
    this.lastDefeat = {
      kind: 'endless',
      waves: this.endlessWavesCleared,
      kills,
      bestWaves: this.save.endlessBest.waves,
      newBest: banked.newBestWaves || banked.newBestKills,
      breakdown: banked.breakdown
    };
    this.uiManager.showEndlessDefeat({
      waves: this.endlessWavesCleared,
      kills,
      coins: banked.breakdown.total,
      bestWaves: this.save.endlessBest.waves,
      newBest: banked.newBestWaves || banked.newBestKills,
      breakdown: banked.breakdown,
      newBalance: this.save.coins
    });
    // Phase 0: telemetry — siege defeat.
    this.telemetry.defeat({
      levelId: -1,
      kind: 'endless',
      kills,
      waves: this.endlessWavesCleared,
      seconds: this.runSeconds(),
      isEndless: true
    });
  }

  /**
   * Coin revive: resume the same run at the exact point of death — no level
   * restart. Army returns at half its peak size (min 10), nearby enemies are
   * cleared so the revive is not an instant re-death. Once per run.
   */
  private reviveRun() {
    if (this.state !== 'defeat' || this.revived) return;
    const cost = reviveCost(this.currentLevel.id);
    if (!this.save.spendCoins(cost)) {
      this.uiManager.showNotification('🪙 NOT ENOUGH COINS TO REVIVE!', '#ef4444');
      return;
    }
    this.revived = true;
    const restore = Math.max(10, Math.floor(this.peakArmy * 0.5));
    this.playerArmy.setSquadCount(restore);
    this.playerArmy.currentZ = this.deathZ;
    this.playerArmy.group.position.z = this.deathZ;
    this.playerArmy.isMoving = true;
    // Mercy clear: enemies right on top of the revive point would clash instantly.
    for (const e of this.enemyArmy.enemies) {
      if (e.active && e.position.z > this.deathZ - 2 && e.position.z < this.deathZ + 8) {
        this.enemyArmy.deactivate(e);
      }
    }
    this.uiManager.hideModals();
    this.uiManager.updateArmyCount(this.playerArmy.count);
    this.state = 'playing';
    this.uiManager.showNotification(`⚔️ REVIVED WITH ${restore} WARRIORS!`, '#fde047');
    this.vibrate([40, 50, 80]);
  }

  /** Victory chest: no timer, opens instantly on tap. First chest ever is the same. */
  private openChest() {
    this.pendingChest = rollChestReward(this.currentLevel.id, Math.random);
    this.uiManager.showChest(!this.save.firstChestOpened);
  }

  private revealChest() {
    if (!this.pendingChest) return;
    const reward = this.pendingChest;
    this.pendingChest = null;
    this.save.addCoins(reward.coins);
    if (reward.booster) this.save.addBooster(reward.booster, 1);
    this.save.markChestOpened();
    this.save.recordMission('coins', reward.coins);
    this.uiManager.revealChest(reward);
  }

  private chestContinue() {
    // Safety net: if a reward is still pending (e.g. UI state ever
    // desyncs), grant it before leaving — a chest reward is never lost.
    this.revealChest();
    if (!this.lastVictory) {
      this.openMap();
      return;
    }
    const nextId = this.lastVictory.levelId + 1;
    if (this.lastVictory.isDaily || nextId > TOTAL_LEVELS) {
      this.openMap();
    } else {
      this.openPreLevel(nextId, false);
    }
  }

  private victoryNext() {
    if (!this.lastVictory) {
      this.openMap();
      return;
    }
    const nextId = this.lastVictory.levelId + 1;
    if (this.lastVictory.isDaily || nextId > TOTAL_LEVELS) {
      this.openMap();
    } else {
      this.openPreLevel(nextId, false);
    }
  }

  private async shareScore(): Promise<void> {
    if (!this.lastVictory) return;
    const v = this.lastVictory;
    const canvas = renderShareCard({
      levelName: v.levelName,
      levelId: v.levelId,
      stars: v.stars,
      score: v.score,
      coinsEarned: v.coinsEarned,
      kills: v.kills,
      bestScore: this.save.getBestScore(v.levelId),
      winStreak: this.save.snapshot().winStreak
    });
    const result = await shareScoreCard(canvas);
    if (result === 'shared') {
      this.uiManager.showNotification('📣 SCORE SHARED!', '#4ade80');
    } else if (result === 'downloaded') {
      this.uiManager.showNotification('💾 SCORE CARD DOWNLOADED!', '#4ade80');
    } else {
      this.uiManager.showNotification('⚠️ SHARE FAILED — TRY AGAIN', '#ef4444');
    }
  }

  private onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.cameraManager.onResize(width, height);
    this.renderer.setSize(width, height);
  }

  public render() {
    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  public loop(timestamp: number) {
    if (!this.lastTime) this.lastTime = timestamp;
    const rawDt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    // Time scale (hit-stop / slow-mo) is driven by real time, then applied
    // to the simulation dt. Fixed-step consumers just see a smaller dt, so
    // the sim and the victory flow (real-time setTimeouts) stay intact.
    this.updateTimeScale(rawDt);
    const dt = rawDt * this.timeScale;
    this.scaledTime += dt;

    // Phase 4: auto quality samples real frame time (gameplay only) and
    // steps the renderer down/up; a manual toggle disables it (see
    // AutoQualityScaler — one call per frame, no loop changes).
    this.autoQuality.tick(rawDt, this.state === 'playing');

    // Phase 0: perf overlay sampling — raw frame time every frame.
    this.sampleFrameTime(rawDt);
    this.updatePerfOverlay(rawDt);

    this.update(this.scaledTime, dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------- Phase 0: perf overlay + telemetry helpers ----------

  private runSeconds(): number {
    return this.runStartMs > 0 ? Math.round((performance.now() - this.runStartMs) / 1000) : 0;
  }

  private initPerfOverlay(): void {
    try {
      this.perfEnabled = new URLSearchParams(window.location.search).has('perf');
    } catch {
      this.perfEnabled = false;
    }
    if (!this.perfEnabled) return;
    this.perfOverlay = document.getElementById('perf-overlay');
    this.perfOverlayText = document.getElementById('perf-overlay-text');
    this.perfCopyBtn = document.getElementById('perf-copy-btn');
    if (this.perfOverlay) this.perfOverlay.style.display = 'block';
    this.perfCopyBtn?.addEventListener('click', () => this.copyDebugExport());
  }

  private sampleFrameTime(rawDt: number): void {
    if (!this.perfEnabled) return;
    this.frameTimes.push(rawDt);
    if (this.frameTimes.length > 240) this.frameTimes.shift();
  }

  private perfSnapshot(): Record<string, unknown> {
    const info = this.renderer.info.render;
    const mem = this.renderer.info.memory;
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      fps: this.perfFps,
      frameMsAvg: this.perfFrameAvgMs,
      frameMsP95: this.perfFrameP95Ms,
      drawCalls: info.calls,
      triangles: info.triangles,
      geometries: mem.geometries,
      textures: mem.textures,
      heapMB: heap ? +(heap.usedJSHeapSize / 1048576).toFixed(1) : null,
      qualityLevel: this.autoQuality.currentLevel,
      state: this.state,
      levelId: this.currentLevel ? this.currentLevel.id : null,
      army: this.playerArmy.count
    };
  }

  private updatePerfOverlay(rawDt: number): void {
    if (!this.perfEnabled || !this.perfOverlayText) return;
    this.perfTimer += rawDt;
    if (this.perfTimer < 0.25) return;
    this.perfTimer = 0;
    const n = this.frameTimes.length;
    if (n >= 10) {
      const total = this.frameTimes.reduce((a, b) => a + b, 0);
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      this.perfFps = Math.round(n / total);
      this.perfFrameAvgMs = +(1000 * total / n).toFixed(1);
      this.perfFrameP95Ms = +(1000 * sorted[Math.floor(0.95 * (n - 1))]).toFixed(1);
    }
    const s = this.perfSnapshot();
    this.perfOverlayText.textContent =
      `QILA RUSH ?perf=1 — ${String(s.state)} L${String(s.levelId ?? '-')}\n` +
      `FPS ${s.fps} · avg ${s.frameMsAvg}ms · p95 ${s.frameMsP95}ms\n` +
      `draw ${s.drawCalls} · tris ${s.triangles} · geo ${s.geometries} · tex ${s.textures}\n` +
      `heap ${s.heapMB ?? '?'}MB · quality ${s.qualityLevel} · army ${s.army}`;
  }

  private copyDebugExport(): void {
    const text = this.uiManager.buildDebugExport(this.perfSnapshot(), this.telemetry.snapshot());
    const done = () => {
      if (this.perfCopyBtn) {
        this.perfCopyBtn.textContent = 'COPIED ✓';
        window.setTimeout(() => {
          if (this.perfCopyBtn) this.perfCopyBtn.textContent = 'COPY STATS';
        }, 1500);
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopy(text, done));
    } else {
      this.fallbackCopy(text, done);
    }
  }

  private fallbackCopy(text: string, done: () => void): void {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch {
      // Clipboard unavailable — the overlay still shows live numbers.
    }
  }
}
