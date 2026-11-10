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

export type GameState = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat';

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
  private bossEncounterTriggered: boolean = false;
  private enemyWavesSpawned: { [waveId: string]: boolean } = {};

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

    this.setupLevel();
    this.setupUIListeners();
    this.onWindowResize();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupLevel() {
    // 1. Gates along the causeway
    // Gate Pair 1 (Z = 25)
    this.gateManager.createGatePair(25, 'add', 5, 'add', 10);

    // Gate Pair 2 (Z = 105)
    this.gateManager.createGatePair(105, 'mult', 2, 'add', 15);

    // Gate Pair 3 (Z = 175)
    this.gateManager.createGatePair(175, 'mult', 3, 'add', 25);

    // Gate Pair 4 (Z = 245)
    this.gateManager.createGatePair(245, 'add', 20, 'mult', 2);

    // 2. Destructible Barriers
    // Barrier 1 (Z = 70) - Unlocks Flaming Arrows
    this.barrierManager.spawnBarrier(70, 50, {
      type: 'fire_arrows',
      warriorsReward: 5,
      label: '🔥 FLAMING ARROWS'
    });

    // Barrier 2 (Z = 135) - Unlocks Double Volley + 15 Troops
    this.barrierManager.spawnBarrier(135, 90, {
      type: 'double_shot',
      warriorsReward: 15,
      label: '🏹 DOUBLE VOLLEY'
    });

    // Barrier 3 (Z = 200) - Unlocks Topkhana Cannon Ready + 20 Troops
    this.barrierManager.spawnBarrier(200, 160, {
      type: 'cannon_bonus',
      warriorsReward: 20,
      label: '💣 TOPKHANA BOMBARD'
    });
  }

  private setupUIListeners() {
    // Start Button
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.soundManager.init();
      this.startGame();
    });

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

    document.getElementById('btn-defeat-retry')?.addEventListener('click', () => {
      this.restartGame();
    });

    document.getElementById('btn-victory-next')?.addEventListener('click', () => {
      this.restartGame();
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

  public startGame() {
    this.state = 'playing';
    this.uiManager.hideStartScreen();
    this.resetLevelState();
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
  }

  private toggleQuality() {
    this.isHighQuality = !this.isHighQuality;
    if (this.isHighQuality) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } else {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1);
    }
  }

  public triggerCannonAbility() {
    if (this.state !== 'playing' || this.cannonCooldownTimer > 0) return;

    this.cannonCooldownTimer = CONSTANTS.CANNON_COOLDOWN;
    this.cameraManager.shake(0.8, 0.5);

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

  private spawnWaveTriggers(playerZ: number) {
    // Wave 1: Z = 15 -> Spawns scout v-shape at Z = 42
    if (playerZ > 12 && !this.enemyWavesSpawned['w1']) {
      this.enemyWavesSpawned['w1'] = true;
      this.enemyArmy.spawnWave(42, 'v-shape', 7);
    }

    // Wave 2: Z = 72 -> Spawns ambush cluster at Z = 92
    if (playerZ > 72 && !this.enemyWavesSpawned['w2']) {
      this.enemyWavesSpawned['w2'] = true;
      this.enemyArmy.spawnWave(95, 'flank', 12);
    }

    // Wave 3: Z = 142 -> Spawns shielded phalanx at Z = 162
    if (playerZ > 142 && !this.enemyWavesSpawned['w3']) {
      this.enemyWavesSpawned['w3'] = true;
      this.enemyArmy.spawnWave(165, 'line', 14);
    }

    // Wave 4: Z = 210 -> Spawns raider wave at Z = 232
    if (playerZ > 210 && !this.enemyWavesSpawned['w4']) {
      this.enemyWavesSpawned['w4'] = true;
      this.enemyArmy.spawnWave(235, 'cluster', 18);
    }

    // Boss Arena Trigger: Z = 265
    if (playerZ > CONSTANTS.BOSS_ARENA_Z - 5 && !this.bossEncounterTriggered) {
      this.bossEncounterTriggered = true;
      this.boss.activate();
      this.cameraManager.setBossMode(true);
      this.cameraManager.shake(0.9, 0.8);
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
      this.uiManager.updateCannonCooldown(this.cannonCooldownTimer / CONSTANTS.CANNON_COOLDOWN);
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
    const playerPos = this.playerArmy.getFrontPosition();

    // Spawn Enemy Waves based on progression
    this.spawnWaveTriggers(playerPos.z);

    // Update Enemies
    this.enemyArmy.update(dt, playerPos.z, playerPos.x, (casualties) => {
      this.playerArmy.setSquadCount(this.playerArmy.count - casualties);
      this.cameraManager.shake(0.35, 0.2);
      this.uiManager.updateArmyCount(this.playerArmy.count);
    });

    // Update Boss
    if (this.boss.active) {
      this.boss.update(dt, playerPos.x, playerPos.z, (slamCasualties) => {
        this.playerArmy.setSquadCount(this.playerArmy.count - slamCasualties);
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
      } else if (op === 'sub') {
        this.playerArmy.setSquadCount(this.playerArmy.count - val);
        this.uiManager.showNotification(`-${val} HAZARD!`, '#ef4444');
      }
      this.cameraManager.shake(0.25, 0.15);
      this.uiManager.updateArmyCount(this.playerArmy.count);
    });

    // Check Barrier Player Ramming
    this.barrierManager.checkPlayerCollision(playerPos.z, (casualties) => {
      this.playerArmy.setSquadCount(this.playerArmy.count - casualties);
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
          this.enemyArmy.applyDamage(e, p.damage);

          // Splash damage for cannon or fire
          if (p.splashRadius > 0) {
            this.particles.spawnExplosion(pPos, p.splashRadius);
            activeEnemies.forEach(otherE => {
              if (otherE.active && otherE !== e) {
                const splashDist = pPos.distanceTo(otherE.position);
                if (splashDist < p.splashRadius) {
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
          const wasKilled = this.boss.takeDamage(p.damage);
          if (wasKilled) {
            this.handleBossDefeated();
          }
        }
      }
    }
  }

  private handleBarrierReward(reward: BarrierReward) {
    this.cameraManager.shake(0.6, 0.4);

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
    this.soundManager.playVictory();
    this.uiManager.showNotification('🏆 VICTORY! SULTAN SHER KHAN HAS FALLEN!', '#fde047');

    // Confetti rain of saffron petals
    const front = this.playerArmy.getFrontPosition();
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.particles.spawnVictoryPetals(front, 30);
      }, i * 350);
    }

    setTimeout(() => {
      this.state = 'victory';
      this.uiManager.showVictory(this.playerArmy.count, this.enemyArmy.totalKills + 1);
    }, 2800);
  }

  private checkGameState() {
    // Defeat if army wiped out
    if (this.playerArmy.count <= 0 && this.state === 'playing') {
      this.state = 'defeat';
      this.playerArmy.isMoving = false;
      this.soundManager.playDefeat();
      const progressPct = (this.playerArmy.currentZ / CONSTANTS.BOSS_ARENA_Z) * 100;
      this.uiManager.showDefeat(progressPct, this.enemyArmy.totalKills);
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
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(timestamp / 1000, dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}
