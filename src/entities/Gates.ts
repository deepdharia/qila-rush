import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import { SoundManager } from '../audio/SoundManager';
import { ParticleSystem } from './ParticleSystem';

export type GateOp = 'add' | 'mult' | 'sub';

export interface GateData {
  group: THREE.Group;
  op: GateOp;
  value: number;
  x: number;
  z: number;
  width: number;
  isPositive: boolean;
  collected: boolean;
  portalMesh: THREE.Mesh;
  textureCanvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  // Phase 1 (master plan): pulsing gold ring on x (mult) gates only.
  ringMesh?: THREE.Mesh;
  // Phase 2 (Topkhana stream): golden x5 gates, moving gates, spent/flash.
  golden?: boolean;
  moving?: boolean;
  moveAmp?: number;
  moveSpeed?: number;
  movePhase?: number;
  baseX?: number;
  /** Seconds of flash left, recomputed by update() from flashUntil. */
  flashT?: number;
  /** Clock time (same clock update() receives) until which the J3 flash runs. */
  flashUntil?: number;
  /** True once the warband has marched past — the stream scores no more. */
  spent?: boolean;
}

/**
 * Phase 2 (Topkhana stream): what processStreamSoldier reports when one
 * stream soldier crosses a live gate plane. Gates only reports — Game
 * applies the effect and the juice. The gate stays live while the stream
 * passes; nothing is marked collected here.
 */
export interface GateStreamEvent {
  op: GateOp;
  value: number;
  isGolden: boolean;
  x: number;
  z: number;
  gate: GateData;
}

export class GateManager {
  private scene: THREE.Scene;
  private sounds: SoundManager;
  private particles: ParticleSystem;

  public gates: GateData[] = [];

  // Shared geometry
  private pillarGeo: THREE.CylinderGeometry;
  private pillarMat: THREE.MeshLambertMaterial;
  private archGeo: THREE.BoxGeometry;
  private archMat: THREE.MeshLambertMaterial;
  private goldMat: THREE.MeshLambertMaterial;

  constructor(scene: THREE.Scene, sounds: SoundManager, particles: ParticleSystem) {
    this.scene = scene;
    this.sounds = sounds;
    this.particles = particles;

    this.pillarGeo = new THREE.CylinderGeometry(0.28, 0.35, 4.2, 8);
    this.pillarMat = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.SANDSTONE });
    this.archGeo = new THREE.BoxGeometry(5.2, 0.45, 0.6);
    this.archMat = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.SANDSTONE_DARK });
    this.goldMat = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.GOLD });
  }

  // Last clock time update() saw — flashGate() anchors its 0.25s flash to it.
  private lastTime = 0;

  public createGatePair(
    z: number,
    leftOp: GateOp,
    leftVal: number,
    rightOp: GateOp,
    rightVal: number,
    opts?: { golden?: 'left' | 'right'; moving?: boolean }
  ) {
    const halfWidth = CONSTANTS.ROAD_WIDTH * 0.48;
    // Left gate centered at -ROAD_WIDTH/4
    const leftX = -halfWidth / 2;
    // Right gate centered at +ROAD_WIDTH/4
    const rightX = halfWidth / 2;
    const gateWidth = halfWidth - 0.4;

    // A golden side is forced to mult x5 with the golden look; a moving pair
    // drifts both sides (see spawnSingleGate).
    const goldenLeft = opts?.golden === 'left';
    const goldenRight = opts?.golden === 'right';
    this.spawnSingleGate(leftX, z, goldenLeft ? 'mult' : leftOp, goldenLeft ? 5 : leftVal, gateWidth, {
      golden: goldenLeft,
      moving: opts?.moving
    });
    this.spawnSingleGate(rightX, z, goldenRight ? 'mult' : rightOp, goldenRight ? 5 : rightVal, gateWidth, {
      golden: goldenRight,
      moving: opts?.moving
    });
  }

  public spawnSingleGate(
    x: number,
    z: number,
    op: GateOp,
    value: number,
    width: number = 5.2,
    opts?: { golden?: boolean; moving?: boolean }
  ) {
    const isPositive = op !== 'sub';
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Left Torana Pillar
    const leftPillar = new THREE.Mesh(this.pillarGeo, this.pillarMat);
    leftPillar.position.set(-width / 2, 2.1, 0);
    leftPillar.castShadow = true;
    group.add(leftPillar);

    // Right Torana Pillar
    const rightPillar = new THREE.Mesh(this.pillarGeo, this.pillarMat);
    rightPillar.position.set(width / 2, 2.1, 0);
    rightPillar.castShadow = true;
    group.add(rightPillar);

    // Arch Beam
    const arch = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.8, 0.45, 0.6),
      this.archMat
    );
    arch.position.set(0, 4.1, 0);
    arch.castShadow = true;
    group.add(arch);

    // Kalasa Finials (Indian domes on top of pillars)
    const finialGeo = new THREE.ConeGeometry(0.25, 0.6, 6);
    const leftFinial = new THREE.Mesh(finialGeo, this.goldMat);
    leftFinial.position.set(-width / 2, 4.5, 0);
    group.add(leftFinial);

    const rightFinial = new THREE.Mesh(finialGeo, this.goldMat);
    rightFinial.position.set(width / 2, 4.5, 0);
    group.add(rightFinial);

    // Portal Texture Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const texture = new THREE.CanvasTexture(canvas);
    this.renderGateTexture(canvas, op, value, isPositive, opts?.golden === true);
    texture.needsUpdate = true;

    // Glowing Portal Field
    const portalGeo = new THREE.PlaneGeometry(width - 0.2, 3.8);
    const portalMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    const portalMesh = new THREE.Mesh(portalGeo, portalMat);
    portalMesh.position.set(0, 2.0, 0);
    group.add(portalMesh);

    // Phase 1 (master plan): a pulsing gold ring on x (mult) gates, so the
    // multiplier reads as the prize at a glance. Reuses the shared gold
    // material and the group's own transform — no new textures, and it
    // leaves with the group on prune/dispose. Phase 2: golden x5 gates get
    // a thicker ring (tube 0.14 vs 0.09) that pulses faster in update().
    let ringMesh: THREE.Mesh | undefined;
    if (op === 'mult') {
      const tube = opts?.golden === true ? 0.14 : 0.09;
      ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.9, tube, 8, 40), this.goldMat);
      ringMesh.position.set(0, 2.0, 0.15);
      group.add(ringMesh);
    }

    this.scene.add(group);

    this.gates.push({
      group,
      op,
      value,
      x,
      z,
      width,
      isPositive,
      collected: false,
      portalMesh,
      textureCanvas: canvas,
      texture,
      ringMesh,
      golden: opts?.golden === true,
      moving: opts?.moving === true,
      moveAmp: 1.2,
      moveSpeed: 0.8,
      movePhase: Math.random() * Math.PI * 2,
      baseX: x,
      flashT: 0,
      flashUntil: 0,
      spent: false
    });
  }

  private renderGateTexture(
    canvas: HTMLCanvasElement,
    op: GateOp,
    val: number,
    isPositive: boolean,
    golden: boolean = false
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (golden) {
      // Phase 2: golden gates get a brighter gold gradient than plain x gates.
      grad.addColorStop(0, 'rgba(253, 230, 138, 0.95)');
      grad.addColorStop(1, 'rgba(217, 119, 6, 0.85)');
    } else if (op === 'mult') {
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.95)');
      grad.addColorStop(1, 'rgba(180, 83, 9, 0.85)');
    } else if (isPositive) {
      grad.addColorStop(0, 'rgba(14, 165, 233, 0.95)');
      grad.addColorStop(1, 'rgba(3, 105, 161, 0.85)');
    } else {
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
      grad.addColorStop(1, 'rgba(153, 27, 27, 0.85)');
    }

    ctx.fillStyle = grad;
    ctx.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 24);
    ctx.fill();

    // Ornate gold border
    ctx.lineWidth = 10;
    ctx.strokeStyle = op === 'mult' ? '#fef08a' : (isPositive ? '#7dd3fc' : '#fca5a5');
    ctx.stroke();

    // Text formatting
    let sign = '+';
    if (op === 'mult') sign = '×';
    if (op === 'sub') sign = '-';

    const text = golden ? '×5' : `${sign}${val}`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Phase 1 (master plan): value text 1.5x bigger (130px -> 195px).
    ctx.font = '900 195px Cinzel, serif';

    // Phase 1 (master plan): a skull crowns - (sub) gates, so the hazard
    // reads before the number does. The number + subtitle shift down on
    // sub gates to make room for it; other gates keep the old layout.
    const textY = op === 'sub' ? canvas.height / 2 + 10 : canvas.height / 2 - 14;
    const subY = op === 'sub' ? canvas.height / 2 + 115 : canvas.height / 2 + 85;
    if (op === 'sub') {
      ctx.font = '64px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('☠', canvas.width / 2, 62);
      ctx.font = '900 195px Cinzel, serif';
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(text, canvas.width / 2 + 4, textY + 4);

    // Main text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, textY);

    // Subtitle label
    ctx.font = '700 36px Rajdhani, sans-serif';
    ctx.fillStyle = '#fef3c7';
    const sub = golden
      ? 'GOLDEN GATE'
      : op === 'mult'
        ? 'ARMY MULTIPLIER'
        : isPositive
          ? 'WARRIORS'
          : 'HAZARD';
    ctx.fillText(sub, canvas.width / 2, subY);
  }

  public checkPlayerCollision(
    playerX: number,
    playerZ: number,
    onGateTriggered: (op: GateOp, val: number, isPositive: boolean) => void
  ) {
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      if (g.collected) continue;

      // Check if player passed the gate's Z plane
      const dz = playerZ - g.z;
      if (dz >= 0 && dz <= 2.2) {
        // Check X overlap
        const half = g.width / 2 + 0.6;
        if (playerX >= g.x - half && playerX <= g.x + half) {
          g.collected = true;

          // Dissolve visual
          g.portalMesh.visible = false;
          if (g.ringMesh) g.ringMesh.visible = false;
          this.sounds.playGatePass(g.isPositive);
          this.particles.spawnSparks(
            new THREE.Vector3(g.x, 2.0, g.z),
            18,
            g.isPositive ? 0x38bdf8 : 0xef4444
          );

          onGateTriggered(g.op, g.value, g.isPositive);
        }
      }
    }
  }

  /**
   * Phase 2 (Topkhana stream): one stream soldier crossed from prevZ to z
   * this frame. Returns the first live gate whose plane the soldier crossed
   * while inside the gate's current x-range (the group's live position, so
   * moving gates are tested where they are now, not where they spawned).
   * Gates stay live while the stream passes — nothing is marked collected
   * here; Game applies the effect and the juice. Returns null when no gate
   * was crossed. Zero allocations on the no-hit path.
   */
  public processStreamSoldier(
    x: number,
    prevZ: number,
    z: number,
    warbandZ: number
  ): GateStreamEvent | null {
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      if (g.spent || g.collected) continue;
      // A gate is dead once no in-flight stream soldier can still reach
      // it: soldiers spawn at the cannon (warbandZ - TOPKHANA_TRAIL_Z),
      // so the gate stays live until the warband is a full trail past it.
      // update() has not marked it spent yet this frame.
      if (g.z < warbandZ - CONSTANTS.TOPKHANA_TRAIL_Z) continue;
      if (prevZ < g.z && g.z <= z) {
        const gx = g.group.position.x;
        const half = g.width / 2 + 0.6;
        if (x >= gx - half && x <= gx + half) {
          return { op: g.op, value: g.value, isGolden: g.golden === true, x: g.x, z: g.z, gate: g };
        }
      }
    }
    return null;
  }

  /**
   * Phase 2 juice (J3): spikes the gate's portal opacity and ring scale
   * for ~0.25s. Time-based — update() decays it from the last clock it saw,
   * so no dt is needed here.
   */
  public flashGate(gate: GateData): void {
    gate.flashUntil = this.lastTime + 0.25;
    gate.flashT = 0.25;
  }

  public update(time: number, warbandZ?: number) {
    this.lastTime = time;
    // Subtle animated shimmer on portal fields
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      if (g.collected) continue;
      const portalMat = g.portalMesh.material as THREE.MeshBasicMaterial;
      // Phase 2: moving gates drift side-to-side around their spawn x.
      if (g.moving) {
        g.group.position.x =
          (g.baseX ?? g.x) +
          Math.sin(time * (g.moveSpeed ?? 0.8) + (g.movePhase ?? 0)) * (g.moveAmp ?? 1.2);
      }
      // Phase 2: once the warband is a full cannon-trail past a gate it
      // is spent — dimmed, ring hidden, and the stream scores no more
      // through it. (Trail distance, not 2z: in-flight soldiers spawned
      // at the cannon can still cross it until then.)
      if (warbandZ !== undefined && !g.spent && warbandZ > g.z + CONSTANTS.TOPKHANA_TRAIL_Z) {
        g.spent = true;
        portalMat.opacity = 0.25;
        if (g.ringMesh) g.ringMesh.visible = false;
      }
      if (g.spent) continue;
      // Phase 2 (J3 flash): while the flash runs, portal pins at full
      // opacity and the ring spikes; otherwise the usual shimmer + pulse.
      // Golden rings pulse faster (sin(time*5) vs sin(time*3)).
      const ringRate = g.golden === true ? 5 : 3;
      if ((g.flashUntil ?? 0) > time) {
        const remain = (g.flashUntil ?? 0) - time;
        g.flashT = remain;
        portalMat.opacity = 1.0;
        if (g.ringMesh) {
          const s = (1 + Math.sin(time * ringRate + i) * 0.08) * (1 + remain);
          g.ringMesh.scale.setScalar(s);
        }
        continue;
      }
      g.flashT = 0;
      portalMat.opacity = 0.82 + Math.sin(time * 6 + i) * 0.12;
      // Phase 1 (master plan): the gold ring on x (mult) gates pulses,
      // so the multiplier keeps drawing the eye. Scale-only — the shared
      // gold material is never touched.
      if (g.ringMesh) {
        const s = 1 + Math.sin(time * ringRate + i) * 0.08;
        g.ringMesh.scale.setScalar(s);
      }
    }
  }

  public reset() {
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      g.collected = false;
      // Phase 2: clear the stream state too — spent/flash — and put moving
      // gates back on their spawn x with full portal opacity.
      g.spent = false;
      g.flashT = 0;
      g.flashUntil = 0;
      g.portalMesh.visible = true;
      (g.portalMesh.material as THREE.MeshBasicMaterial).opacity = 0.88;
      g.group.position.x = g.baseX ?? g.x;
      if (g.ringMesh) {
        g.ringMesh.visible = true;
        g.ringMesh.scale.setScalar(1);
      }
    }
  }

  /**
   * Phase 2 (Doomfall endless): shift every gate along the road (world
   * wrap — the player marches forever, so the world slides back under
   * them). Stored z and the scene group move together.
   */
  public shiftZ(delta: number) {
    for (const g of this.gates) {
      g.z += delta;
      g.group.position.z += delta;
    }
  }

  /**
   * Phase 2 (Doomfall endless): drop gates the player has already passed
   * (collected or not — a gate behind the player can never trigger again),
   * so a long endless run does not accumulate canvas textures forever.
   */
  public pruneBefore(z: number) {
    const kept: GateData[] = [];
    for (const g of this.gates) {
      if (g.z < z) {
        this.scene.remove(g.group);
        g.texture.dispose();
      } else {
        kept.push(g);
      }
    }
    this.gates = kept;
  }

  public dispose() {
    this.gates.forEach(g => {
      this.scene.remove(g.group);
      g.texture.dispose();
    });
    this.gates = [];
    this.pillarGeo.dispose();
    this.pillarMat.dispose();
    this.archGeo.dispose();
    this.archMat.dispose();
    this.goldMat.dispose();
  }
}
