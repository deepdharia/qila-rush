import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import { FortressEnvironment } from '../environment/FortressEnvironment';
import { PlayerArmy } from '../entities/PlayerArmy';
import { EnemyArmy } from '../entities/EnemyArmy';
import { BossEnemy } from '../entities/BossEnemy';
import { GateManager } from '../entities/Gates';
import { BarrierManager, BarrierReward } from '../entities/Barriers';
import { ProjectileManager } from '../entities/Projectiles';
import { ParticleSystem } from '../entities/ParticleSystem';
import { CameraManager } from './CameraManager';
import { InputManager } from './InputManager';
import { SoundManager } from '../audio/SoundManager';
import { UIManager } from '../ui/UIManager';
// Phase 3: systems (addiction hooks) — localStorage save, level generator,
// coins economy, daily systems, share card.
import { SaveManager } from '../systems/SaveManager';
import { generateLevel, computeStars, TOTAL_LEVELS, type LevelConfig } from '../systems/Levels';
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
import { renderShareCard, shareScoreCard } from '../systems/ShareCard';
// Phase 4: auto quality scaler (frame-time driven, manual toggle wins).
import {
  AutoQualityScaler,
  QUALITY_SETTINGS,
  type QualityLevel
} from '../systems/AutoQuality';

export type GameState = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat';

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

  // State
  private state: GameState = 'menu';
  private lastTime: number = 0;
  private cannonCooldownTimer: number = 0;
  private isHighQuality: boolean = true;
  private autoQuality: AutoQualityScaler;
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
  // Pre-level selection (level id + daily flag + chosen boosters).
  private pendingLevelId: number = 1;
  private pendingIsDaily: boolean = false;
  private selectedBoosters: Set<BoosterId> = new Set();

  constructor() {
    this.canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

    // WebGL Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Phase 4: auto quality scaler. Starts at level 0 (high), matching the
    // renderer setup above; steps down/up only from real gameplay frame time.
    this.autoQuality = new AutoQualityScaler((level) => this.applyQualityLevel(level));

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

    // Phase 3: persistence + score hookup.
    this.save = new SaveManager();
    this.onScoreEvent = (type) => this.handleScoreEvent(type);
    this.uiManager.onAction = (action, data) => this.handleMenuAction(action, data);

    // Load the level-1 layout behind the menu backdrop.
    this.loadLevelConfig(generateLevel(1));
    this.setupUIListeners();
    this.onWindowResize();
    this.refreshMenu();

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
  }

  private setupUIListeners() {
    // Start Button — opens the level map (menu hub).
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.soundManager.init();
      this.openMap();
    });

    // Menu hub buttons
    document.getElementById('btn-menu-shop')?.addEventListener('click', () => this.openShop());
    document.getElementById('btn-menu-daily')?.addEventListener('click', () => this.openDaily());
    document.getElementById('btn-map-back')?.addEventListener('click', () => this.refreshMenu());
    document.getElementById('btn-shop-back')?.addEventListener('click', () => this.refreshMenu());
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
    this.uiManager.showStartScreen();
  }

  private quitToMenu() {
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
    this.uiManager.renderShop(rows, s.coins);
    this.uiManager.showShop();
    this.state = 'menu';
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
    this.selectedBoosters = new Set();
    this.renderPreLevel(cfg, isDaily);
    this.uiManager.showPreLevel();
    this.state = 'menu';
  }

  private renderPreLevel(cfg: LevelConfig, isDaily: boolean) {
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
      isDaily
    );
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
      case 'toggle-booster':
        this.toggleBooster(data.id as BoosterId);
        break;
      case 'claim-mission':
        this.claimMission(Number(data.index));
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
   * level config is loaded fresh.
   */
  public startGame(levelId: number, isDaily: boolean = false) {
    this.save.refreshLives();
    if (this.save.lives <= 0) {
      this.uiManager.showNotification('❤️ OUT OF LIVES — WAIT FOR THE NEXT ONE!', '#ef4444');
      this.openMap();
      return;
    }
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
  }

  private startPendingLevel() {
    this.startGame(this.pendingLevelId, this.pendingIsDaily);
  }

  private retryCurrentLevel() {
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
    this.uiManager.showPause(true);
  }

  public resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.uiManager.showPause(false);
  }

  public restartGame() {
    this.uiManager.hideModals();
    this.resetLevelState();
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
    this.uiManager.updateBuffs(false, false);
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
    if (type === 'kill') {
      this.runCoins += COIN_AWARDS.KILL;
      this.save.recordMission('kill');
      this.uiManager.updateRunCoins(this.runCoins);
    } else if (type === 'graze') {
      this.runCoins += COIN_AWARDS.GRAZE;
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
    if (remaining <= 0 || this.armourReduction <= 0) return remaining;
    this.armourCarry += remaining * this.armourReduction;
    const blocked = Math.floor(this.armourCarry);
    this.armourCarry -= blocked;
    if (blocked > 0) {
      this.uiManager.showNotification(`⛓️ ARMOUR BLOCKED ${blocked}!`, '#94a3b8');
    }
    return remaining - blocked;
  }

  private spawnWaveTriggers(playerZ: number) {
    // Data-driven waves from the loaded level config.
    const waves = this.currentLevel.waves;
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      const key = `w${i}`;
      if (playerZ > w.triggerZ && !this.enemyWavesSpawned[key]) {
        this.enemyWavesSpawned[key] = true;
        this.enemyArmy.spawnWave(w.spawnZ, w.pattern, w.count);
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

    // Gather potential targets for army auto-aiming
    const potentialTargets: { position: THREE.Vector3; health: number }[] = [];

    // 1. Barriers
    const activeBarriers = this.barrierManager.getActiveTargets();
    activeBarriers.forEach(b => potentialTargets.push(b));

    // 2. Enemies
    const activeEnemies = this.enemyArmy.getActiveTargets();
    activeEnemies.forEach(e => potentialTargets.push(e));

    // 3. Boss
    if (this.boss.active && !this.boss.isDefeated) {
      potentialTargets.push({
        position: this.boss.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
        health: this.boss.health
      });
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
    const playerPos = this.playerArmy.getFrontPosition();
    this.peakArmy = Math.max(this.peakArmy, this.playerArmy.count);

    // Spawn Enemy Waves based on progression
    this.spawnWaveTriggers(playerPos.z);

    // Update Enemies
    this.enemyArmy.update(dt, playerPos.z, playerPos.x, (casualties) => {
      const lost = this.applyCasualtyLoss(casualties);
      if (lost > 0) this.playerArmy.setSquadCount(this.playerArmy.count - lost);
      this.cameraManager.shake(0.35, 0.2);
      this.uiManager.updateArmyCount(this.playerArmy.count);
    });

    // Near-miss graze: enemies slipping past just outside melee range.
    this.scanGraze(playerPos);

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
        this.uiManager.showNotification(`+${val} WARRIORS!`, '#38bdf8');
      } else if (op === 'mult') {
        this.playerArmy.multiplyWarriors(val);
        this.uiManager.showNotification(`×${val} ARMY MULTIPLIER!`, '#f59e0b');
        // Big multiplier gates hit different: slow-mo + a taller chime.
        if (val >= 3) {
          this.triggerSlowMo(0.8, 0.3);
          this.vibrate([30, 40, 50]);
        }
        this.soundManager.playGateChime(val);
        this.particles.spawnFloatingText(
          new THREE.Vector3(playerPos.x, 4.5, playerPos.z + 3),
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
    const progressPct = (playerPos.z / CONSTANTS.BOSS_ARENA_Z) * 100;
    let sectionName = 'FORTRESS CAUSEWAY';
    if (playerPos.z > 140 && playerPos.z < 260) sectionName = 'OUTER BASTION';
    else if (playerPos.z >= 260) sectionName = 'INNER COURTYARD';
    this.uiManager.updateProgress(progressPct, sectionName);
    this.uiManager.updateDragHint(dt);

    // Combo: poll real kills (projectile kills + clash kills) and decay the
    // streak when the window lapses without a kill.
    const newKills = this.enemyArmy.totalKills - this.lastTotalKills;
    if (newKills > 0) {
      this.lastTotalKills = this.enemyArmy.totalKills;
      for (let k = 0; k < newKills; k++) this.registerKill();
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
  }

  private handleProjectileCollisions() {
    const activeProjectiles = this.projectiles.getActiveProjectiles();
    const activeBarriers = this.barrierManager.getActiveTargets();
    const activeEnemies = this.enemyArmy.enemies.filter(e => e.active);

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
          this.particles.spawnDamageNumber(
            new THREE.Vector3(pPos.x, 2.2, b.z - 0.8),
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

        const dist = pPos.distanceTo(e.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
        if (dist < 1.1) {
          this.projectiles.deactivate(p);
          this.particles.spawnDamageNumber(
            e.position.clone().add(new THREE.Vector3(0, 1.6, 0)),
            p.damage,
            p.isFire ? 'fire' : 'hit'
          );
          this.enemyArmy.applyDamage(e, p.damage);

          // Splash damage for cannon or fire
          if (p.splashRadius > 0) {
            this.particles.spawnExplosion(pPos, p.splashRadius);
            activeEnemies.forEach(otherE => {
              if (otherE.active && otherE !== e) {
                const splashDist = pPos.distanceTo(otherE.position);
                if (splashDist < p.splashRadius) {
                  this.particles.spawnDamageNumber(
                    otherE.position.clone().add(new THREE.Vector3(0, 1.6, 0)),
                    p.damage * 0.7,
                    'fire'
                  );
                  this.enemyArmy.applyDamage(otherE, p.damage * 0.7);
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
        const bossDist = pPos.distanceTo(this.boss.position.clone().add(new THREE.Vector3(0, 2.0, 0)));
        if (bossDist < 3.2) {
          this.projectiles.deactivate(p);
          const prevHealth = this.boss.health;
          const wasKilled = this.boss.takeDamage(p.damage);
          this.particles.spawnDamageNumber(
            this.boss.position.clone().add(new THREE.Vector3(0, 4.2, 0)),
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

    this.uiManager.updateBuffs(this.playerArmy.isFlamingArrows, this.playerArmy.isDoubleShot);
    this.uiManager.updateArmyCount(this.playerArmy.count);
  }

  private handleBossDefeated() {
    this.cameraManager.shake(1.0, 0.8);
    this.soundManager.playWinStinger();
    this.uiManager.showNotification('🏆 VICTORY! SULTAN SHER KHAN HAS FALLEN!', '#fde047');
    this.victoryPending = true;

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

    setTimeout(() => {
      this.completeLevel();
    }, 2800);
  }

  // ---------- Phase 3: level end, chest, revive, share ----------

  /** Shared victory path (boss kill or finish line on boss-less levels). */
  private completeLevel() {
    // Boss slow-mo runs while state is still 'playing'; a pause tap during
    // those 2.8s must not swallow the victory, so 'paused' is accepted too.
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.state = 'victory';
    this.victoryPending = false;
    this.uiManager.hideModals();

    const cfg = this.currentLevel;
    const saved = this.playerArmy.count;
    const kills = this.enemyArmy.totalKills + (cfg.boss ? 1 : 0);
    const stars = computeStars(saved, kills, cfg.totalEnemies);
    const winCoins = cfg.winCoins + this.runCoins + (this.isDailyRun ? COIN_AWARDS.DAILY_CHALLENGE : 0);

    if (!this.isDailyRun) {
      this.save.setStars(cfg.id, stars);
      this.save.setBestScore(cfg.id, this.score);
    }
    this.save.addCoins(winCoins);
    this.save.recordWin();
    this.save.gainLife(); // +1 life on level complete
    this.bankRunKills(kills);
    this.save.recordMission('wins');
    this.save.recordMission('coins', winCoins);
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

  private checkGameState() {
    if (this.state !== 'playing' || this.victoryPending) return;
    // Defeat if army wiped out
    if (this.playerArmy.count <= 0) {
      this.state = 'defeat';
      this.playerArmy.isMoving = false;
      this.soundManager.playLoseStinger();
      this.deathZ = this.playerArmy.currentZ;
      this.save.recordLoss();
      this.save.loseLife(); // losing a level costs 1 life
      this.bankRunKills(this.enemyArmy.totalKills);
      const progressPct = (this.playerArmy.currentZ / CONSTANTS.BOSS_ARENA_Z) * 100;
      const cost = reviveCost(this.currentLevel.id);
      this.uiManager.showDefeat(progressPct, this.enemyArmy.totalKills, {
        score: this.score,
        reviveCost: cost,
        canRevive: !this.revived && this.save.coins >= cost
      });
      return;
    }
    // Boss-less levels end at the finish line.
    if (!this.currentLevel.boss && this.playerArmy.currentZ >= this.currentLevel.finishZ) {
      this.completeLevel();
    }
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

    this.update(this.scaledTime, dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}
