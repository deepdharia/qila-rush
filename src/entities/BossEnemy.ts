import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import { ParticleSystem } from './ParticleSystem';
import { SoundManager } from '../audio/SoundManager';

export class BossEnemy {
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private sounds: SoundManager;

  public root: THREE.Group;
  public position: THREE.Vector3;
  public health: number = 600;
  public maxHealth: number = 600;
  public active: boolean = false;
  public isDefeated: boolean = false;

  // Boss visual components
  private torsoGroup: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private telegraphCircle: THREE.Mesh;

  // Boss attack state
  private attackTimer: number = 0;
  private isSlamming: boolean = false;
  private slamTimer: number = 0;
  private animTimer: number = 0;
  public speed: number = 2.0;

  constructor(scene: THREE.Scene, particles: ParticleSystem, sounds: SoundManager) {
    this.scene = scene;
    this.particles = particles;
    this.sounds = sounds;

    this.root = new THREE.Group();
    this.position = new THREE.Vector3(0, 0, CONSTANTS.BOSS_ARENA_Z + 18);
    this.root.position.copy(this.position);
    this.root.visible = false;
    this.scene.add(this.root);

    // Build Epic Procedural Boss Model (3.5x Scale)
    const scale = 3.2;
    const bossMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.35,
      metalness: 0.7
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: CONSTANTS.COLORS.GOLD,
      roughness: 0.2,
      metalness: 0.85
    });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.1,
      metalness: 0.95
    });

    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 0.85 * scale;

    // Heavy Plated Torso
    const torsoGeo = new THREE.CylinderGeometry(0.28 * scale, 0.38 * scale, 0.8 * scale, 8);
    const torsoMesh = new THREE.Mesh(torsoGeo, bossMat);
    torsoMesh.castShadow = true;
    this.torsoGroup.add(torsoMesh);

    // Ornate Golden Breastplate Trim
    const trimGeo = new THREE.TorusGeometry(0.35 * scale, 0.06 * scale, 8, 16);
    const trimMesh = new THREE.Mesh(trimGeo, goldMat);
    trimMesh.rotation.x = Math.PI / 2;
    trimMesh.position.y = 0.1 * scale;
    this.torsoGroup.add(trimMesh);

    // Giant Spiked Pauldrons (Shoulder Guards)
    const pauldronGeo = new THREE.SphereGeometry(0.22 * scale, 8, 8);
    const leftPauldron = new THREE.Mesh(pauldronGeo, goldMat);
    leftPauldron.position.set(-0.45 * scale, 0.35 * scale, 0);
    this.torsoGroup.add(leftPauldron);

    const rightPauldron = new THREE.Mesh(pauldronGeo, goldMat);
    rightPauldron.position.set(0.45 * scale, 0.35 * scale, 0);
    this.torsoGroup.add(rightPauldron);

    // Head
    const headGeo = new THREE.SphereGeometry(0.2 * scale, 8, 8);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.55 * scale;
    this.torsoGroup.add(head);

    // Royal Warlord Crowned Turban / Spiked Helm
    const helmGeo = new THREE.ConeGeometry(0.24 * scale, 0.45 * scale, 8);
    const helm = new THREE.Mesh(helmGeo, goldMat);
    helm.position.y = 0.75 * scale;
    this.torsoGroup.add(helm);

    const spikeGeo = new THREE.ConeGeometry(0.04 * scale, 0.3 * scale, 6);
    const spike = new THREE.Mesh(spikeGeo, bladeMat);
    spike.position.y = 1.0 * scale;
    this.torsoGroup.add(spike);

    // Dual Giant Shamshir Blades (Curved Scimitars)
    const bladeGeo = new THREE.BoxGeometry(0.12 * scale, 1.2 * scale, 0.04 * scale);

    // Left Arm
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.42 * scale, 0.28 * scale, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.08 * scale, 0.55 * scale), bossMat);
    leftArmMesh.position.y = -0.25 * scale;
    this.leftArm.add(leftArmMesh);

    const leftBlade = new THREE.Mesh(bladeGeo, bladeMat);
    leftBlade.position.set(0, -0.6 * scale, 0.3 * scale);
    leftBlade.rotation.x = 0.6;
    this.leftArm.add(leftBlade);
    this.torsoGroup.add(this.leftArm);

    // Right Arm
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.42 * scale, 0.28 * scale, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.08 * scale, 0.55 * scale), bossMat);
    rightArmMesh.position.y = -0.25 * scale;
    this.rightArm.add(rightArmMesh);

    const rightBlade = new THREE.Mesh(bladeGeo, bladeMat);
    rightBlade.position.set(0, -0.6 * scale, 0.3 * scale);
    rightBlade.rotation.x = 0.6;
    this.rightArm.add(rightBlade);
    this.torsoGroup.add(this.rightArm);

    this.root.add(this.torsoGroup);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12 * scale, 0.1 * scale, 0.65 * scale);
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.2 * scale, 0.65 * scale, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, bossMat);
    leftLegMesh.position.y = -0.3 * scale;
    this.leftLeg.add(leftLegMesh);
    this.root.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.2 * scale, 0.65 * scale, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, bossMat);
    rightLegMesh.position.y = -0.3 * scale;
    this.rightLeg.add(rightLegMesh);
    this.root.add(this.rightLeg);

    // Red Ground Slam Telegraph Ring
    const telegraphGeo = new THREE.RingGeometry(0.2, 5.0, 32);
    const telegraphMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    this.telegraphCircle = new THREE.Mesh(telegraphGeo, telegraphMat);
    this.telegraphCircle.rotation.x = -Math.PI / 2;
    this.telegraphCircle.position.y = 0.05;
    this.telegraphCircle.visible = false;
    this.scene.add(this.telegraphCircle);
  }

  public activate() {
    this.active = true;
    this.isDefeated = false;
    this.health = this.maxHealth;
    this.root.visible = true;
    this.sounds.playBossRoar();
    this.sounds.setBossMode(true);
  }

  public update(
    dt: number,
    playerX: number,
    playerZ: number,
    onSlamHit: (damageCount: number) => void
  ) {
    if (!this.active || this.isDefeated) return;

    this.animTimer += dt;
    this.attackTimer += dt;

    // Turn to face player
    this.root.lookAt(playerX, 0, playerZ);

    // Follow player laterally
    const dx = playerX - this.position.x;
    this.position.x += dx * Math.min(1.0, 2.0 * dt);

    // Advance towards player if too far
    const targetZ = Math.max(playerZ + 6.0, CONSTANTS.BOSS_ARENA_Z + 4.0);
    if (this.position.z > targetZ) {
      this.position.z -= this.speed * dt;
    }
    this.root.position.copy(this.position);

    // Check special attack (Ground Slam) every 4 seconds in Phase 2
    if (!this.isSlamming && this.health < this.maxHealth * 0.7 && this.attackTimer > 4.2) {
      this.startGroundSlam();
    }

    if (this.isSlamming) {
      this.handleSlamUpdate(dt, playerX, playerZ, onSlamHit);
    } else {
      // Normal walking & blade slashing animation
      const stride = Math.sin(this.animTimer * 5) * 0.5;
      this.leftLeg.rotation.x = stride;
      this.rightLeg.rotation.x = -stride;

      const slash = Math.sin(this.animTimer * 6) * 0.8;
      this.leftArm.rotation.x = -0.8 + slash;
      this.rightArm.rotation.x = -0.8 - slash;
    }
  }

  private startGroundSlam() {
    this.isSlamming = true;
    this.slamTimer = 0;
    this.attackTimer = 0;

    // Show telegraph ring
    this.telegraphCircle.position.set(this.position.x, 0.05, this.position.z - 2.0);
    this.telegraphCircle.scale.set(0.1, 0.1, 0.1);
    this.telegraphCircle.visible = true;
  }

  private handleSlamUpdate(
    dt: number,
    playerX: number,
    playerZ: number,
    onSlamHit: (damageCount: number) => void
  ) {
    this.slamTimer += dt;

    if (this.slamTimer < 1.0) {
      // Jump up preparation
      const progress = this.slamTimer / 1.0;
      this.root.position.y = Math.sin(progress * Math.PI) * 2.5;

      // Expand telegraph circle
      this.telegraphCircle.scale.setScalar(progress);
      this.leftArm.rotation.x = -2.2;
      this.rightArm.rotation.x = -2.2;
    } else if (this.slamTimer >= 1.0 && this.slamTimer < 1.3) {
      // Slam down!
      this.root.position.y = 0;
      this.sounds.playBossSlam();
      this.particles.spawnExplosion(this.telegraphCircle.position, 5.0);

      // Check if player army is in blast radius
      const distToSlam = this.telegraphCircle.position.distanceTo(new THREE.Vector3(playerX, 0, playerZ));
      if (distToSlam < 4.8) {
        onSlamHit(6); // Heavy casualty from boss slam
      }

      this.telegraphCircle.visible = false;
      this.isSlamming = false;
      this.attackTimer = 0;
    }
  }

  public takeDamage(amount: number): boolean {
    if (!this.active || this.isDefeated) return false;

    this.health = Math.max(0, this.health - amount);
    this.particles.spawnSparks(this.position.clone().add(new THREE.Vector3(0, 2.0, 0)), 6, 0xf59e0b);

    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die() {
    this.isDefeated = true;
    this.active = false;
    this.telegraphCircle.visible = false;

    // Dramatic defeat collapse
    this.torsoGroup.rotation.x = 1.2;
    this.root.position.y = 0.3;

    this.particles.spawnExplosion(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 8.0);
    this.sounds.playBossRoar();
  }

  public reset() {
    this.active = false;
    this.isDefeated = false;
    this.health = this.maxHealth;
    this.position.set(0, 0, CONSTANTS.BOSS_ARENA_Z + 18);
    this.root.position.copy(this.position);
    this.root.position.y = 0;
    this.torsoGroup.rotation.set(0, 0, 0);
    this.root.visible = false;
    this.telegraphCircle.visible = false;
    this.isSlamming = false;
    this.attackTimer = 0;
  }

  public dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.telegraphCircle);
  }
}
