import * as THREE from 'three';
import { SoldierVisual, SoldierModelFactory } from './SoldierModel';
import { ParticleSystem } from './ParticleSystem';
import { SoundManager } from '../audio/SoundManager';

export interface EnemyUnit {
  visual: SoldierVisual;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  speed: number;
  active: boolean;
  isHitFlash: boolean;
  flashTimer: number;
}

export class EnemyArmy {
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private sounds: SoundManager;

  public enemies: EnemyUnit[] = [];
  private poolSize = 90; // F4 fix: L30 waves reach 67; 70 truncated stragglers
  private animTimer: number = 0;
  public totalKills: number = 0;

  constructor(scene: THREE.Scene, particles: ParticleSystem, sounds: SoundManager) {
    this.scene = scene;
    this.particles = particles;
    this.sounds = sounds;

    // Pre-create pool of enemies
    for (let i = 0; i < this.poolSize; i++) {
      const visual = SoldierModelFactory.createSoldier('enemy');
      visual.root.visible = false;
      this.scene.add(visual.root);

      this.enemies.push({
        visual,
        position: new THREE.Vector3(),
        health: 25,
        maxHealth: 25,
        speed: 2.5,
        active: false,
        isHitFlash: false,
        flashTimer: 0
      });
    }
  }

  public spawnWave(
    startZ: number,
    pattern: 'line' | 'v-shape' | 'cluster' | 'flank',
    count: number,
    centerX: number = 0
  ) {
    for (let i = 0; i < count; i++) {
      const enemy = this.getFreeEnemy();
      if (!enemy) break;

      enemy.active = true;
      enemy.health = 25;
      enemy.maxHealth = 25;
      enemy.speed = 2.0 + Math.random() * 1.5;

      let offsetX = 0;
      let offsetZ = 0;

      if (pattern === 'line') {
        offsetX = ((i / (count - 1 || 1)) - 0.5) * 8.0;
        offsetZ = (Math.random() - 0.5) * 1.5;
      } else if (pattern === 'v-shape') {
        const side = i % 2 === 0 ? 1 : -1;
        const row = Math.floor(i / 2);
        offsetX = side * row * 1.4;
        offsetZ = row * 1.8;
      } else if (pattern === 'cluster') {
        const angle = i * 2.4;
        const radius = Math.sqrt(i) * 1.2;
        offsetX = Math.cos(angle) * radius;
        offsetZ = Math.sin(angle) * radius;
      } else if (pattern === 'flank') {
        offsetX = (i < count / 2 ? -4.5 : 4.5) + (Math.random() - 0.5) * 1.5;
        offsetZ = (i % Math.ceil(count / 2)) * 2.2;
      }

      enemy.position.set(centerX + offsetX, 0, startZ + offsetZ);
      enemy.visual.root.position.copy(enemy.position);
      enemy.visual.root.rotation.y = Math.PI; // Face player
      enemy.visual.root.visible = true;
    }
  }

  private getFreeEnemy(): EnemyUnit | null {
    for (let i = 0; i < this.poolSize; i++) {
      if (!this.enemies[i].active) {
        return this.enemies[i];
      }
    }
    return null;
  }

  public update(dt: number, playerZ: number, playerX: number, onPlayerHit: (casualties: number) => void) {
    this.animTimer += dt;

    for (let i = 0; i < this.poolSize; i++) {
      const enemy = this.enemies[i];
      if (!enemy.active) continue;

      // March towards player
      enemy.position.z -= enemy.speed * dt;
      enemy.visual.root.position.copy(enemy.position);

      // Animation
      SoldierModelFactory.animateSoldier(
        enemy.visual,
        this.animTimer,
        true,
        false,
        0.8
      );

      // Hit flash decay
      if (enemy.isHitFlash) {
        enemy.flashTimer -= dt;
        if (enemy.flashTimer <= 0) {
          enemy.isHitFlash = false;
        }
      }

      // Check collision with player army
      const dz = enemy.position.z - playerZ;
      if (Math.abs(dz) < 1.2) {
        const dx = Math.abs(enemy.position.x - playerX);
        if (dx < 3.2) {
          // Clash! Enemy dies, player army takes casualties
          this.killEnemy(enemy);
          onPlayerHit(1);
          continue;
        }
      }

      // Deactivate if far behind player
      if (enemy.position.z < playerZ - 10) {
        this.deactivate(enemy);
      }
    }
  }

  public applyDamage(enemy: EnemyUnit, damage: number) {
    enemy.health -= damage;
    enemy.isHitFlash = true;
    enemy.flashTimer = 0.08;

    this.particles.spawnSparks(enemy.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 4, 0xef4444);
    this.sounds.playArrowHit();

    if (enemy.health <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: EnemyUnit) {
    this.particles.spawnSparks(enemy.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 12, 0xef4444);
    this.totalKills++;
    this.deactivate(enemy);
  }

  public deactivate(enemy: EnemyUnit) {
    enemy.active = false;
    enemy.visual.root.visible = false;
  }

  public getActiveTargets(): { position: THREE.Vector3; health: number; enemyRef: EnemyUnit }[] {
    const list = [];
    for (let i = 0; i < this.poolSize; i++) {
      const enemy = this.enemies[i];
      if (enemy.active && enemy.health > 0) {
        list.push({
          position: enemy.position,
          health: enemy.health,
          enemyRef: enemy
        });
      }
    }
    return list;
  }

  public clearAll() {
    for (let i = 0; i < this.poolSize; i++) {
      this.deactivate(this.enemies[i]);
    }
    this.totalKills = 0;
  }

  public dispose() {
    this.enemies.forEach(e => {
      this.scene.remove(e.visual.root);
    });
    this.enemies = [];
  }
}
