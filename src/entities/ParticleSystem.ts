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

// Floating combat text: one pooled sprite per slot, each with its own
// canvas + texture so text can be redrawn on spawn without allocations.
interface DamageNumber {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  life: number;
  maxLife: number;
  riseSpeed: number;
  active: boolean;
}

export type DamageNumberKind = 'hit' | 'fire' | 'barrier' | 'boss' | 'graze' | 'combo';

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private poolSize = 350;

  private damageNumbers: DamageNumber[] = [];
  private damageNumberPoolSize = 24;

  private sparkGeo: THREE.BufferGeometry;
  private sparkMat: THREE.MeshBasicMaterial;
  private woodGeo: THREE.BufferGeometry;
  private woodMat: THREE.MeshLambertMaterial;
  private fireGeo: THREE.BufferGeometry;
  private fireMat: THREE.MeshBasicMaterial;
  private petalGeo: THREE.BufferGeometry;
  private petalMat: THREE.MeshLambertMaterial;
  private dustGeo: THREE.BufferGeometry;
  private dustMat: THREE.MeshBasicMaterial;

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

    this.dustGeo = new THREE.SphereGeometry(0.14, 4, 4);
    this.dustMat = new THREE.MeshBasicMaterial({ color: 0xcbb27a });

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

    // Pre-allocate floating-text sprites (canvas-texture, camera-facing).
    for (let i = 0; i < this.damageNumberPoolSize; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.scale.set(1.8, 0.9, 1);
      this.scene.add(sprite);

      this.damageNumbers.push({
        sprite,
        canvas,
        texture,
        life: 0,
        maxLife: 0.9,
        riseSpeed: 2.2,
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

  public spawnDustBurst(pos: THREE.Vector3, count: number = 20) {
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.mesh.geometry = this.dustGeo;
      p.mesh.material = this.dustMat;
      p.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 1.5,
        Math.max(0.15, pos.y + Math.random() * 0.4),
        pos.z + (Math.random() - 0.5) * 1.5
      );
      p.mesh.visible = true;

      const speed = 2.0 + Math.random() * 4.5;
      const angle = Math.random() * Math.PI * 2;
      p.velocity.set(
        Math.cos(angle) * speed,
        0.8 + Math.random() * 2.2,
        Math.sin(angle) * speed
      );
      p.rotVelocity.set(0, 0, 0);
      p.life = 0;
      p.maxLife = 0.6 + Math.random() * 0.5;
      p.scaleInitial = 1.0 + Math.random() * 1.6;
      p.mesh.scale.setScalar(p.scaleInitial);
    }
  }

  private getFreeDamageNumber(): DamageNumber | null {
    for (let i = 0; i < this.damageNumberPoolSize; i++) {
      if (!this.damageNumbers[i].active) {
        return this.damageNumbers[i];
      }
    }
    return null;
  }

  /**
   * Floating combat text. Pooled canvas-texture sprites — no DOM, no
   * per-frame allocation (canvas is redrawn only on spawn).
   */
  public spawnFloatingText(pos: THREE.Vector3, text: string, kind: DamageNumberKind = 'hit') {
    const n = this.getFreeDamageNumber();
    if (!n) return;

    const colors: Record<DamageNumberKind, string> = {
      hit: '#fef08a',
      fire: '#fb923c',
      barrier: '#fbbf24',
      boss: '#f59e0b',
      graze: '#a5f3fc',
      combo: '#fde047'
    };
    const scales: Record<DamageNumberKind, number> = {
      hit: 1.0,
      fire: 1.1,
      barrier: 1.2,
      boss: 1.7,
      graze: 1.0,
      combo: 1.5
    };

    const ctx = n.canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, n.canvas.width, n.canvas.height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 62px Rajdhani, sans-serif';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(text, n.canvas.width / 2, n.canvas.height / 2);
      ctx.fillStyle = colors[kind];
      ctx.fillText(text, n.canvas.width / 2, n.canvas.height / 2);
    }
    n.texture.needsUpdate = true;

    const s = scales[kind];
    n.sprite.scale.set(1.8 * s, 0.9 * s, 1);
    n.sprite.position.set(
      pos.x + (Math.random() - 0.5) * 0.8,
      pos.y + 0.6,
      pos.z
    );
    (n.sprite.material as THREE.SpriteMaterial).opacity = 1;
    n.sprite.visible = true;
    n.life = 0;
    n.maxLife = kind === 'combo' || kind === 'graze' ? 1.2 : 0.9;
    n.riseSpeed = 2.2;
    n.active = true;
  }

  /** Damage dealt to a barrier / enemy / boss, as a floating number. */
  public spawnDamageNumber(pos: THREE.Vector3, amount: number, kind: DamageNumberKind = 'hit') {
    this.spawnFloatingText(pos, `${Math.max(1, Math.round(amount))}`, kind);
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

    // Floating damage numbers: rise and fade out.
    for (let i = 0; i < this.damageNumberPoolSize; i++) {
      const n = this.damageNumbers[i];
      if (!n.active) continue;

      n.life += dt;
      if (n.life >= n.maxLife) {
        n.active = false;
        n.sprite.visible = false;
        continue;
      }

      n.sprite.position.y += n.riseSpeed * dt;
      (n.sprite.material as THREE.SpriteMaterial).opacity = 1 - n.life / n.maxLife;
    }
  }

  public dispose() {
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
    });
    this.particles = [];
    this.damageNumbers.forEach(n => {
      this.scene.remove(n.sprite);
      n.texture.dispose();
      (n.sprite.material as THREE.SpriteMaterial).dispose();
    });
    this.damageNumbers = [];
    this.sparkGeo.dispose();
    this.sparkMat.dispose();
    this.woodGeo.dispose();
    this.woodMat.dispose();
    this.fireGeo.dispose();
    this.fireMat.dispose();
    this.petalGeo.dispose();
    this.petalMat.dispose();
    this.dustGeo.dispose();
    this.dustMat.dispose();
  }
}
