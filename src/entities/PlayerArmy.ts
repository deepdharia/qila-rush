import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import { SoldierVisual, SoldierModelFactory } from './SoldierModel';
import { ProjectileManager } from './Projectiles';
import { SoundManager } from '../audio/SoundManager';
import { ParticleSystem } from './ParticleSystem';

export class PlayerArmy {
  public group: THREE.Group;
  private scene: THREE.Scene;
  private projectiles: ProjectileManager;
  private sounds: SoundManager;
  private particles: ParticleSystem;

  public count: number = CONSTANTS.INITIAL_SOLDIER_COUNT;
  private soldiers: SoldierVisual[] = [];
  public currentX: number = 0;
  public targetX: number = 0;
  public currentZ: number = CONSTANTS.START_Z;
  public isMoving: boolean = true;

  // Upgrades & Buffs
  public isFlamingArrows: boolean = false;
  public isDoubleShot: boolean = false;
  private fireCooldown: number = 0;

  // Animation time
  private animTimer: number = 0;
  private isShootingState: boolean = false;

  constructor(
    scene: THREE.Scene,
    projectiles: ProjectileManager,
    sounds: SoundManager,
    particles: ParticleSystem
  ) {
    this.scene = scene;
    this.projectiles = projectiles;
    this.sounds = sounds;
    this.particles = particles;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.rebuildSoldiers();
  }

  public setSquadCount(newCount: number) {
    const clamped = Math.max(0, Math.min(CONSTANTS.MAX_SOLDIER_COUNT, newCount));
    const prevCount = this.count;
    this.count = clamped;

    if (clamped > prevCount) {
      // Spawn recruitment burst
      this.particles.spawnSparks(this.group.position, 12, 0x38bdf8);
    } else if (clamped < prevCount) {
      // Casualty dust
      this.particles.spawnSparks(this.group.position, 8, 0xef4444);
    }

    this.rebuildSoldiers();
  }

  public addWarriors(amount: number) {
    this.setSquadCount(this.count + amount);
  }

  public multiplyWarriors(factor: number) {
    this.setSquadCount(Math.round(this.count * factor));
  }

  private rebuildSoldiers() {
    // Hide or create needed soldiers
    while (this.soldiers.length < this.count) {
      const soldier = SoldierModelFactory.createSoldier('player');
      this.group.add(soldier.root);
      this.soldiers.push(soldier);
    }

    // Set visibility and compute formation offsets
    for (let i = 0; i < this.soldiers.length; i++) {
      const soldier = this.soldiers[i];
      if (i < this.count) {
        soldier.root.visible = true;

        // Golden spiral crowd layout for tight, natural organic troop cluster
        if (i === 0) {
          soldier.root.position.set(0, 0, 0);
        } else {
          const angle = i * 2.39996; // Golden angle
          const radius = Math.sqrt(i) * 0.48;
          const x = radius * Math.cos(angle);
          const z = -radius * Math.sin(angle) * 0.85; // Slightly deeper than wide
          soldier.root.position.set(x, 0, z);
        }
      } else {
        soldier.root.visible = false;
      }
    }
  }

  public update(
    dt: number,
    potentialTargets: { position: THREE.Vector3; health: number }[]
  ) {
    this.animTimer += dt;

    if (this.isMoving) {
      // Advance forward
      this.currentZ += CONSTANTS.PLAYER_BASE_SPEED * dt;

      // Smooth lateral movement towards targetX
      const lateralSpeed = 16.0;
      const dx = this.targetX - this.currentX;
      this.currentX += dx * Math.min(1.0, lateralSpeed * dt);

      // Clamp within bridge boundaries
      const maxOffset = Math.min(2.5, Math.sqrt(this.count) * 0.25);
      const limit = CONSTANTS.ROAD_HALF_WIDTH - maxOffset - 0.4;
      this.currentX = Math.max(-limit, Math.min(limit, this.currentX));

      // Bank/tilt into turn
      this.group.rotation.z = -dx * 0.04;
      this.group.position.set(this.currentX, 0, this.currentZ);
    }

    // Firing logic
    this.fireCooldown -= dt;
    this.handleAutoShooting(potentialTargets);

    // Update animations for visible soldiers
    const isMoving = this.isMoving;
    const isShooting = this.isShootingState;
    for (let i = 0; i < this.count; i++) {
      SoldierModelFactory.animateSoldier(
        this.soldiers[i],
        this.animTimer,
        isMoving,
        isShooting,
        1.1
      );
    }
  }

  private handleAutoShooting(
    potentialTargets: { position: THREE.Vector3; health: number }[]
  ) {
    if (this.count <= 0 || potentialTargets.length === 0) {
      this.isShootingState = false;
      return;
    }

    // Find closest target in front within range
    let bestTarget: { position: THREE.Vector3; health: number } | null = null;
    let bestDist = CONSTANTS.ARROW_RANGE;

    for (let i = 0; i < potentialTargets.length; i++) {
      const t = potentialTargets[i];
      if (t.health <= 0) continue;

      const dz = t.position.z - this.currentZ;
      if (dz > 0.5 && dz < bestDist) {
        const dx = Math.abs(t.position.x - this.currentX);
        if (dx < CONSTANTS.ROAD_WIDTH) {
          bestDist = dz;
          bestTarget = t;
        }
      }
    }

    if (bestTarget) {
      this.isShootingState = true;

      // Fire rate scales slightly with army size
      const fireInterval = 1.0 / CONSTANTS.FIRE_RATE_BASE;
      if (this.fireCooldown <= 0) {
        this.fireCooldown = fireInterval;

        // Front soldiers fire arrows
        const shootersCount = Math.min(12, Math.max(2, Math.ceil(this.count * 0.35)));
        for (let i = 0; i < shootersCount; i++) {
          const soldier = this.soldiers[i];
          if (!soldier || !soldier.root.visible) continue;

          const startWorldPos = new THREE.Vector3();
          soldier.root.getWorldPosition(startWorldPos);

          // Add slight jitter to arrow targets so volleys spray over crowd
          const aimPos = bestTarget.position.clone();
          aimPos.x += (Math.random() - 0.5) * 1.4;
          aimPos.y += 0.5 + Math.random() * 0.5;
          aimPos.z += (Math.random() - 0.5) * 1.0;

          this.projectiles.spawnArrow(startWorldPos, aimPos, this.isFlamingArrows);

          if (this.isDoubleShot) {
            const spreadAim = aimPos.clone();
            spreadAim.x += (Math.random() - 0.5) * 2.0;
            this.projectiles.spawnArrow(startWorldPos, spreadAim, this.isFlamingArrows);
          }
        }

        this.sounds.playArrowFire();
      }
    } else {
      this.isShootingState = false;
    }
  }

  public getFrontPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.currentX, 0, this.currentZ);
  }

  public getBoundingRadius(): number {
    return Math.max(1.2, Math.sqrt(this.count) * 0.55);
  }

  public reset(startZ: number = CONSTANTS.START_Z) {
    this.currentX = 0;
    this.targetX = 0;
    this.currentZ = startZ;
    this.isMoving = true;
    this.isFlamingArrows = false;
    this.isDoubleShot = false;
    this.fireCooldown = 0;
    this.setSquadCount(CONSTANTS.INITIAL_SOLDIER_COUNT);
    this.group.position.set(0, 0, startZ);
    this.group.rotation.set(0, 0, 0);
  }

  public dispose() {
    this.scene.remove(this.group);
    this.soldiers = [];
  }
}
