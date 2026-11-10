import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';

export type SoldierFaction = 'player' | 'enemy' | 'boss';

export interface SoldierVisual {
  root: THREE.Group;
  torsoGroup: THREE.Group;
  head: THREE.Mesh;
  turban: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  bowOrWeapon: THREE.Mesh;
  shield: THREE.Group;
  quiver: THREE.Mesh;
  animTimeOffset: number;
}

export class SoldierModelFactory {
  // Shared Geometries
  private static torsoGeo: THREE.CylinderGeometry;
  private static sashGeo: THREE.TorusGeometry;
  private static headGeo: THREE.SphereGeometry;
  private static turbanBaseGeo: THREE.TorusGeometry;
  private static turbanTopGeo: THREE.ConeGeometry;
  private static plumeGeo: THREE.BoxGeometry;
  private static limbGeo: THREE.CylinderGeometry;
  private static bootGeo: THREE.BoxGeometry;
  private static shieldPlateGeo: THREE.CylinderGeometry;
  private static shieldBossGeo: THREE.SphereGeometry;
  private static bowCurveGeo: THREE.TorusGeometry;
  private static swordBladeGeo: THREE.BoxGeometry;
  private static quiverGeo: THREE.CylinderGeometry;

  // Shared Materials
  private static playerRobeMat: THREE.MeshLambertMaterial;
  private static enemyRobeMat: THREE.MeshLambertMaterial;
  private static playerTurbanMat: THREE.MeshLambertMaterial;
  private static enemyTurbanMat: THREE.MeshLambertMaterial;
  private static skinMat: THREE.MeshLambertMaterial;
  private static goldMat: THREE.MeshLambertMaterial;
  private static ironMat: THREE.MeshLambertMaterial;
  private static woodMat: THREE.MeshLambertMaterial;
  private static leatherMat: THREE.MeshLambertMaterial;

  private static initialized = false;

  private static initSharedResources() {
    if (this.initialized) return;

    // Geometries
    this.torsoGeo = new THREE.CylinderGeometry(0.24, 0.32, 0.7, 8);
    this.sashGeo = new THREE.TorusGeometry(0.29, 0.05, 6, 12);
    this.headGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.turbanBaseGeo = new THREE.TorusGeometry(0.20, 0.08, 6, 12);
    this.turbanTopGeo = new THREE.ConeGeometry(0.16, 0.22, 8);
    this.plumeGeo = new THREE.BoxGeometry(0.04, 0.16, 0.04);
    this.limbGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6);
    this.bootGeo = new THREE.BoxGeometry(0.12, 0.14, 0.22);
    this.shieldPlateGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12);
    this.shieldBossGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.bowCurveGeo = new THREE.TorusGeometry(0.35, 0.03, 5, 12, Math.PI);
    this.swordBladeGeo = new THREE.BoxGeometry(0.06, 0.75, 0.02);
    this.quiverGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.5, 6);

    // Materials
    this.playerRobeMat = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.BLUE_ROBE });
    this.enemyRobeMat = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.RED_ROBE });
    this.playerTurbanMat = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.TURBAN_BLUE });
    this.enemyTurbanMat = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.TURBAN_RED });
    this.skinMat = new THREE.MeshLambertMaterial({ color: 0xc68642 });
    this.goldMat = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLORS.GOLD });
    this.ironMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    this.woodMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    this.leatherMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });

    this.initialized = true;
  }

  public static createSoldier(faction: SoldierFaction): SoldierVisual {
    this.initSharedResources();

    const root = new THREE.Group();
    const isPlayer = faction === 'player';

    // Torso Group
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.85;

    const robeMat = isPlayer ? this.playerRobeMat : this.enemyRobeMat;
    const turbanMat = isPlayer ? this.playerTurbanMat : this.enemyTurbanMat;

    // Tunic / Angrakha Torso
    const torso = new THREE.Mesh(this.torsoGeo, robeMat);
    torso.castShadow = true;
    torso.receiveShadow = true;
    torsoGroup.add(torso);

    // Golden Kamarband (Sash)
    const sash = new THREE.Mesh(this.sashGeo, this.goldMat);
    sash.rotation.x = Math.PI / 2;
    sash.position.y = -0.15;
    torsoGroup.add(sash);

    // Head
    const head = new THREE.Mesh(this.headGeo, this.skinMat);
    head.position.y = 0.5;
    head.castShadow = true;
    torsoGroup.add(head);

    // Turban (Pagri with Crest)
    const turban = new THREE.Group();
    turban.position.y = 0.54;

    const turbanRoll = new THREE.Mesh(this.turbanBaseGeo, turbanMat);
    turbanRoll.rotation.x = Math.PI / 2;
    turban.add(turbanRoll);

    const turbanCone = new THREE.Mesh(this.turbanTopGeo, turbanMat);
    turbanCone.position.y = 0.12;
    turban.add(turbanCone);

    // Sarpech / Kalgi (Crest plume)
    const plume = new THREE.Mesh(this.plumeGeo, this.goldMat);
    plume.position.set(0, 0.15, 0.18);
    plume.rotation.x = 0.2;
    turban.add(plume);

    torsoGroup.add(turban);

    // Quiver on Back
    const quiver = new THREE.Mesh(this.quiverGeo, this.leatherMat);
    quiver.position.set(0.12, 0.1, -0.22);
    quiver.rotation.z = -0.4;
    quiver.rotation.x = 0.2;
    torsoGroup.add(quiver);

    // Left Arm (with Dhal Shield)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.32, 0.24, 0);

    const leftArmMesh = new THREE.Mesh(this.limbGeo, robeMat);
    leftArmMesh.position.y = -0.2;
    leftArm.add(leftArmMesh);

    // Dhal Shield
    const shield = new THREE.Group();
    shield.position.set(-0.1, -0.22, 0.08);
    shield.rotation.y = Math.PI / 2;

    const shieldPlate = new THREE.Mesh(this.shieldPlateGeo, isPlayer ? this.ironMat : this.leatherMat);
    shieldPlate.rotation.x = Math.PI / 2;
    shieldPlate.castShadow = true;
    shield.add(shieldPlate);

    const shieldBoss = new THREE.Mesh(this.shieldBossGeo, this.goldMat);
    shieldBoss.position.z = 0.03;
    shield.add(shieldBoss);

    leftArm.add(shield);
    torsoGroup.add(leftArm);

    // Right Arm (with Dhanush Bow or Curved Tulwar)
    const rightArm = new THREE.Group();
    rightArm.position.set(0.32, 0.24, 0);

    const rightArmMesh = new THREE.Mesh(this.limbGeo, robeMat);
    rightArmMesh.position.y = -0.2;
    rightArm.add(rightArmMesh);

    let bowOrWeapon: THREE.Mesh;
    if (isPlayer) {
      // Indian Bow (Dhanush)
      bowOrWeapon = new THREE.Mesh(this.bowCurveGeo, this.woodMat);
      bowOrWeapon.position.set(0, -0.32, 0.12);
      bowOrWeapon.rotation.y = Math.PI / 2;
      bowOrWeapon.rotation.z = 0.1;
      rightArm.add(bowOrWeapon);
    } else {
      // Curved Scimitar / Tulwar
      bowOrWeapon = new THREE.Mesh(this.swordBladeGeo, this.ironMat);
      bowOrWeapon.position.set(0, -0.3, 0.15);
      bowOrWeapon.rotation.x = 0.5;
      rightArm.add(bowOrWeapon);
    }

    torsoGroup.add(rightArm);
    root.add(torsoGroup);

    // Left Leg
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.15, 0.5, 0);

    const leftLegMesh = new THREE.Mesh(this.limbGeo, this.leatherMat);
    leftLegMesh.position.y = -0.22;
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);

    const leftBoot = new THREE.Mesh(this.bootGeo, this.ironMat);
    leftBoot.position.set(0, -0.42, 0.05);
    leftLeg.add(leftBoot);

    root.add(leftLeg);

    // Right Leg
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.15, 0.5, 0);

    const rightLegMesh = new THREE.Mesh(this.limbGeo, this.leatherMat);
    rightLegMesh.position.y = -0.22;
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);

    const rightBoot = new THREE.Mesh(this.bootGeo, this.ironMat);
    rightBoot.position.set(0, -0.42, 0.05);
    rightLeg.add(rightBoot);

    root.add(rightLeg);

    return {
      root,
      torsoGroup,
      head,
      turban,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      bowOrWeapon,
      shield,
      quiver,
      animTimeOffset: Math.random() * Math.PI * 2
    };
  }

  public static animateSoldier(
    soldier: SoldierVisual,
    time: number,
    isMoving: boolean,
    isShooting: boolean,
    speedFactor: number = 1.0
  ) {
    const t = time * 12 * speedFactor + soldier.animTimeOffset;

    if (isMoving) {
      // Natural running gait
      const stride = Math.sin(t) * 0.65;
      soldier.leftLeg.rotation.x = stride;
      soldier.rightLeg.rotation.x = -stride;

      // Vertical bounce
      soldier.torsoGroup.position.y = 0.85 + Math.abs(Math.sin(t)) * 0.06;

      // Upper body sway
      soldier.torsoGroup.rotation.y = Math.sin(t * 0.5) * 0.08;
      soldier.torsoGroup.rotation.z = Math.cos(t * 0.5) * 0.03;
    } else {
      // Idle breathing
      soldier.leftLeg.rotation.x = 0;
      soldier.rightLeg.rotation.x = 0;
      soldier.torsoGroup.position.y = 0.85 + Math.sin(time * 3 + soldier.animTimeOffset) * 0.02;
    }

    if (isShooting) {
      // Bow draw & aim pose
      soldier.leftArm.rotation.x = -1.25;
      soldier.leftArm.rotation.y = 0.35;
      soldier.rightArm.rotation.x = -1.35;
      soldier.rightArm.rotation.y = -0.45;
    } else if (isMoving) {
      // Arm swing with stride
      const armSwing = Math.sin(t) * 0.45;
      soldier.leftArm.rotation.x = -armSwing;
      soldier.rightArm.rotation.x = armSwing;
      soldier.leftArm.rotation.y = 0;
      soldier.rightArm.rotation.y = 0;
    } else {
      soldier.leftArm.rotation.x = 0;
      soldier.rightArm.rotation.x = 0;
      soldier.leftArm.rotation.y = 0;
      soldier.rightArm.rotation.y = 0;
    }
  }
}
