import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import { ParticleSystem } from './ParticleSystem';
import { SoundManager } from '../audio/SoundManager';

export interface Projectile {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  damage: number;
  isFire: boolean;
  isCannonball: boolean;
  splashRadius: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ProjectileManager {
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private sounds: SoundManager;
  private projectiles: Projectile[] = [];
  private poolSize = 200;

  // Shared assets
  private arrowGeo: THREE.CylinderGeometry;
  private arrowMat: THREE.MeshLambertMaterial;
  private fireArrowMat: THREE.MeshLambertMaterial;
  private tipGeo: THREE.ConeGeometry;
  private tipMat: THREE.MeshBasicMaterial;
  private cannonGeo: THREE.SphereGeometry;
  private cannonMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, particles: ParticleSystem, sounds: SoundManager) {
    this.scene = scene;
    this.particles = particles;
    this.sounds = sounds;

    this.arrowGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5);
    this.arrowMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
    this.fireArrowMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
    this.tipGeo = new THREE.ConeGeometry(0.08, 0.22, 5);
    this.tipMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    this.cannonGeo = new THREE.SphereGeometry(0.55, 8, 8);
    this.cannonMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.8
    });

    // Initialize pool
    for (let i = 0; i < this.poolSize; i++) {
      const group = new THREE.Group();

      const shaft = new THREE.Mesh(this.arrowGeo, this.arrowMat);
      shaft.rotation.x = Math.PI / 2;
      group.add(shaft);

      const tip = new THREE.Mesh(this.tipGeo, this.tipMat);
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 0.5;
      group.add(tip);

      const cannonMesh = new THREE.Mesh(this.cannonGeo, this.cannonMat);
      cannonMesh.visible = false;
      group.add(cannonMesh);

      group.visible = false;
      this.scene.add(group);

      this.projectiles.push({
        mesh: group,
        velocity: new THREE.Vector3(),
        damage: CONSTANTS.ARROW_DAMAGE,
        isFire: false,
        isCannonball: false,
        splashRadius: 0,
        life: 0,
        maxLife: 2.0,
        active: false
      });
    }
  }

  private getFreeProjectile(): Projectile | null {
    for (let i = 0; i < this.poolSize; i++) {
      if (!this.projectiles[i].active) {
        return this.projectiles[i];
      }
    }
    return null;
  }

  public spawnArrow(
    startPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    isFire: boolean = false
  ) {
    const p = this.getFreeProjectile();
    if (!p) return;

    p.active = true;
    p.isFire = isFire;
    p.isCannonball = false;
    p.damage = isFire
      ? CONSTANTS.ARROW_DAMAGE * CONSTANTS.FIRE_DAMAGE_MULTIPLIER
      : CONSTANTS.ARROW_DAMAGE;
    p.splashRadius = isFire ? 1.5 : 0;
    p.life = 0;
    p.maxLife = 1.8;

    p.mesh.position.copy(startPos);
    p.mesh.position.y += 0.8; // bow height

    // Make regular arrow visible, hide cannonball
    p.mesh.children[0].visible = true;
    p.mesh.children[1].visible = true;
    p.mesh.children[2].visible = false;

    // Apply material
    (p.mesh.children[0] as THREE.Mesh).material = isFire ? this.fireArrowMat : this.arrowMat;

    // Compute velocity towards target with slight arc
    const dir = targetPos.clone().sub(startPos);
    const dist = dir.length();
    dir.normalize();

    p.velocity.copy(dir).multiplyScalar(CONSTANTS.ARROW_SPEED);
    p.velocity.y += Math.min(dist * 0.12, 3.5); // arc upward

    p.mesh.lookAt(targetPos);
    p.mesh.visible = true;
  }

  public spawnCannonball(startPos: THREE.Vector3, targetPos: THREE.Vector3) {
    const p = this.getFreeProjectile();
    if (!p) return;

    p.active = true;
    p.isFire = true;
    p.isCannonball = true;
    p.damage = CONSTANTS.CANNON_DAMAGE;
    p.splashRadius = CONSTANTS.CANNON_SPLASH_RADIUS;
    p.life = 0;
    p.maxLife = 2.5;

    p.mesh.position.copy(startPos);
    p.mesh.position.y += 1.2;

    // Show cannonball, hide arrow
    p.mesh.children[0].visible = false;
    p.mesh.children[1].visible = false;
    p.mesh.children[2].visible = true;

    // Arc velocity
    const dir = targetPos.clone().sub(startPos);
    const dist = dir.length();
    const timeToTarget = dist / 28; // cannonball flight time
    
    p.velocity.x = dir.x / timeToTarget;
    p.velocity.z = dir.z / timeToTarget;
    p.velocity.y = 12.0; // high trajectory

    p.mesh.visible = true;
    this.sounds.playCannonFire();
  }

  public update(dt: number) {
    const gravity = -18.0;

    for (let i = 0; i < this.poolSize; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife || p.mesh.position.y < 0) {
        this.deactivate(p);
        continue;
      }

      // Ballistic gravity
      p.velocity.y += gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Rotate projectile along trajectory vector
      const nextPos = p.mesh.position.clone().add(p.velocity);
      p.mesh.lookAt(nextPos);

      // Spark trail for fire arrows
      if (p.isFire && Math.random() < 0.4) {
        this.particles.spawnSparks(p.mesh.position, 1, 0xf97316);
      }
    }
  }

  public deactivate(p: Projectile) {
    p.active = false;
    p.mesh.visible = false;
  }

  public getActiveProjectiles(): Projectile[] {
    const list: Projectile[] = [];
    for (let i = 0; i < this.poolSize; i++) {
      if (this.projectiles[i].active) {
        list.push(this.projectiles[i]);
      }
    }
    return list;
  }

  public dispose() {
    this.projectiles.forEach(p => {
      this.scene.remove(p.mesh);
    });
    this.projectiles = [];
    this.arrowGeo.dispose();
    this.arrowMat.dispose();
    this.fireArrowMat.dispose();
    this.tipGeo.dispose();
    this.tipMat.dispose();
    this.cannonGeo.dispose();
    this.cannonMat.dispose();
  }
}
