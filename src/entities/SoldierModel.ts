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
  private static chestSashGeo: THREE.BoxGeometry;
  private static shoulderPadGeo: THREE.SphereGeometry;
  private static waistClothGeo: THREE.BoxGeometry;
  private static headGeo: THREE.SphereGeometry;
  private static turbanBaseGeo: THREE.TorusGeometry;
  private static turbanTopGeo: THREE.ConeGeometry;
  private static turbanJewelGeo: THREE.SphereGeometry;
  private static turbanTailGeo: THREE.BoxGeometry;
  private static plumeGeo: THREE.BoxGeometry;
  private static limbGeo: THREE.CylinderGeometry;
  private static bootGeo: THREE.BoxGeometry;
  private static shieldPlateGeo: THREE.CylinderGeometry;
  private static shieldRimGeo: THREE.TorusGeometry;
  private static shieldBossGeo: THREE.SphereGeometry;
  private static bowCurveGeo: THREE.TorusGeometry;
  private static spearShaftGeo: THREE.CylinderGeometry;
  private static spearTipGeo: THREE.ConeGeometry;
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
    this.chestSashGeo = new THREE.BoxGeometry(0.1, 0.66, 0.03);
    this.shoulderPadGeo = new THREE.SphereGeometry(0.13, 6, 6);
    this.waistClothGeo = new THREE.BoxGeometry(0.3, 0.26, 0.03);
    this.headGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.turbanBaseGeo = new THREE.TorusGeometry(0.20, 0.08, 6, 12);
    this.turbanTopGeo = new THREE.ConeGeometry(0.16, 0.22, 8);
    this.turbanJewelGeo = new THREE.SphereGeometry(0.05, 6, 6);
    this.turbanTailGeo = new THREE.BoxGeometry(0.09, 0.32, 0.02);
    this.plumeGeo = new THREE.BoxGeometry(0.04, 0.16, 0.04);
    this.limbGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6);
    this.bootGeo = new THREE.BoxGeometry(0.12, 0.14, 0.22);
    this.shieldPlateGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12);
    this.shieldRimGeo = new THREE.TorusGeometry(0.28, 0.03, 6, 16);
    this.shieldBossGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.bowCurveGeo = new THREE.TorusGeometry(0.35, 0.03, 5, 12, Math.PI);
    this.spearShaftGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6);
    this.spearTipGeo = new THREE.ConeGeometry(0.07, 0.28, 6);
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

    // Diagonal chest sash in faction turban colour (angrakha cross-strap)
    const chestSash = new THREE.Mesh(this.chestSashGeo, turbanMat);
    chestSash.position.set(0, 0.06, 0.27);
    chestSash.rotation.z = 0.65;
    torsoGroup.add(chestSash);

    // Waist cloth flap hanging over the front of the tunic
    const waistCloth = new THREE.Mesh(this.waistClothGeo, this.leatherMat);
    waistCloth.position.set(0, -0.4, 0.29);
    waistCloth.rotation.x = 0.15;
    torsoGroup.add(waistCloth);

    // Shoulder pads (squashed spheres on both shoulders)
    const leftPad = new THREE.Mesh(this.shoulderPadGeo, robeMat);
    leftPad.position.set(-0.3, 0.3, 0);
    leftPad.scale.set(1, 0.6, 1);
    torsoGroup.add(leftPad);

    const rightPad = new THREE.Mesh(this.shoulderPadGeo, robeMat);
    rightPad.position.set(0.3, 0.3, 0);
    rightPad.scale.set(1, 0.6, 1);
    torsoGroup.add(rightPad);

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

    // Sarpech jewel at the front of the turban
    const jewel = new THREE.Mesh(this.turbanJewelGeo, this.goldMat);
    jewel.position.set(0, 0.08, 0.2);
    turban.add(jewel);

    // Turban tail: cloth strip hanging down the back
    const tail = new THREE.Mesh(this.turbanTailGeo, turbanMat);
    tail.position.set(0, -0.08, -0.22);
    tail.rotation.x = 0.12;
    turban.add(tail);

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

    // Gold rim ring around the shield face
    const shieldRim = new THREE.Mesh(this.shieldRimGeo, this.goldMat);
    shield.add(shieldRim);

    const shieldBoss = new THREE.Mesh(this.shieldBossGeo, this.goldMat);
    shieldBoss.position.z = 0.03;
    shield.add(shieldBoss);

    leftArm.add(shield);
    torsoGroup.add(leftArm);

    // Right Arm (with Dhanush Bow or Long Spear)
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
      // Long war spear: wooden shaft + iron tip, held upright
      bowOrWeapon = new THREE.Mesh(this.spearShaftGeo, this.woodMat);
      bowOrWeapon.position.set(0, -0.2, 0.12);
      bowOrWeapon.rotation.x = 0.12;
      rightArm.add(bowOrWeapon);

      const spearTip = new THREE.Mesh(this.spearTipGeo, this.ironMat);
      spearTip.position.set(0, 0.68, 0.22);
      spearTip.rotation.x = 0.12;
      rightArm.add(spearTip);
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
    // Stride and bob now scale with speed: a charging crowd runs harder
    // than a shambling one instead of just cycling faster.
    const speed = THREE.MathUtils.clamp(speedFactor, 0.4, 1.6);
    const strideAmp = 0.35 + 0.3 * speed;
    const bobAmp = 0.035 + 0.03 * speed;
    const armAmp = 0.3 + 0.2 * speed;

    if (isMoving) {
      // Natural running gait
      const stride = Math.sin(t) * strideAmp;
      soldier.leftLeg.rotation.x = stride;
      soldier.rightLeg.rotation.x = -stride;

      // Vertical bounce, scaled with speed
      soldier.torsoGroup.position.y = 0.85 + Math.abs(Math.sin(t)) * bobAmp;

      // Upper body sway + forward lean into the run
      soldier.torsoGroup.rotation.y = Math.sin(t * 0.5) * 0.08;
      soldier.torsoGroup.rotation.z = Math.cos(t * 0.5) * 0.03;
      soldier.torsoGroup.rotation.x = 0.06 * speed;

      // Head bob counter to the stride, turban plume sways with the run
      soldier.head.position.y = 0.5 + Math.sin(t * 2) * 0.015;
      soldier.turban.rotation.z = Math.sin(t * 0.5) * 0.07;
      soldier.turban.rotation.x = Math.sin(t) * 0.04;
    } else {
      // Idle breathing
      soldier.leftLeg.rotation.x = 0;
      soldier.rightLeg.rotation.x = 0;
      soldier.torsoGroup.position.y = 0.85 + Math.sin(time * 3 + soldier.animTimeOffset) * 0.02;
      soldier.torsoGroup.rotation.x = 0;
      soldier.torsoGroup.rotation.y = 0;
      soldier.torsoGroup.rotation.z = 0;
      soldier.head.position.y = 0.5;
      soldier.turban.rotation.z = Math.sin(time * 1.5 + soldier.animTimeOffset) * 0.02;
      soldier.turban.rotation.x = 0;
    }

    if (isShooting) {
      // Bow draw & aim pose
      soldier.leftArm.rotation.x = -1.25;
      soldier.leftArm.rotation.y = 0.35;
      soldier.rightArm.rotation.x = -1.35;
      soldier.rightArm.rotation.y = -0.45;
    } else if (isMoving) {
      // Arm swing with stride, scaled with speed
      const armSwing = Math.sin(t) * armAmp;
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
