import * as THREE from 'three';
import { SoldierVisual, SoldierModelFactory } from './SoldierModel';
import { ParticleSystem } from './ParticleSystem';
import { SoundManager } from '../audio/SoundManager';
// Phase 4 (Doomfall enemy types + elites): behaviour defs, markers, HP bars.
import {
  ENEMY_TYPE_DEFS,
  SHIELD_FRONT_RESIST,
  SHIELD_FLANK_DX,
  type EnemyType
} from '../systems/EnemyTypes';
// Phase 5 (Doomfall fortify): wall hack-down rate for halted enemies.
import { WALL_DPS_PER_ENEMY } from '../systems/WarGear';

// Phase 1 (master plan): per-frame allocation sweep — module-level
// scratch reused by update() / applyDamage() / killEnemy(). Every particle
// spawn below reads the vector synchronously (position.copy / component
// reads), so one shared scratch is safe.
const _tmpPos = new THREE.Vector3();

export type DamageKind = 'arrow' | 'fire' | 'cannon' | 'splash' | 'burn' | 'piercing' | 'trap';

export interface DamageOpts {
  /** What dealt the damage. Only plain 'arrow' hits are blunted by a
   *  shield-bearer's front guard — fire, cannon, splash, burn, piercing
   *  arrows (Phase 5 war-gear) and spike traps (Phase 5 fortify) all hit
   *  at full strength. */
  kind?: DamageKind;
  /** Attacker x at the moment of the hit. A plain arrow counts as a flank
   *  shot (no resist) when the player army is steered wide of the target. */
  attackerX?: number;
}

export interface EnemyUnit {
  visual: SoldierVisual;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  speed: number;
  active: boolean;
  isHitFlash: boolean;
  flashTimer: number;
  // Phase 4: enemy type + telegraphing attachments (children of the pooled
  // visual root, so hiding the root hides them; all shared assets, so the
  // pool costs no per-unit allocations at spawn time).
  type: EnemyType;
  coinBonus: number;
  trampleTimer: number;
  marker: THREE.Sprite;
  ring: THREE.Mesh;
  hpBarBg: THREE.Mesh;
  hpBarFg: THREE.Mesh;
}

/** A wave whose soldiers could not all fit in the 90-unit pool when the
 *  wave triggered (L22+ overlapping waves). The remainder waits here and
 *  trickles in as slots free up, so no soldier is ever silently dropped.
 *  `nextIndex` preserves the wave's pattern offsets and per-soldier type. */
interface PendingSpawn {
  startZ: number;
  pattern: 'line' | 'v-shape' | 'cluster' | 'flank';
  count: number;
  nextIndex: number;
  centerX: number;
  opts: { hp?: number; speedMult?: number; types?: EnemyType[] };
}

export class EnemyArmy {
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private sounds: SoundManager;

  public enemies: EnemyUnit[] = [];
  private poolSize = 90; // F4 fix: L30 waves reach 67; 70 truncated stragglers
  private animTimer: number = 0;
  public totalKills: number = 0;
  // Phase 5 (Doomfall fortify): live shield walls, shared by reference
  // with FortificationManager. An enemy that would march through a live
  // wall halts at it and hacks it down instead (see update()). Set by
  // Game at run start; cleared on every resetLevelState.
  public fortWalls: { z: number; hp: number; alive: boolean }[] = [];
  // Phase 4: elite kill bonuses (champion +10, elephant +25) accumulate
  // here; Game polls them into the normal kill-coin pipeline, so Phase 3's
  // exactly-once banking is untouched.
  private pendingBonusCoins: number = 0;
  // Phase 1 (master plan): reused getActiveTargets() storage — one
  // prebuilt wrapper per pooled unit (position is the unit's live Vector3,
  // health is refreshed on every call) plus one reused list. Callers only
  // read the wrappers within the frame; PlayerArmy never stores them.
  private targetWrappers: { position: THREE.Vector3; health: number; enemyRef: EnemyUnit }[] = [];
  private activeTargets: { position: THREE.Vector3; health: number; enemyRef: EnemyUnit }[] = [];
  // Spawn queue (L22+ fix): when overlapping waves exhaust the 90-unit
  // pool, the unspawned remainder waits here instead of being silently
  // dropped, and drains as slots free up in update().
  private pendingSpawns: PendingSpawn[] = [];

  // --- Phase 4 shared telegraphing assets (one per type, not per unit) ---
  private static markerMats: Record<string, THREE.SpriteMaterial> | null = null;
  private static ringGeo: THREE.CircleGeometry | null = null;
  private static ringMats: Record<string, THREE.MeshBasicMaterial> | null = null;
  private static hpBarGeo: THREE.BoxGeometry | null = null;
  private static hpBarBgGeo: THREE.BoxGeometry | null = null;
  private static hpBarBgMat: THREE.MeshBasicMaterial | null = null;
  private static hpBarFgMat: THREE.MeshBasicMaterial | null = null;

  private static initSharedAssets() {
    if (this.markerMats) return;
    // Emoji marker textures: coloured disc + emoji, one canvas per type.
    this.markerMats = {};
    for (const [type, def] of Object.entries(ENEMY_TYPE_DEFS)) {
      if (!def.marker) continue;
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fillStyle = def.markerColor;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke();
      ctx.font = '72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.marker, 64, 70);
      const tex = new THREE.CanvasTexture(canvas);
      this.markerMats[type] = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false
      });
    }
    this.ringGeo = new THREE.CircleGeometry(0.75, 24);
    this.ringMats = {};
    for (const [type, def] of Object.entries(ENEMY_TYPE_DEFS)) {
      if (!def.marker) continue;
      this.ringMats[type] = new THREE.MeshBasicMaterial({
        color: def.ringColor,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false
      });
    }
    // HP bar: bg box + fg box whose geometry is shifted so scale.x shrinks
    // it from the left edge (bar reads left-to-right as HP falls).
    this.hpBarGeo = new THREE.BoxGeometry(1.3, 0.14, 0.02);
    this.hpBarGeo.translate(0.65, 0, 0);
    this.hpBarBgGeo = new THREE.BoxGeometry(1.34, 0.18, 0.02);
    this.hpBarBgMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, depthWrite: false });
    this.hpBarFgMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, depthWrite: false });
  }

  constructor(scene: THREE.Scene, particles: ParticleSystem, sounds: SoundManager) {
    this.scene = scene;
    this.particles = particles;
    this.sounds = sounds;
    EnemyArmy.initSharedAssets();

    // Pre-create pool of enemies
    for (let i = 0; i < this.poolSize; i++) {
      const visual = SoldierModelFactory.createSoldier('enemy');
      visual.root.visible = false;
      this.scene.add(visual.root);

      // Phase 4 telegraphing attachments (children of the pooled root).
      const marker = new THREE.Sprite(EnemyArmy.markerMats!['shield']);
      marker.position.set(0, 2.05, 0);
      marker.scale.set(0.9, 0.9, 1);
      marker.visible = false;
      visual.root.add(marker);

      const ring = new THREE.Mesh(
        EnemyArmy.ringGeo!,
        EnemyArmy.ringMats!['shield']
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      ring.visible = false;
      visual.root.add(ring);

      const hpBarBg = new THREE.Mesh(
        EnemyArmy.hpBarBgGeo!,
        EnemyArmy.hpBarBgMat!
      );
      hpBarBg.position.set(0, 1.8, 0);
      hpBarBg.visible = false;
      visual.root.add(hpBarBg);

      const hpBarFg = new THREE.Mesh(EnemyArmy.hpBarGeo!, EnemyArmy.hpBarFgMat!);
      hpBarFg.position.set(-0.65, 1.8, 0.02);
      hpBarFg.visible = false;
      visual.root.add(hpBarFg);

      this.enemies.push({
        visual,
        position: new THREE.Vector3(),
        health: 25,
        maxHealth: 25,
        speed: 2.5,
        active: false,
        isHitFlash: false,
        flashTimer: 0,
        type: 'regular',
        coinBonus: 0,
        trampleTimer: 0,
        marker,
        ring,
        hpBarBg,
        hpBarFg
      });
    }

    // Phase 1 (master plan): one target wrapper per pooled unit, built
    // once — getActiveTargets() refills a reused list from these instead
    // of allocating a fresh wrapper object per live enemy per frame.
    for (let i = 0; i < this.poolSize; i++) {
      const enemy = this.enemies[i];
      this.targetWrappers.push({
        position: enemy.position,
        health: enemy.health,
        enemyRef: enemy
      });
    }
  }

  /**
   * Applies a type to a pooled unit: model scale, marker + ring (colour +
   * emoji), HP bar for the elites. Regular soldiers get none of it, so
   * they read exactly as before.
   */
  private applyType(enemy: EnemyUnit, type: EnemyType) {
    const def = ENEMY_TYPE_DEFS[type];
    enemy.type = type;
    enemy.coinBonus = def.coinBonus;
    enemy.trampleTimer = 0;
    enemy.visual.root.scale.setScalar(def.scale);
    const special = type !== 'regular';
    if (special) {
      enemy.marker.material = EnemyArmy.markerMats![type];
      // Keep the marker the same world size whatever the model scale is.
      enemy.marker.scale.set(0.9 / def.scale, 0.9 / def.scale, 1);
      enemy.marker.visible = true;
      enemy.ring.material = EnemyArmy.ringMats![type];
      enemy.ring.visible = true;
    } else {
      enemy.marker.visible = false;
      enemy.ring.visible = false;
    }
    enemy.hpBarBg.visible = def.hasHpBar;
    enemy.hpBarFg.visible = def.hasHpBar;
    if (def.hasHpBar) enemy.hpBarFg.scale.x = 1;
  }

  public spawnWave(
    startZ: number,
    pattern: 'line' | 'v-shape' | 'cluster' | 'flank',
    count: number,
    centerX: number = 0,
    // Phase 2 (Doomfall endless): per-wave scaling. Defaults keep the
    // level behaviour exactly as before (25 HP, base march speed).
    // Phase 4: `types` is one type per soldier, in spawn order; absent or
    // short entries default to regular. Types replace regulars — the pool
    // budget (90) and the wave count never grow.
    opts: { hp?: number; speedMult?: number; types?: EnemyType[] } = {}
  ) {
    for (let i = 0; i < count; i++) {
      if (!this.spawnOne(startZ, pattern, count, i, centerX, opts)) {
        // Pool exhausted (L22+ overlapping waves): queue the rest
        // instead of silently dropping them; the queue drains as slots
        // free up in update().
        this.pendingSpawns.push({ startZ, pattern, count, nextIndex: i, centerX, opts });
        break;
      }
    }
  }

  /**
   * Spawn one soldier of a wave. Returns false when the pool is full.
   * Extracted from spawnWave so the pending-spawn queue reuses the exact
   * same positioning and type lookup (index `i` preserves the wave's
   * pattern offsets and per-soldier type).
   */
  private spawnOne(
    startZ: number,
    pattern: 'line' | 'v-shape' | 'cluster' | 'flank',
    count: number,
    i: number,
    centerX: number,
    opts: { hp?: number; speedMult?: number; types?: EnemyType[] }
  ): boolean {
    const enemy = this.getFreeEnemy();
    if (!enemy) return false;

    const type = opts.types?.[i] ?? 'regular';
    const def = ENEMY_TYPE_DEFS[type];
    this.applyType(enemy, type);

    enemy.active = true;
    enemy.health = (opts.hp ?? 25) * def.hpMult;
    enemy.maxHealth = enemy.health;
    enemy.speed = (2.0 + Math.random() * 1.5) * (opts.speedMult ?? 1) * def.speedMult;

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
    return true;
  }

  /** Drain queued soldiers as pool slots free up; called each frame. */
  private drainSpawnQueue(): void {
    while (this.pendingSpawns.length > 0) {
      const head = this.pendingSpawns[0];
      if (!this.spawnOne(head.startZ, head.pattern, head.count, head.nextIndex, head.centerX, head.opts)) break;
      head.nextIndex += 1;
      if (head.nextIndex >= head.count) this.pendingSpawns.shift();
    }
  }

  /** True while soldiers are still waiting for a free pool slot. Game's
   *  wave-clear check must not fire until the queue is empty. */
  public hasPendingSpawns(): boolean {
    return this.pendingSpawns.length > 0;
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
    // Drain queued spawns first: soldiers that could not fit in the pool
    // when their wave triggered join as slots free up.
    this.drainSpawnQueue();
    this.animTimer += dt;

    for (let i = 0; i < this.poolSize; i++) {
      const enemy = this.enemies[i];
      if (!enemy.active) continue;

      // March towards player — unless a live fortify shield wall stands
      // in the way: halt at the wall line and hack it down (6 HP/s per
      // enemy; the wall breaks in FortificationManager.update). The wall
      // never blocks the PLAYER army, only the enemy march.
      let newZ = enemy.position.z - enemy.speed * dt;
      for (const wall of this.fortWalls) {
        if (!wall.alive) continue;
        if (enemy.position.z > wall.z && newZ <= wall.z + 0.6) {
          newZ = wall.z + 0.6;
          wall.hp -= WALL_DPS_PER_ENEMY * dt;
        }
      }
      enemy.position.z = newZ;
      enemy.visual.root.position.copy(enemy.position);

      // Animation — runners stride faster, elephants lumber slower.
      const def = ENEMY_TYPE_DEFS[enemy.type];
      SoldierModelFactory.animateSoldier(
        enemy.visual,
        this.animTimer,
        true,
        false,
        enemy.type === 'runner' ? 1.6 : enemy.type === 'elephant' ? 0.45 : 0.8
      );

      // Elite HP bar tracks live HP (burn ticks, splash and volleys all
      // land through applyDamage, so per-frame is the honest read).
      if (def.hasHpBar) {
        enemy.hpBarFg.scale.x = Math.max(0.001, enemy.health / enemy.maxHealth);
      }

      // Hit flash decay
      if (enemy.isHitFlash) {
        enemy.flashTimer -= dt;
        if (enemy.flashTimer <= 0) {
          enemy.isHitFlash = false;
        }
      }

      // Elephant trample cooldown (it can trample again only after passing
      // clear of the player plane — the 1s gate stops multi-hits per frame).
      if (enemy.trampleTimer > 0) enemy.trampleTimer -= dt;

      // Check collision with player army
      const dz = enemy.position.z - playerZ;
      if (Math.abs(dz) < 1.2) {
        const dx = Math.abs(enemy.position.x - playerX);
        if (dx < 3.2) {
          if (enemy.type === 'elephant') {
            // Trample: the elephant does NOT die on contact — it crushes
            // the front rank and keeps marching. It can never stall the
            // run: it advances steadily, can be killed, and once past the
            // player plane it deactivates like any straggler below.
            if (enemy.trampleTimer <= 0) {
              enemy.trampleTimer = 1.0;
              _tmpPos.copy(enemy.position);
              this.particles.spawnDustBurst(_tmpPos, 16);
              _tmpPos.copy(enemy.position);
              _tmpPos.y += 2.6;
              this.particles.spawnFloatingText(
                _tmpPos,
                '🐘 TRAMPLE!',
                'boss'
              );
              onPlayerHit(def.trampleCasualties);
            }
            continue;
          }
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

  /**
   * Deals damage, applying the shield-bearer's front guard: plain arrows
   * from straight ahead lose 60%; flank shots (player steered wide),
   * fire, cannon, splash, burn, piercing arrows and spike traps all hit
   * at full strength. Returns the damage actually dealt, so the floating
   * damage number shows the real (reduced) value.
   */
  public applyDamage(enemy: EnemyUnit, damage: number, opts: DamageOpts = {}): number {
    let dealt = damage;
    if (enemy.type === 'shield' && (opts.kind ?? 'arrow') === 'arrow') {
      const attackerX = opts.attackerX ?? enemy.position.x;
      const flanked = Math.abs(attackerX - enemy.position.x) > SHIELD_FLANK_DX;
      if (!flanked) dealt = damage * (1 - SHIELD_FRONT_RESIST);
    }

    enemy.health -= dealt;
    enemy.isHitFlash = true;
    enemy.flashTimer = 0.08;

    _tmpPos.copy(enemy.position);
    _tmpPos.y += 0.8;
    this.particles.spawnSparks(_tmpPos, 4, 0xef4444);
    this.sounds.playArrowHit();

    if (enemy.health <= 0) {
      this.killEnemy(enemy);
    }
    return dealt;
  }

  private killEnemy(enemy: EnemyUnit) {
    // Elites burst bigger, and their coin bonus flashes at the kill site.
    // The bonus itself is collected by Game into the normal kill-coin
    // pipeline (see consumeBonusCoins) — nothing is credited here.
    const bonus = enemy.coinBonus;
    _tmpPos.copy(enemy.position);
    _tmpPos.y += 0.6;
    this.particles.spawnSparks(
      _tmpPos,
      bonus > 0 ? 24 : 12,
      bonus > 0 ? 0xfde047 : 0xef4444
    );
    if (bonus > 0) {
      this.pendingBonusCoins += bonus;
      _tmpPos.copy(enemy.position);
      _tmpPos.y += 2.2;
      this.particles.spawnFloatingText(
        _tmpPos,
        `🪙 +${bonus}`,
        'combo'
      );
    }
    this.totalKills++;
    this.deactivate(enemy);
  }

  /** Elite kill bonuses owed since the last poll (0 when nothing is owed). */
  public consumeBonusCoins(): number {
    const owed = this.pendingBonusCoins;
    this.pendingBonusCoins = 0;
    return owed;
  }

  public deactivate(enemy: EnemyUnit) {
    enemy.active = false;
    enemy.visual.root.visible = false;
  }

  public getActiveTargets(): { position: THREE.Vector3; health: number; enemyRef: EnemyUnit }[] {
    // Reused list of prebuilt wrappers (see targetWrappers): health is
    // refreshed here, position is the unit's live Vector3. Callers must
    // not hold the list past the frame.
    this.activeTargets.length = 0;
    for (let i = 0; i < this.poolSize; i++) {
      const enemy = this.enemies[i];
      if (enemy.active && enemy.health > 0) {
        const w = this.targetWrappers[i];
        w.health = enemy.health;
        this.activeTargets.push(w);
      }
    }
    return this.activeTargets;
  }

  public clearAll() {
    for (let i = 0; i < this.poolSize; i++) {
      this.deactivate(this.enemies[i]);
    }
    this.totalKills = 0;
    this.pendingBonusCoins = 0;
    this.pendingSpawns = [];
    this.fortWalls = [];
  }

  public dispose() {
    this.enemies.forEach(e => {
      this.scene.remove(e.visual.root);
    });
    this.enemies = [];
  }
}
