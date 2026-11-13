import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import { getWoodTexture } from '../utils/CanvasTextures';
import { SoundManager } from '../audio/SoundManager';
import { ParticleSystem } from './ParticleSystem';

export interface BarrierReward {
  type: 'fire_arrows' | 'double_shot' | 'cannon_bonus';
  warriorsReward: number;
  label: string;
}

export interface BarrierData {
  group: THREE.Group;
  x: number;
  z: number;
  width: number;
  health: number;
  maxHealth: number;
  reward: BarrierReward;
  destroyed: boolean;
  rammed: boolean; // F3 fix: ram casualties fire once per barrier, not per frame
  hpCanvas: HTMLCanvasElement;
  hpTexture: THREE.CanvasTexture;
  hpMesh: THREE.Mesh;
  timberMesh: THREE.Mesh;
}

export class BarrierManager {
  private scene: THREE.Scene;
  private sounds: SoundManager;
  private particles: ParticleSystem;

  public barriers: BarrierData[] = [];

  constructor(scene: THREE.Scene, sounds: SoundManager, particles: ParticleSystem) {
    this.scene = scene;
    this.sounds = sounds;
    this.particles = particles;
  }

  public spawnBarrier(
    z: number,
    health: number,
    reward: BarrierReward,
    width: number = CONSTANTS.ROAD_WIDTH - 0.8
  ) {
    const group = new THREE.Group();
    group.position.set(0, 0, z);

    // Heavy Timber & Iron Barricade Frame — canvas-generated wood planks
    // (grain, knots, plank gaps, nail heads) instead of flat brown.
    const timberGeo = new THREE.BoxGeometry(width, 3.2, 1.2);
    const woodTex = getWoodTexture().clone();
    woodTex.needsUpdate = true;
    woodTex.repeat.set(3, 1);
    const timberMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.85,
      metalness: 0.15
    });
    const timberMesh = new THREE.Mesh(timberGeo, timberMat);
    timberMesh.position.y = 1.6;
    timberMesh.castShadow = true;
    timberMesh.receiveShadow = true;
    group.add(timberMesh);

    // Iron Braces & Brass Spikes
    const spikeGeo = new THREE.ConeGeometry(0.18, 0.7, 6);
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.8
    });

    const spikeCount = Math.floor(width / 1.2);
    for (let i = 0; i < spikeCount; i++) {
      const sx = ((i / (spikeCount - 1 || 1)) - 0.5) * (width - 1.2);
      const spike = new THREE.Mesh(spikeGeo, ironMat);
      spike.rotation.x = -Math.PI / 2;
      spike.position.set(sx, 1.6, -0.65);
      group.add(spike);
    }

    // 3D Floating Health & Reward Badge
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width = 512;
    hpCanvas.height = 256;
    const hpTexture = new THREE.CanvasTexture(hpCanvas);
    this.renderBadgeTexture(hpCanvas, health, health, reward.label);
    hpTexture.needsUpdate = true;

    const badgeGeo = new THREE.PlaneGeometry(3.6, 1.8);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: hpTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const hpMesh = new THREE.Mesh(badgeGeo, badgeMat);
    hpMesh.position.set(0, 3.8, 0);
    group.add(hpMesh);

    this.scene.add(group);

    this.barriers.push({
      group,
      x: 0,
      z,
      width,
      health,
      maxHealth: health,
      reward,
      destroyed: false,
      rammed: false,
      hpCanvas,
      hpTexture,
      hpMesh,
      timberMesh
    });
  }

  private renderBadgeTexture(
    canvas: HTMLCanvasElement,
    hp: number,
    maxHp: number,
    rewardLabel: string
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Badge Card
    const pct = Math.max(0, hp / maxHp);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1c1917');
    grad.addColorStop(1, '#0c0a09');

    ctx.fillStyle = grad;
    ctx.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 20);
    ctx.fill();

    // Health Bar Container
    ctx.fillStyle = '#441414';
    ctx.roundRect(32, 32, canvas.width - 64, 50, 12);
    ctx.fill();

    // Health Bar Fill
    const fillWidth = (canvas.width - 64) * pct;
    ctx.fillStyle = pct > 0.4 ? '#f59e0b' : '#ef4444';
    ctx.roundRect(32, 32, fillWidth, 50, 12);
    ctx.fill();

    // Health Number Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 42px Cinzel, serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(`GATE HP: ${Math.ceil(hp)}`, canvas.width / 2, 57);
    ctx.shadowBlur = 0;

    // Reward Unlock Banner
    ctx.font = '800 32px Rajdhani, sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`UNLOCKS: ${rewardLabel}`, canvas.width / 2, 130);

    ctx.font = '600 24px Rajdhani, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('BREAK TO COLLECT BONUS', canvas.width / 2, 185);

    // Golden Border
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#d97706';
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
  }

  public applyDamage(
    barrier: BarrierData,
    damage: number,
    onBreak: (reward: BarrierReward) => void
  ) {
    if (barrier.destroyed) return;

    barrier.health -= damage;
    this.particles.spawnWoodSplinters(barrier.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 8);
    this.sounds.playBarrierHit();

    if (barrier.health <= 0) {
      barrier.health = 0;
      barrier.destroyed = true;
      barrier.group.visible = false;

      this.sounds.playBarrierBreak();
      this.particles.spawnWoodSplinters(barrier.group.position.clone().add(new THREE.Vector3(0, 2, 0)), 30);
      this.particles.spawnExplosion(barrier.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 4.0);

      onBreak(barrier.reward);
    } else {
      this.renderBadgeTexture(
        barrier.hpCanvas,
        barrier.health,
        barrier.maxHealth,
        barrier.reward.label
      );
      barrier.hpTexture.needsUpdate = true;
    }
  }

  public checkPlayerCollision(
    playerZ: number,
    onRamCasualties: (lostCount: number) => void
  ) {
    for (let i = 0; i < this.barriers.length; i++) {
      const b = this.barriers[i];
      if (b.destroyed || b.rammed) continue;

      const dz = playerZ - b.z;
      if (dz >= -0.5 && dz <= 1.2) {
        // Ramming an unbroken gate causes casualties — once per barrier.
        b.rammed = true;
        onRamCasualties(5);
        this.sounds.playBarrierHit();
        this.particles.spawnWoodSplinters(b.group.position, 15);
      }
    }
  }

  public getActiveTargets(): { position: THREE.Vector3; health: number; barrierRef: BarrierData }[] {
    const list = [];
    for (let i = 0; i < this.barriers.length; i++) {
      const b = this.barriers[i];
      if (!b.destroyed && b.health > 0) {
        list.push({
          position: new THREE.Vector3(b.x, 1.6, b.z),
          health: b.health,
          barrierRef: b
        });
      }
    }
    return list;
  }

  public reset() {
    for (let i = 0; i < this.barriers.length; i++) {
      const b = this.barriers[i];
      b.health = b.maxHealth;
      b.destroyed = false;
      b.rammed = false;
      b.group.visible = true;
      this.renderBadgeTexture(b.hpCanvas, b.health, b.maxHealth, b.reward.label);
      b.hpTexture.needsUpdate = true;
    }
  }

  public dispose() {
    this.barriers.forEach(b => {
      this.scene.remove(b.group);
      b.hpTexture.dispose();
    });
    this.barriers = [];
  }
}
