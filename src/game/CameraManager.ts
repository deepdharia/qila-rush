import * as THREE from 'three';

export class CameraManager {
  public camera: THREE.PerspectiveCamera;
  private currentPos: THREE.Vector3 = new THREE.Vector3();
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  // Screen shake
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeTimer: number = 0;

  // Boss mode
  private isBossMode: boolean = false;

  // FOV juice: gate-pass kick, boss push-in, handheld sway
  private baseFov: number;
  private currentFov: number;
  private fovKick: number = 0;
  private prevPlayerZ: number = 0;
  private swayTime: number = 0;

  // Gate Z positions (mirrors the gate pairs created in Game.setupLevel).
  // Crossing one triggers the FOV kick — no Game.ts changes needed.
  // Gate Z positions for the FOV kick — set per level (default: level 1).
  private gateZ: number[] = [25, 105, 175, 245];

  /** F5 fix: point the gate FOV kick at this level's real gate positions. */
  public setGatePositions(zs: number[]): void {
    this.gateZ = [...zs].sort((a, b) => a - b);
  }

  constructor(fov: number, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 400);
    this.baseFov = fov;
    this.currentFov = fov;
    this.currentPos.set(0, 15, -14);
    this.currentLookAt.set(0, 2, 12);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  public setBossMode(active: boolean) {
    this.isBossMode = active;
  }

  public shake(intensity: number = 0.5, duration: number = 0.3) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  public update(dt: number, playerX: number, playerZ: number, armyCount: number) {
    // Dynamic altitude based on crowd size
    const crowdScale = Math.min(2.5, Math.sqrt(armyCount) * 0.3);

    let targetY = 13.5 + crowdScale * 1.5;
    let targetZ = playerZ - (14.0 + crowdScale * 2.0);
    let targetX = playerX * 0.45;

    let lookY = 2.0;
    let lookZ = playerZ + 12.0;
    let lookX = playerX * 0.6;

    if (this.isBossMode) {
      // Cinematic Boss Arena Angle — pushed in closer than the march view.
      targetY = 15.0;
      targetZ = playerZ - 16.0;
      lookZ = playerZ + 15.0;
      lookY = 3.5;
    }

    // Gate-pass FOV kick: player crossed a gate plane since last frame.
    // A big backward jump means a restart — resync without triggering.
    if (playerZ < this.prevPlayerZ - 5) {
      this.prevPlayerZ = playerZ;
    } else {
      for (let i = 0; i < this.gateZ.length; i++) {
        const gz = this.gateZ[i];
        if (this.prevPlayerZ < gz && playerZ >= gz) {
          this.fovKick = 8;
          break;
        }
      }
      this.prevPlayerZ = playerZ;
    }
    // Kick decays fast so the punch is felt, not lingered on.
    this.fovKick *= Math.exp(-dt * 4.5);
    if (this.fovKick < 0.05) this.fovKick = 0;

    // FOV target: base + gate kick, narrowed during the boss push-in.
    const bossNarrow = this.isBossMode ? 6 : 0;
    const targetFov = this.baseFov + this.fovKick - bossNarrow;
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, Math.min(1, 8 * dt));
    if (Math.abs(this.currentFov - this.camera.fov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Smooth camera lag
    const lerpFactor = Math.min(1.0, 7.5 * dt);
    this.currentPos.x = THREE.MathUtils.lerp(this.currentPos.x, targetX, lerpFactor);
    this.currentPos.y = THREE.MathUtils.lerp(this.currentPos.y, targetY, lerpFactor);
    this.currentPos.z = THREE.MathUtils.lerp(this.currentPos.z, targetZ, lerpFactor);

    this.currentLookAt.x = THREE.MathUtils.lerp(this.currentLookAt.x, lookX, lerpFactor);
    this.currentLookAt.y = THREE.MathUtils.lerp(this.currentLookAt.y, lookY, lerpFactor);
    this.currentLookAt.z = THREE.MathUtils.lerp(this.currentLookAt.z, lookZ, lerpFactor);

    // Subtle handheld sway while running — two slow sines, tiny amplitude
    // so it reads as a living camera, not motion sickness.
    this.swayTime += dt;
    const swayAmp = this.isBossMode ? 0.06 : 0.12;
    const swayX = Math.sin(this.swayTime * 0.9) * swayAmp;
    const swayY = Math.sin(this.swayTime * 1.3 + 1.7) * swayAmp * 0.7;

    // Apply Screen Shake
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = this.shakeTimer / this.shakeDuration;
      const currentAmp = this.shakeIntensity * progress;
      shakeOffsetX = (Math.random() - 0.5) * currentAmp * 2.0;
      shakeOffsetY = (Math.random() - 0.5) * currentAmp * 2.0;
    }

    this.camera.position.set(
      this.currentPos.x + shakeOffsetX + swayX,
      this.currentPos.y + shakeOffsetY + swayY,
      this.currentPos.z
    );
    this.camera.lookAt(
      this.currentLookAt.x + swayX * 0.5,
      this.currentLookAt.y + swayY * 0.5,
      this.currentLookAt.z
    );
  }

  public onResize(width: number, height: number) {
    this.camera.aspect = width / height;
    // Adapt FOV: slightly wider for portrait mobile
    if (width < height) {
      this.baseFov = 68; // Wider FOV for vertical portrait
    } else {
      this.baseFov = 55; // Standard landscape FOV
    }
    this.camera.updateProjectionMatrix();
  }
}
