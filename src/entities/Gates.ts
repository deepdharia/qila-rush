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

  public createGatePair(
    z: number,
    leftOp: GateOp,
    leftVal: number,
    rightOp: GateOp,
    rightVal: number
  ) {
    const halfWidth = CONSTANTS.ROAD_WIDTH * 0.48;
    // Left gate centered at -ROAD_WIDTH/4
    const leftX = -halfWidth / 2;
    // Right gate centered at +ROAD_WIDTH/4
    const rightX = halfWidth / 2;
    const gateWidth = halfWidth - 0.4;

    this.spawnSingleGate(leftX, z, leftOp, leftVal, gateWidth);
    this.spawnSingleGate(rightX, z, rightOp, rightVal, gateWidth);
  }

  public spawnSingleGate(
    x: number,
    z: number,
    op: GateOp,
    value: number,
    width: number = 5.2
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
    this.renderGateTexture(canvas, op, value, isPositive);
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
      texture
    });
  }

  private renderGateTexture(
    canvas: HTMLCanvasElement,
    op: GateOp,
    val: number,
    isPositive: boolean
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (op === 'mult') {
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

    const text = `${sign}${val}`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 130px Cinzel, serif';

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(text, canvas.width / 2 + 4, canvas.height / 2 - 10);

    // Main text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 14);

    // Subtitle label
    ctx.font = '700 36px Rajdhani, sans-serif';
    ctx.fillStyle = '#fef3c7';
    const sub = op === 'mult' ? 'ARMY MULTIPLIER' : (isPositive ? 'WARRIORS' : 'HAZARD');
    ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 85);
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

  public update(time: number) {
    // Subtle animated shimmer on portal fields
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      if (!g.collected) {
        (g.portalMesh.material as THREE.MeshBasicMaterial).opacity =
          0.82 + Math.sin(time * 6 + i) * 0.12;
      }
    }
  }

  public reset() {
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      g.collected = false;
      g.portalMesh.visible = true;
    }
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
