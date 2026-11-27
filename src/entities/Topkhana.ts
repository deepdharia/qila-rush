import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import { SoldierModelFactory, type SoldierVisual } from './SoldierModel';

// Phase 2 (master plan): the Topkhana — one chunky brass cannon, fixed at
// the fort gate at the bottom of the lane (D4). It is both the stream
// producer (a continuous flow of warriors up the causeway) and the
// bombardment-ability source (cannonballs leave from its muzzle).
//
// Placement is camera-space fixed, NOT world-fixed: every frame the cannon
// sits at warbandZ - TOPKHANA_TRAIL_Z (x lerped toward the aim point). A
// literally-fixed z=0 cannon leaves the camera frame ~3s into a run
// (camera sits at playerZ - 14 looking at playerZ + 12), so the trail
// position is the faithful reading of "fixed at the fort gate, bottom of
// the lane". Frustum check (portrait FOV 68): the bottom edge of the frame
// meets the ground at warbandZ - 6.7 (army 8) to warbandZ - 9.1 (army 120),
// so at trail 8 the cannon straddles the bottom edge — cropped at small
// armies, fully in frame at big ones. The phone playtest confirms it
// visually; in boss mode the camera pulls back and the cannon sits below
// the frame (stream soldiers become visible ~warbandZ - 5).
export class Topkhana {
  public group: THREE.Group;
  /** Current cannon x (lerped toward the aim point each frame). */
  public x: number = 0;
  /** Current cannon z (warbandZ - TOPKHANA_TRAIL_Z, set by update). */
  public z: number = -CONSTANTS.TOPKHANA_TRAIL_Z;

  private scene: THREE.Scene;
  private barrelGroup: THREE.Group;
  private muzzleAnchor: THREE.Object3D;
  private flashMesh: THREE.Mesh;
  private recoilTimer: number = 0;
  private flashTimer: number = 0;
  private readonly RECOIL_TIME = 0.28;
  private readonly FLASH_TIME = 0.12;

  // Stream-soldier visual pool: preallocated SoldierVisuals, handed out by
  // acquireStreamVisual() and returned by releaseStreamVisual(). Logical
  // stream soldiers beyond the pool still exist (and still process gates)
  // — they just have no visual. No allocation after construction.
  private visualPool: SoldierVisual[] = [];
  private freeVisuals: SoldierVisual[] = [];

  // Scratch for the muzzle world position. getMuzzleWorldPos() returns
  // THIS vector — callers that need it past the current call must copy it.
  private _muzzlePos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    const brass = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.GOLD });
    const bronze = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.BRONZE });
    const iron = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x78350f });

    // Carriage platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.8), wood);
    platform.position.set(0, 0.15, 0);
    platform.castShadow = true;
    this.group.add(platform);

    // Iron-rimmed wooden wheels (left / right)
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 12);
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, wood);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.05, 0.55, -0.2);
      wheel.castShadow = true;
      this.group.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 8), iron);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(side * 1.05, 0.55, -0.2);
      this.group.add(hub);
    }

    // Barrel group (recoils as one piece). Origin at the trunnion, barrel
    // pointing +z (up the lane) with a slight upward tilt.
    this.barrelGroup = new THREE.Group();
    this.barrelGroup.position.set(0, 1.05, 0);
    this.barrelGroup.rotation.x = -0.06;
    this.group.add(this.barrelGroup);

    const barrelGeo = new THREE.CylinderGeometry(0.26, 0.34, 2.2, 12);
    const barrel = new THREE.Mesh(barrelGeo, brass);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 0.15);
    barrel.castShadow = true;
    this.barrelGroup.add(barrel);

    // Muzzle ring + breech knob
    const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.06, 8, 16), bronze);
    muzzleRing.position.set(0, 0, 1.25);
    this.barrelGroup.add(muzzleRing);
    const breech = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bronze);
    breech.position.set(0, 0, -1.0);
    this.barrelGroup.add(breech);

    // Muzzle anchor: where stream soldiers and cannonballs are born.
    this.muzzleAnchor = new THREE.Object3D();
    this.muzzleAnchor.position.set(0, 0, 1.45);
    this.barrelGroup.add(this.muzzleAnchor);

    // Muzzle flash: a flat additive star at the muzzle, visible only for
    // FLASH_TIME after recoil() (bombardment fire). The stream itself does
    // not flash — a flash 6x/second would be noise.
    const flashGeo = new THREE.ConeGeometry(0.55, 1.1, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.flashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.flashMesh.rotation.x = Math.PI / 2;
    this.flashMesh.position.set(0, 0, 1.9);
    this.flashMesh.visible = false;
    this.barrelGroup.add(this.flashMesh);

    this.group.position.set(0, 0, this.z);
    this.scene.add(this.group);

    // Preallocate the stream visual pool (max 30 live visuals).
    for (let i = 0; i < CONSTANTS.STREAM_MAX_VISUALS; i++) {
      const visual = SoldierModelFactory.createSoldier('player');
      visual.root.visible = false;
      this.scene.add(visual.root);
      this.visualPool.push(visual);
      this.freeVisuals.push(visual);
    }
  }

  /**
   * Per-frame: trail the warband (x lerped toward the aim point), decay
   * recoil + muzzle flash. Called every playing frame, stream mode or not
   * — the cannon is also the bombardment ability's body, so its muzzle
   * must stay true even with the stream rolled back.
   */
  public update(dt: number, aimX: number, warbandZ: number): void {
    this.x += (aimX - this.x) * Math.min(1, 10 * dt);
    this.z = warbandZ - CONSTANTS.TOPKHANA_TRAIL_Z;
    this.group.position.set(this.x, 0, this.z);
    // A hint of yaw toward the aim point, so the barrel reads as aiming.
    const yaw = THREE.MathUtils.clamp((aimX - this.x) * 0.06, -0.12, 0.12);
    this.barrelGroup.rotation.y = yaw;

    if (this.recoilTimer > 0) {
      this.recoilTimer = Math.max(0, this.recoilTimer - dt);
      const t = this.recoilTimer / this.RECOIL_TIME;
      this.barrelGroup.position.z = -0.55 * t;
    } else {
      this.barrelGroup.position.z = 0;
    }

    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      const t = this.flashTimer / this.FLASH_TIME;
      const mat = this.flashMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.9 * t;
      const s = 1 + (1 - t) * 0.6;
      this.flashMesh.scale.set(s, s, s);
      this.flashMesh.visible = true;
    } else {
      this.flashMesh.visible = false;
    }
  }

  /** Bombardment fire: barrel kicks back + muzzle flash. */
  public recoil(): void {
    this.recoilTimer = this.RECOIL_TIME;
    this.flashTimer = this.FLASH_TIME;
  }

  /**
   * World position of the muzzle. Returns a REUSED scratch vector — copy
   * it if it must survive past the current call.
   */
  public getMuzzleWorldPos(): THREE.Vector3 {
    return this.muzzleAnchor.getWorldPosition(this._muzzlePos);
  }

  /** Take one stream visual from the pool, or null when all 30 are live. */
  public acquireStreamVisual(): SoldierVisual | null {
    const visual = this.freeVisuals.pop();
    if (!visual) return null;
    visual.root.visible = true;
    return visual;
  }

  /** Return a stream visual to the pool (hides it). */
  public releaseStreamVisual(visual: SoldierVisual): void {
    visual.root.visible = false;
    this.freeVisuals.push(visual);
  }

  /** Run reset: every stream visual back in the pool, cannon re-parked. */
  public reset(): void {
    for (const visual of this.visualPool) visual.root.visible = false;
    this.freeVisuals.length = 0;
    for (const visual of this.visualPool) this.freeVisuals.push(visual);
    this.recoilTimer = 0;
    this.flashTimer = 0;
    this.barrelGroup.position.z = 0;
    this.flashMesh.visible = false;
    this.x = 0;
    this.z = -CONSTANTS.TOPKHANA_TRAIL_Z;
    this.group.position.set(0, 0, this.z);
  }
}
