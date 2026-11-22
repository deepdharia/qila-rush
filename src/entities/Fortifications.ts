// Phase 5 (Doomfall engagement loops) — FortificationManager.
//
// Owns the per-run fortifications bought on the pre-level screen: archer
// tower, spike trap, shield wall. One manager, at most 3 live pieces (one
// per fixed slot), all built from a handful of SHARED geometries/materials
// — no per-piece allocations at spawn time, no shadows on the pieces, so
// the 60fps / AutoQuality budget is untouched (3 extra draw groups max).
//
// Interaction rules (kept consistent with Phase 4):
//   tower — plain arrows (kind 'arrow'), so a shield-bearer's front guard
//           still blunts them, exactly like army arrows. Fires at the
//           nearest live enemy ahead of the tower, inside range.
//   trap  — kind 'trap': ignores shields entirely (like fire/cannon/burn).
//           Each enemy triggers a trap once; the trap stays armed for the
//           next enemy crossing it.
//   wall  — a live blocker handed to EnemyArmy (see EnemyArmy.fortWalls):
//           enemies halt at it and hack it down (6 HP/s each). The player
//           army marches straight through its centre gap — it is YOUR wall.
//           The boss never meets a wall (walls sit at z 45/130/215, the
//           arena is far ahead), so boss fights are unchanged.
//
// Lifecycle: Game spawns the run's picks at run start; clearAll() removes
// them at run end (win/lose/quit/restart). In Endless Siege the causeway
// repeats, so updateEndless() re-builds any fortification left behind the
// march ahead of the player (same piece, same remaining HP; a broken wall
// stays broken, a trap's hit-set resets on new ground).

import * as THREE from 'three';
import type { EnemyUnit } from './EnemyArmy';
import { ProjectileManager } from './Projectiles';
import { ParticleSystem } from './ParticleSystem';
import { SoundManager } from '../audio/SoundManager';
import {
  FORTIFY_SLOT_Z,
  TOWER_FIRE_INTERVAL,
  TOWER_RANGE,
  TRAP_DAMAGE,
  WALL_HP,
  ENDLESS_FORTIFY_REDEPLOY,
  type FortifyType
} from '../systems/WarGear';

/** One live wall, shared by reference with EnemyArmy.fortWalls. */
export interface FortWall {
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

interface FortPiece {
  type: FortifyType;
  slot: number;
  z: number;
  group: THREE.Group;
  /** Tower only. */
  cooldown: number;
  /** Trap only: enemies that already triggered this trap. */
  hitSet: Set<EnemyUnit>;
  /** Wall only: the shared blocker EnemyArmy marches against. */
  wall: FortWall | null;
  /** Wall only: HP bar mesh, scaled by remaining HP. */
  hpBar: THREE.Mesh | null;
  broken: boolean;
}

export class FortificationManager {
  private scene: THREE.Scene;
  private projectiles: ProjectileManager;
  private particles: ParticleSystem;
  private sounds: SoundManager;

  private pieces: FortPiece[] = [];

  /** Game wires this to show notifications (wall broken, etc.). */
  public onEvent: ((text: string, color: string) => void) | null = null;

  // --- Shared assets: one set for all pieces, ever ---
  private static stoneMat: THREE.MeshLambertMaterial | null = null;
  private static woodMat: THREE.MeshLambertMaterial | null = null;
  private static ironMat: THREE.MeshLambertMaterial | null = null;
  private static spikeMat: THREE.MeshStandardMaterial | null = null;
  private static hpBarGeo: THREE.BoxGeometry | null = null;
  private static hpBarBgGeo: THREE.BoxGeometry | null = null;
  private static hpBarBgMat: THREE.MeshBasicMaterial | null = null;
  private static hpBarFgMat: THREE.MeshBasicMaterial | null = null;
  private static towerBaseGeo: THREE.CylinderGeometry | null = null;
  private static towerTopGeo: THREE.BoxGeometry | null = null;
  private static towerRoofGeo: THREE.ConeGeometry | null = null;
  private static wallGeo: THREE.BoxGeometry | null = null;
  private static wallGapGeo: THREE.BoxGeometry | null = null;
  private static trapSpikeGeo: THREE.ConeGeometry | null = null;
  private static trapBaseGeo: THREE.BoxGeometry | null = null;

  private static initSharedAssets() {
    if (this.stoneMat) return;
    this.stoneMat = new THREE.MeshLambertMaterial({ color: 0x78716c });
    this.woodMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    this.ironMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    this.spikeMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.8
    });
    this.hpBarGeo = new THREE.BoxGeometry(2.2, 0.16, 0.02);
    this.hpBarGeo.translate(1.1, 0, 0);
    this.hpBarBgGeo = new THREE.BoxGeometry(2.26, 0.22, 0.02);
    this.hpBarBgMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, depthWrite: false });
    this.hpBarFgMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthWrite: false });
    this.towerBaseGeo = new THREE.CylinderGeometry(0.9, 1.2, 3.4, 8);
    this.towerTopGeo = new THREE.BoxGeometry(2.2, 0.5, 2.2);
    this.towerRoofGeo = new THREE.ConeGeometry(1.5, 1.0, 4);
    this.wallGeo = new THREE.BoxGeometry(4.6, 2.0, 0.8);
    this.wallGapGeo = new THREE.BoxGeometry(3.4, 1.4, 0.8);
    this.trapSpikeGeo = new THREE.ConeGeometry(0.16, 0.8, 5);
    this.trapBaseGeo = new THREE.BoxGeometry(7.0, 0.15, 2.4);
  }

  constructor(
    scene: THREE.Scene,
    projectiles: ProjectileManager,
    particles: ParticleSystem,
    sounds: SoundManager
  ) {
    this.scene = scene;
    this.projectiles = projectiles;
    this.particles = particles;
    this.sounds = sounds;
    FortificationManager.initSharedAssets();
  }

  /** Live walls for EnemyArmy to march against (empty when no wall placed). */
  public get walls(): FortWall[] {
    return this.pieces
      .filter((p) => p.wall !== null)
      .map((p) => p.wall!);
  }

  /**
   * Builds the run's picks: `picks[slot]` is the fortification for fixed
   * slot `slot` (z from FORTIFY_SLOT_Z), or null for an empty slot.
   * Call after clearAll(); at most 3 pieces ever exist.
   */
  public spawnPicks(picks: (FortifyType | null)[]) {
    this.clearAll();
    picks.forEach((type, slot) => {
      if (!type) return;
      const z = FORTIFY_SLOT_Z[slot];
      this.pieces.push(this.buildPiece(type, slot, z));
    });
  }

  private buildPiece(type: FortifyType, slot: number, z: number): FortPiece {
    const group = new THREE.Group();
    let wall: FortWall | null = null;
    let hpBar: THREE.Mesh | null = null;

    if (type === 'tower') {
      // Stone watchtower on the road's left shoulder — clear of the march.
      group.position.set(-4.6, 0, z);
      const base = new THREE.Mesh(
        FortificationManager.towerBaseGeo!,
        FortificationManager.stoneMat!
      );
      base.position.y = 1.7;
      group.add(base);
      const top = new THREE.Mesh(
        FortificationManager.towerTopGeo!,
        FortificationManager.woodMat!
      );
      top.position.y = 3.6;
      group.add(top);
      const roof = new THREE.Mesh(
        FortificationManager.towerRoofGeo!,
        FortificationManager.ironMat!
      );
      roof.position.y = 4.35;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
    } else if (type === 'trap') {
      // Low spike bed across the road centre — enemies cross it, the
      // player army marches over the flat base between the spikes.
      group.position.set(0, 0, z);
      const base = new THREE.Mesh(
        FortificationManager.trapBaseGeo!,
        FortificationManager.woodMat!
      );
      base.position.y = 0.07;
      group.add(base);
      for (let i = 0; i < 9; i++) {
        const spike = new THREE.Mesh(
          FortificationManager.trapSpikeGeo!,
          FortificationManager.spikeMat!
        );
        spike.position.set(-3 + i * 0.75, 0.45, (i % 2 === 0 ? -0.6 : 0.6));
        group.add(spike);
      }
    } else {
      // Shield wall: two stone blocks with a centre gap the player army
      // marches through. Enemies halt at the line regardless of the gap
      // (arcade abstraction — the wall is YOUR fortification).
      group.position.set(0, 0, z);
      const left = new THREE.Mesh(
        FortificationManager.wallGeo!,
        FortificationManager.stoneMat!
      );
      left.position.set(-4.0, 1.0, 0);
      group.add(left);
      const right = new THREE.Mesh(
        FortificationManager.wallGeo!,
        FortificationManager.stoneMat!
      );
      right.position.set(4.0, 1.0, 0);
      group.add(right);
      const lintel = new THREE.Mesh(
        FortificationManager.wallGapGeo!,
        FortificationManager.woodMat!
      );
      lintel.position.set(0, 2.0, 0);
      group.add(lintel);
      // HP bar above the gap, like the elite HP bars.
      const bg = new THREE.Mesh(
        FortificationManager.hpBarBgGeo!,
        FortificationManager.hpBarBgMat!
      );
      bg.position.set(0, 3.0, 0);
      group.add(bg);
      hpBar = new THREE.Mesh(
        FortificationManager.hpBarGeo!,
        FortificationManager.hpBarFgMat!
      );
      hpBar.position.set(-1.1, 3.0, 0.02);
      group.add(hpBar);
      wall = { z, hp: WALL_HP, maxHp: WALL_HP, alive: true };
    }

    this.scene.add(group);
    return {
      type,
      slot,
      z,
      group,
      cooldown: 0,
      hitSet: new Set(),
      wall,
      hpBar,
      broken: false
    };
  }

  /**
   * Per-frame fortification behaviour. Towers fire, traps trigger, walls
   * break (visual + event) when EnemyArmy hacks their HP to zero. Called
   * only while the run is playing.
   */
  public update(dt: number, enemies: EnemyUnit[]) {
    for (const p of this.pieces) {
      if (p.broken) continue;
      if (p.type === 'tower') this.updateTower(p, dt, enemies);
      else if (p.type === 'trap') this.updateTrap(p, enemies);
      else this.updateWall(p);
    }
  }

  private updateTower(p: FortPiece, dt: number, enemies: EnemyUnit[]) {
    p.cooldown -= dt;
    if (p.cooldown > 0) return;
    // Nearest live enemy ahead of the tower, inside range.
    let best: EnemyUnit | null = null;
    let bestDz = TOWER_RANGE;
    for (const e of enemies) {
      if (!e.active) continue;
      const dz = e.position.z - p.z;
      if (dz > 0.5 && dz < bestDz) {
        bestDz = dz;
        best = e;
      }
    }
    if (!best) return;
    p.cooldown = TOWER_FIRE_INTERVAL;
    const start = new THREE.Vector3(p.group.position.x, 3.8, p.z);
    const aim = best.position.clone();
    aim.y += 0.8;
    aim.x += (Math.random() - 0.5) * 1.0;
    this.projectiles.spawnArrow(start, aim, false);
    this.sounds.playArrowFire();
  }

  private updateTrap(p: FortPiece, enemies: EnemyUnit[]) {
    for (const e of enemies) {
      if (!e.active || p.hitSet.has(e)) continue;
      // Enemy crossing the trap line, inside the road width.
      if (Math.abs(e.position.z - p.z) < 1.0 && Math.abs(e.position.x) < 4.0) {
        p.hitSet.add(e);
        // Damage rides through EnemyArmy so shield rules + kill/coin
        // accounting stay in the one place they already live.
        const dealt = this.damageEnemy(e, TRAP_DAMAGE);
        if (dealt > 0) {
          this.particles.spawnSparks(
            e.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
            8,
            0x94a3b8
          );
        }
      }
    }
  }

  /** Trap damage goes through the enemy army's own damage path. Set by Game. */
  public damageEnemy: (enemy: EnemyUnit, damage: number) => number = () => 0;

  private updateWall(p: FortPiece) {
    if (!p.wall) return;
    if (p.hpBar) {
      p.hpBar.scale.x = Math.max(0.001, p.wall.hp / p.wall.maxHp);
    }
    if (p.wall.hp <= 0 && p.wall.alive) {
      p.wall.alive = false;
      p.broken = true;
      p.group.visible = false;
      this.particles.spawnDustBurst(p.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 20);
      this.sounds.playBarrierBreak();
      this.onEvent?.('🛡️ SHIELD WALL HAS FALLEN!', '#94a3b8');
    }
  }

  /**
   * Endless Siege only: any fortification left behind the march is rebuilt
   * ahead of the player (same piece, same remaining HP; a broken wall stays
   * broken, a trap's hit-set resets on the new ground). Levels never call
   * this — their slots are fixed for the run.
   */
  public updateEndless(playerZ: number) {
    for (const p of this.pieces) {
      if (p.broken || p.z >= playerZ - 5) continue;
      const offset = ENDLESS_FORTIFY_REDEPLOY[p.type];
      p.z = playerZ + offset;
      p.group.position.z = p.z;
      if (p.wall) p.wall.z = p.z;
      if (p.type === 'trap') p.hitSet.clear();
      p.cooldown = 0;
    }
  }

  /** World-wrap shift (endless): every piece slides with the world. */
  public shiftZ(delta: number) {
    for (const p of this.pieces) {
      p.z += delta;
      p.group.position.z += delta;
      if (p.wall) p.wall.z += delta;
    }
  }

  /** Removes every piece from the scene (run end / new run). */
  public clearAll() {
    for (const p of this.pieces) {
      this.scene.remove(p.group);
    }
    this.pieces = [];
  }

  public dispose() {
    this.clearAll();
  }
}
