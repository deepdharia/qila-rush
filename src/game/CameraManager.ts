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

  constructor(fov: number, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 400);
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
      // Cinematic Boss Arena Angle
      targetY = 16.0;
      targetZ = playerZ - 18.0;
      lookZ = playerZ + 15.0;
      lookY = 3.5;
    }

    // Smooth camera lag
    const lerpFactor = Math.min(1.0, 7.5 * dt);
    this.currentPos.x = THREE.MathUtils.lerp(this.currentPos.x, targetX, lerpFactor);
    this.currentPos.y = THREE.MathUtils.lerp(this.currentPos.y, targetY, lerpFactor);
    this.currentPos.z = THREE.MathUtils.lerp(this.currentPos.z, targetZ, lerpFactor);

    this.currentLookAt.x = THREE.MathUtils.lerp(this.currentLookAt.x, lookX, lerpFactor);
    this.currentLookAt.y = THREE.MathUtils.lerp(this.currentLookAt.y, lookY, lerpFactor);
    this.currentLookAt.z = THREE.MathUtils.lerp(this.currentLookAt.z, lookZ, lerpFactor);

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
      this.currentPos.x + shakeOffsetX,
      this.currentPos.y + shakeOffsetY,
      this.currentPos.z
    );
    this.camera.lookAt(
      this.currentLookAt.x,
      this.currentLookAt.y,
      this.currentLookAt.z
    );
  }

  public onResize(width: number, height: number) {
    this.camera.aspect = width / height;
    // Adapt FOV: slightly wider for portrait mobile
    if (width < height) {
      this.camera.fov = 68; // Wider FOV for vertical portrait
    } else {
      this.camera.fov = 55; // Standard landscape FOV
    }
    this.camera.updateProjectionMatrix();
  }
}
