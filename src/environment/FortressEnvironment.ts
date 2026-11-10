import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';

export class FortressEnvironment {
  private scene: THREE.Scene;
  private banners: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildLighting();
    this.buildSkyAndFog();
    this.buildCausewayRoad();
    this.buildFortressWalls();
    this.buildToranaGateways();
    this.buildChhatris();
    this.buildBanners();
    this.buildDistantFortressHills();
  }

  private buildLighting() {
    // Warm ambient desert light
    const ambient = new THREE.AmbientLight(0xffedd5, 1.2);
    this.scene.add(ambient);

    // Warm golden directional sun
    const sun = new THREE.DirectionalLight(0xfef08a, 2.2);
    sun.position.set(25, 45, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    const shadowD = 28;
    sun.shadow.camera.left = -shadowD;
    sun.shadow.camera.right = shadowD;
    sun.shadow.camera.top = shadowD;
    sun.shadow.camera.bottom = -shadowD;
    this.scene.add(sun);

    // Secondary rim fill from canyon
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-30, 15, 30);
    this.scene.add(rimLight);
  }

  private buildSkyAndFog() {
    this.scene.background = new THREE.Color(CONSTANTS.COLORS.FOG);
    this.scene.fog = new THREE.FogExp2(CONSTANTS.COLORS.FOG, 0.0075);
  }

  private buildCausewayRoad() {
    // Sandstone paved road canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#c89565';
      ctx.fillRect(0, 0, 512, 512);

      // Paved flagstones grid
      ctx.strokeStyle = '#936338';
      ctx.lineWidth = 4;
      for (let y = 0; y < 512; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        const offset = (y / 64) % 2 === 0 ? 0 : 32;
        for (let x = offset; x < 512; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 64);
          ctx.stroke();
        }
      }

      // Stone grain noise
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let i = 0; i < 4000; i++) {
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
      }
    }

    const roadTexture = new THREE.CanvasTexture(canvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(2, 24);

    const roadGeo = new THREE.PlaneGeometry(CONSTANTS.ROAD_WIDTH, CONSTANTS.LEVEL_LENGTH + 60);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.85,
      metalness: 0.1
    });

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, (CONSTANTS.LEVEL_LENGTH + 20) / 2 - 20);
    road.receiveShadow = true;
    this.scene.add(road);

    // Stone Balustrades along bridge edges
    const parapetHeight = 1.2;
    const parapetGeo = new THREE.BoxGeometry(0.8, parapetHeight, CONSTANTS.LEVEL_LENGTH + 60);
    const parapetMat = new THREE.MeshStandardMaterial({
      color: CONSTANTS.COLORS.SANDSTONE_DARK,
      roughness: 0.9
    });

    // Left Parapet
    const leftParapet = new THREE.Mesh(parapetGeo, parapetMat);
    leftParapet.position.set(-CONSTANTS.ROAD_HALF_WIDTH - 0.4, parapetHeight / 2, road.position.z);
    leftParapet.castShadow = true;
    leftParapet.receiveShadow = true;
    this.scene.add(leftParapet);

    // Right Parapet
    const rightParapet = new THREE.Mesh(parapetGeo, parapetMat);
    rightParapet.position.set(CONSTANTS.ROAD_HALF_WIDTH + 0.4, parapetHeight / 2, road.position.z);
    rightParapet.castShadow = true;
    rightParapet.receiveShadow = true;
    this.scene.add(rightParapet);
  }

  private buildFortressWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: CONSTANTS.COLORS.SANDSTONE,
      roughness: 0.95
    });

    // Massive Bastions (Circular Sandstone Towers) every 60 units along the route
    const bastionGeo = new THREE.CylinderGeometry(3.5, 4.2, 16, 16);

    for (let z = 0; z <= CONSTANTS.LEVEL_LENGTH; z += 55) {
      // Left Bastion
      const leftBastion = new THREE.Mesh(bastionGeo, wallMat);
      leftBastion.position.set(-CONSTANTS.ROAD_HALF_WIDTH - 4.2, 6.0, z);
      leftBastion.castShadow = true;
      leftBastion.receiveShadow = true;
      this.scene.add(leftBastion);

      // Right Bastion
      const rightBastion = new THREE.Mesh(bastionGeo, wallMat);
      rightBastion.position.set(CONSTANTS.ROAD_HALF_WIDTH + 4.2, 6.0, z);
      rightBastion.castShadow = true;
      rightBastion.receiveShadow = true;
      this.scene.add(rightBastion);
    }
  }

  private buildToranaGateways() {
    // Grand Fort Gates (Darwaza) spanning over the causeway
    const gateZPositions = [0, 140, CONSTANTS.BOSS_ARENA_Z - 10];
    const sandstoneMat = new THREE.MeshStandardMaterial({
      color: CONSTANTS.COLORS.SANDSTONE_DARK,
      roughness: 0.8
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: CONSTANTS.COLORS.GOLD,
      roughness: 0.3,
      metalness: 0.8
    });

    gateZPositions.forEach((z) => {
      const gateGroup = new THREE.Group();
      gateGroup.position.set(0, 0, z);

      // Left Gate Tower
      const leftTower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 12, 4), sandstoneMat);
      leftTower.position.set(-CONSTANTS.ROAD_HALF_WIDTH - 1.5, 6, 0);
      leftTower.castShadow = true;
      gateGroup.add(leftTower);

      // Right Gate Tower
      const rightTower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 12, 4), sandstoneMat);
      rightTower.position.set(CONSTANTS.ROAD_HALF_WIDTH + 1.5, 6, 0);
      rightTower.castShadow = true;
      gateGroup.add(rightTower);

      // Grand Arch Overhead
      const archSpan = new THREE.Mesh(
        new THREE.BoxGeometry(CONSTANTS.ROAD_WIDTH + 5.0, 3.5, 4.2),
        sandstoneMat
      );
      archSpan.position.set(0, 11, 0);
      archSpan.castShadow = true;
      gateGroup.add(archSpan);

      // Chhatri Domes on Tower tops
      const domeGeo = new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const leftDome = new THREE.Mesh(domeGeo, sandstoneMat);
      leftDome.position.set(-CONSTANTS.ROAD_HALF_WIDTH - 1.5, 12, 0);
      gateGroup.add(leftDome);

      const rightDome = new THREE.Mesh(domeGeo, sandstoneMat);
      rightDome.position.set(CONSTANTS.ROAD_HALF_WIDTH + 1.5, 12, 0);
      gateGroup.add(rightDome);

      // Kalasa Finials
      const finialGeo = new THREE.ConeGeometry(0.4, 1.2, 8);
      const leftFinial = new THREE.Mesh(finialGeo, goldMat);
      leftFinial.position.set(-CONSTANTS.ROAD_HALF_WIDTH - 1.5, 14.2, 0);
      gateGroup.add(leftFinial);

      const rightFinial = new THREE.Mesh(finialGeo, goldMat);
      rightFinial.position.set(CONSTANTS.ROAD_HALF_WIDTH + 1.5, 14.2, 0);
      gateGroup.add(rightFinial);

      this.scene.add(gateGroup);
    });
  }

  private buildChhatris() {
    // Elegant Rajasthani domed pavilions atop key bastions
    const chhatriMat = new THREE.MeshStandardMaterial({
      color: CONSTANTS.COLORS.SANDSTONE_LIGHT,
      roughness: 0.75
    });

    const positions = [
      new THREE.Vector3(-CONSTANTS.ROAD_HALF_WIDTH - 4.2, 14, 55),
      new THREE.Vector3(CONSTANTS.ROAD_HALF_WIDTH + 4.2, 14, 55),
      new THREE.Vector3(-CONSTANTS.ROAD_HALF_WIDTH - 4.2, 14, 165),
      new THREE.Vector3(CONSTANTS.ROAD_HALF_WIDTH + 4.2, 14, 165),
      new THREE.Vector3(-CONSTANTS.ROAD_HALF_WIDTH - 4.2, 14, 275),
      new THREE.Vector3(CONSTANTS.ROAD_HALF_WIDTH + 4.2, 14, 275)
    ];

    positions.forEach(pos => {
      const chhatri = new THREE.Group();
      chhatri.position.copy(pos);

      // 4 Slender Carved Pillars
      const pGeo = new THREE.CylinderGeometry(0.14, 0.16, 2.8, 6);
      const offsets = [
        [-1.2, -1.2],
        [1.2, -1.2],
        [-1.2, 1.2],
        [1.2, 1.2]
      ];
      offsets.forEach(([ox, oz]) => {
        const pillar = new THREE.Mesh(pGeo, chhatriMat);
        pillar.position.set(ox, 1.4, oz);
        chhatri.add(pillar);
      });

      // Fluted Dome
      const domeGeo = new THREE.SphereGeometry(1.6, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, chhatriMat);
      dome.position.y = 2.8;
      chhatri.add(dome);

      this.scene.add(chhatri);
    });
  }

  private buildBanners() {
    // Saffron Kesariya & Royal Blue pennants fluttering along the battlements
    const flagGeo = new THREE.PlaneGeometry(1.4, 2.4, 4, 8);
    const saffronMat = new THREE.MeshLambertMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide
    });
    const blueMat = new THREE.MeshLambertMaterial({
      color: 0x2563eb,
      side: THREE.DoubleSide
    });

    for (let z = 15; z <= CONSTANTS.LEVEL_LENGTH; z += 35) {
      // Left Banner (Saffron)
      const flagLeft = new THREE.Mesh(flagGeo, saffronMat);
      flagLeft.position.set(-CONSTANTS.ROAD_HALF_WIDTH - 0.5, 3.2, z);
      flagLeft.rotation.y = Math.PI / 2;
      this.banners.push(flagLeft);
      this.scene.add(flagLeft);

      // Right Banner (Blue)
      const flagRight = new THREE.Mesh(flagGeo, blueMat);
      flagRight.position.set(CONSTANTS.ROAD_HALF_WIDTH + 0.5, 3.2, z + 15);
      flagRight.rotation.y = -Math.PI / 2;
      this.banners.push(flagRight);
      this.scene.add(flagRight);
    }
  }

  private buildDistantFortressHills() {
    // Deep Ravine Floor below the causeway
    const ravineGeo = new THREE.PlaneGeometry(400, 500);
    const ravineMat = new THREE.MeshLambertMaterial({
      color: 0x6e492c
    });
    const ravine = new THREE.Mesh(ravineGeo, ravineMat);
    ravine.rotation.x = -Math.PI / 2;
    ravine.position.set(0, -22, CONSTANTS.LEVEL_LENGTH / 2);
    this.scene.add(ravine);

    // Distant Sandstone Mountain Peaks & Palaces
    const hillMat = new THREE.MeshLambertMaterial({
      color: 0xa87147
    });

    for (let i = 0; i < 16; i++) {
      const hillGeo = new THREE.ConeGeometry(25 + Math.random() * 30, 45 + Math.random() * 35, 6);
      const hill = new THREE.Mesh(hillGeo, hillMat);
      const side = i % 2 === 0 ? 1 : -1;
      hill.position.set(
        side * (45 + Math.random() * 50),
        -5,
        Math.random() * (CONSTANTS.LEVEL_LENGTH + 80)
      );
      this.scene.add(hill);
    }
  }

  public update(time: number) {
    // Animate fluttering banners in the desert breeze
    for (let i = 0; i < this.banners.length; i++) {
      const banner = this.banners[i];
      const pos = banner.geometry.attributes.position;
      const count = pos.count;
      for (let j = 0; j < count; j++) {
        const y = pos.getY(j);
        // Only wave bottom edges
        if (y < 0.5) {
          const wave = Math.sin(time * 6 + i + j) * 0.15;
          pos.setZ(j, wave);
        }
      }
      pos.needsUpdate = true;
    }
  }

  public dispose() {
    this.banners = [];
  }
}
