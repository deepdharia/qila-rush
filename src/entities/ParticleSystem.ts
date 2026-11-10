import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  rotVelocity: THREE.Vector3;
  scaleInitial: number;
  active: boolean;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private poolSize = 350;

  private sparkGeo: THREE.BufferGeometry;
  private sparkMat: THREE.MeshBasicMaterial;
  private woodGeo: THREE.BufferGeometry;
  private woodMat: THREE.MeshLambertMaterial;
  private fireGeo: THREE.BufferGeometry;
  private fireMat: THREE.MeshBasicMaterial;
  private petalGeo: THREE.BufferGeometry;
  private petalMat: THREE.MeshLambertMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.sparkGeo = new THREE.SphereGeometry(0.08, 4, 4);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    this.woodGeo = new THREE.BoxGeometry(0.18, 0.12, 0.08);
    this.woodMat = new THREE.MeshLambertMaterial({ color: 0x78350f });

    this.fireGeo = new THREE.DodecahedronGeometry(0.2, 0);
    this.fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

    this.petalGeo = new THREE.BoxGeometry(0.12, 0.02, 0.12);
    this.petalMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });

    // Pre-allocate pool
    for (let i = 0; i < this.poolSize; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        rotVelocity: new THREE.Vector3(),
        scaleInitial: 1,
        active: false
      });
    }
  }

  private getFreeParticle(): Particle | null {
    for (let i = 0; i < this.poolSize; i++) {
      if (!this.particles[i].active) {
        return this.particles[i];
      }
    }
    return null;
  }

  public spawnSparks(pos: THREE.Vector3, count: number = 6, color: number = 0xfef08a) {
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.mesh.geometry = this.sparkGeo;
      p.mesh.material = this.sparkMat;
      this.sparkMat.color.setHex(color);
      p.mesh.position.copy(pos);
      p.mesh.visible = true;

      const speed = 3.0 + Math.random() * 4.0;
      p.velocity.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed + 1.0,
        (Math.random() - 0.5) * speed
      );
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.25;
      p.scaleInitial = 0.8 + Math.random() * 0.5;
      p.mesh.scale.setScalar(p.scaleInitial);
    }
  }

  public spawnWoodSplinters(pos: THREE.Vector3, count: number = 18) {
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.mesh.geometry = this.woodGeo;
      p.mesh.material = this.woodMat;
      p.mesh.position.copy(pos);
      p.mesh.visible = true;

      const speed = 4.0 + Math.random() * 7.0;
      p.velocity.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + 2.0,
        (Math.random() - 0.5) * speed
      );
      p.rotVelocity.set(
        Math.random() * 15,
        Math.random() * 15,
        Math.random() * 15
      );
      p.life = 0;
      p.maxLife = 0.8 + Math.random() * 0.6;
      p.scaleInitial = 1.0 + Math.random() * 0.8;
      p.mesh.scale.setScalar(p.scaleInitial);
    }
  }

  public spawnExplosion(pos: THREE.Vector3, radius: number = 4.0) {
    const count = 35;
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.mesh.geometry = this.fireGeo;
      p.mesh.material = this.fireMat;
      p.mesh.position.copy(pos);
      p.mesh.visible = true;

      const speed = 5.0 + Math.random() * radius * 3.0;
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.2) * Math.PI;

      p.velocity.set(
        Math.cos(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed + 3.0,
        Math.sin(angle) * Math.cos(elevation) * speed
      );
      p.rotVelocity.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      p.life = 0;
      p.maxLife = 0.6 + Math.random() * 0.5;
      p.scaleInitial = 1.5 + Math.random() * 1.5;
      p.mesh.scale.setScalar(p.scaleInitial);
    }
  }

  public spawnVictoryPetals(pos: THREE.Vector3, count: number = 25) {
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.mesh.geometry = this.petalGeo;
      p.mesh.material = this.petalMat;
      p.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 14,
        pos.y + 10 + Math.random() * 6,
        pos.z + (Math.random() - 0.5) * 14
      );
      p.mesh.visible = true;

      p.velocity.set(
        (Math.random() - 0.5) * 2.0,
        -1.5 - Math.random() * 2.0,
        (Math.random() - 0.5) * 2.0
      );
      p.rotVelocity.set(Math.random() * 5, Math.random() * 6, Math.random() * 5);
      p.life = 0;
      p.maxLife = 2.5 + Math.random() * 1.5;
      p.scaleInitial = 1.2;
      p.mesh.scale.setScalar(p.scaleInitial);
    }
  }

  public update(dt: number) {
    const gravity = -18.0;

    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Physics
      p.velocity.y += gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Rotation
      p.mesh.rotation.x += p.rotVelocity.x * dt;
      p.mesh.rotation.y += p.rotVelocity.y * dt;
      p.mesh.rotation.z += p.rotVelocity.z * dt;

      // Fade scale
      const progress = p.life / p.maxLife;
      const scale = p.scaleInitial * (1.0 - progress);
      p.mesh.scale.setScalar(Math.max(0.01, scale));

      // Floor bounce/collision
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.velocity.y *= -0.4;
        p.velocity.x *= 0.6;
        p.velocity.z *= 0.6;
      }
    }
  }

  public dispose() {
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
    });
    this.particles = [];
    this.sparkGeo.dispose();
    this.sparkMat.dispose();
    this.woodGeo.dispose();
    this.woodMat.dispose();
    this.fireGeo.dispose();
    this.fireMat.dispose();
    this.petalGeo.dispose();
    this.petalMat.dispose();
  }
}
