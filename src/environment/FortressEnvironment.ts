import * as THREE from 'three';
import { CONSTANTS } from '../utils/Constants';
import {
  getSandstoneTexture,
  getMarbleTexture,
  getSkyTexture,
  getGlowTexture,
  getCloudTexture,
  getBannerEmblemTexture
} from '../utils/CanvasTextures';

interface Torch {
  flame: THREE.Mesh;
  glow: THREE.Sprite;
  phase: number;
}

interface Cloud {
  sprite: THREE.Sprite;
  baseX: number;
  baseY: number;
  phase: number;
}

interface Bird {
  group: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  centerX: number;
  centerZ: number;
  height: number;
  radius: number;
  speed: number;
  phase: number;
}

/** Clone a shared canvas texture so each mesh can have its own repeat. */
function textured(base: THREE.CanvasTexture, rx: number, ry: number): THREE.CanvasTexture {
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.repeat.set(rx, ry);
  return tex;
}

export class FortressEnvironment {
  private scene: THREE.Scene;
  private banners: THREE.Mesh[] = [];
  private pennantStrings: THREE.Mesh[] = [];
  private hangingBanners: THREE.Mesh[] = [];
  private torches: Torch[] = [];
  private clouds: Cloud[] = [];
  private birds: Bird[] = [];
  private dustPoints: THREE.Points | null = null;
  private dustBase: Float32Array | null = null;
  private dustSeeds: Float32Array | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildLighting();
    this.buildSkyAndFog();
    this.buildCausewayRoad();
    this.buildFortressWalls();
    this.buildToranaGateways();
    this.buildChhatris();
    this.buildBanners();
    this.buildPennantStrings();
    this.buildTorches();
    this.buildDustMotes();
    this.buildBirds();
    this.buildDistantFortressHills();
  }

  private buildLighting() {
    // Golden-hour hemisphere: warm sky bounce + earthy ground bounce.
    const hemi = new THREE.HemisphereLight(0xffdf9e, 0x7a4a26, 0.9);
    this.scene.add(hemi);

    // Low golden sun ahead-right of the causeway, so gates and soldiers are
    // rim-lit and shadows stretch back toward the camera.
    const sun = new THREE.DirectionalLight(0xffb347, 2.6);
    sun.position.set(48, 55, 320);
    sun.target.position.set(0, 0, 160);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    // Ortho frustum covers the whole 320-long road from the low sun angle.
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 420;
    const shadowD = 30;
    sun.shadow.camera.left = -shadowD;
    sun.shadow.camera.right = shadowD;
    sun.shadow.camera.top = shadowD;
    sun.shadow.camera.bottom = -shadowD;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.5;
    this.scene.add(sun);
    this.scene.add(sun.target);

    // Cool secondary rim fill from behind-left, so shadowed faces stay readable.
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-30, 15, 30);
    this.scene.add(rimLight);
  }

  private buildSkyAndFog() {
    // Warm golden-hour haze; light enough to keep gates/barriers readable
    // ~60 units ahead of the camera.
    this.scene.background = new THREE.Color(0xe2a468);
    this.scene.fog = new THREE.FogExp2(0xe2a468, 0.006);

    // Gradient sky dome (canvas texture, no shader cost, one draw call).
    // Centred on the level middle so it stays inside the camera far plane
    // (400) from every point on the road.
    const skyGeo = new THREE.SphereGeometry(340, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: getSkyTexture(),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.set(0, 0, 160);
    sky.renderOrder = -1;
    this.scene.add(sky);

    // Sun disc + halo, placed along the same direction as the light so the
    // lighting and the visible sun agree.
    const sunDir = new THREE.Vector3(48, 55, 160).normalize();
    const sunPos = new THREE.Vector3(0, 0, 160).addScaledVector(sunDir, 200);

    const discGeo = new THREE.CircleGeometry(15, 24);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xffe9a8,
      fog: false,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const sunDisc = new THREE.Mesh(discGeo, discMat);
    sunDisc.position.copy(sunPos);
    this.scene.add(sunDisc);

    const glowTex = getGlowTexture();
    const haloMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffc46b,
      transparent: true,
      opacity: 0.9,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const halo = new THREE.Sprite(haloMat);
    halo.position.copy(sunPos);
    halo.scale.set(95, 95, 1);
    this.scene.add(halo);

    const wideHaloMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xff9a4d,
      transparent: true,
      opacity: 0.3,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const wideHalo = new THREE.Sprite(wideHaloMat);
    wideHalo.position.copy(sunPos);
    wideHalo.scale.set(190, 190, 1);
    this.scene.add(wideHalo);

    // Drifting clouds: cheap billboarded puffs, no geometry cost.
    const cloudTex = getCloudTexture();
    const cloudDefs = [
      { x: -70, y: 62, z: 40, s: 64, o: 0.7 },
      { x: 85, y: 74, z: 90, s: 82, o: 0.55 },
      { x: -95, y: 52, z: 150, s: 56, o: 0.65 },
      { x: 60, y: 68, z: 205, s: 72, o: 0.6 },
      { x: -55, y: 78, z: 260, s: 60, o: 0.5 },
      { x: 95, y: 58, z: 310, s: 68, o: 0.65 }
    ];
    cloudDefs.forEach((def, i) => {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: def.o,
        fog: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(def.x, def.y, def.z);
      sprite.scale.set(def.s, def.s * 0.42, 1);
      this.scene.add(sprite);
      this.clouds.push({ sprite, baseX: def.x, baseY: def.y, phase: i * 1.7 });
    });
  }

  private buildCausewayRoad() {
    const roadTexture = textured(getSandstoneTexture(), 2, 24);

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
      map: textured(getSandstoneTexture(), 1, 24),
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
      map: textured(getSandstoneTexture(), 2, 2),
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
      map: textured(getSandstoneTexture(), 1, 2),
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

    // Hanging emblem banners from the first and boss gateways.
    // Geometry is translated so the mesh origin sits at the top edge (pivot).
    const bannerGeo = new THREE.PlaneGeometry(1.3, 3.4);
    bannerGeo.translate(0, -1.7, 0);
    const saffronMat = new THREE.MeshLambertMaterial({
      map: getBannerEmblemTexture('#d97706'),
      side: THREE.DoubleSide
    });
    const blueMat = new THREE.MeshLambertMaterial({
      map: getBannerEmblemTexture('#1d4ed8'),
      side: THREE.DoubleSide
    });
    [0, CONSTANTS.BOSS_ARENA_Z - 10].forEach((z) => {
      const left = new THREE.Mesh(bannerGeo, saffronMat);
      left.position.set(-3.6, 9.2, z + 2.15);
      this.hangingBanners.push(left);
      this.scene.add(left);

      const right = new THREE.Mesh(bannerGeo, blueMat);
      right.position.set(3.6, 9.2, z + 2.15);
      this.hangingBanners.push(right);
      this.scene.add(right);
    });
  }

  private buildChhatris() {
    // Elegant Rajasthani domed pavilions atop key bastions — marble domes now.
    const chhatriMat = new THREE.MeshStandardMaterial({
      map: textured(getMarbleTexture(), 2, 1),
      roughness: 0.6
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
    // Saffron Kesariya & Royal Blue pennants fluttering along the battlements.
    // Each banner gets its own geometry clone so the vertex wave below is
    // per-banner (previously all banners shared one geometry, so every flag
    // showed the same wave phase).
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
      const flagLeft = new THREE.Mesh(flagGeo.clone(), saffronMat);
      flagLeft.position.set(-CONSTANTS.ROAD_HALF_WIDTH - 0.5, 3.2, z);
      flagLeft.rotation.y = Math.PI / 2;
      this.banners.push(flagLeft);
      this.scene.add(flagLeft);

      // Right Banner (Blue)
      const flagRight = new THREE.Mesh(flagGeo.clone(), blueMat);
      flagRight.position.set(CONSTANTS.ROAD_HALF_WIDTH + 0.5, 3.2, z + 15);
      flagRight.rotation.y = -Math.PI / 2;
      this.banners.push(flagRight);
      this.scene.add(flagRight);
    }
  }

  private buildPennantStrings() {
    // Triangular bunting strung between the torana towers at each gateway.
    // One merged BufferGeometry per string (vertex colours alternate
    // saffron / blue / crimson) = 3 draw calls for all 27 pennants.
    const pennantCols = [new THREE.Color(0xf59e0b), new THREE.Color(0x2563eb), new THREE.Color(0xdc2626)];
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const pivotY = 10.6;

    [0, 140, CONSTANTS.BOSS_ARENA_Z - 10].forEach((z) => {
      const positions: number[] = [];
      const colors: number[] = [];
      const count = 9;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = -7.4 + 14.8 * t;
        const y = 11.6 - 4 * 2.0 * t * (1 - t) - pivotY;
        const c = pennantCols[i % 3];
        positions.push(x, y, 0, x - 0.38, y - 0.95, 0, x + 0.38, y - 0.95, 0);
        for (let v = 0; v < 3; v++) colors.push(c.r, c.g, c.b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, pivotY, z);
      this.pennantStrings.push(mesh);
      this.scene.add(mesh);
    });
  }

  private buildTorches() {
    // Wall torches on the parapets: pole + emissive flame + additive glow
    // sprite. No real point lights — the flicker is faked with scale/opacity.
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.9, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.9 });
    const flameGeo = new THREE.ConeGeometry(0.22, 0.65, 6);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8c1a });
    const glowTex = getGlowTexture();

    const torchZ = [35, 95, 150, 215, 250, 285];
    torchZ.forEach((z, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (CONSTANTS.ROAD_HALF_WIDTH + 0.4);

      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 2.15, z);
      pole.castShadow = true;
      this.scene.add(pole);

      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(x, 3.35, z);
      this.scene.add(flame);

      const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff9a2a,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(x, 3.35, z);
      glow.scale.set(3.2, 3.2, 1);
      this.scene.add(glow);

      this.torches.push({ flame, glow, phase: i * 1.3 });
    });
  }

  private buildDustMotes() {
    // Golden dust drifting over the causeway: one THREE.Points draw call.
    const count = 140;
    const base = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      base[i * 3] = (Math.random() - 0.5) * 14;
      base[i * 3 + 1] = 0.3 + Math.random() * 5.2;
      base[i * 3 + 2] = Math.random() * CONSTANTS.LEVEL_LENGTH;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: getGlowTexture(),
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.dustPoints = points;
    this.dustBase = base;
    this.dustSeeds = seeds;
  }

  private buildBirds() {
    // Distant birds: dark V silhouettes circling high over the fort.
    // Each bird is a group + 2 flat wing pivots (flap via pivot rotation).
    const wingGeo = new THREE.PlaneGeometry(0.9, 0.28);
    wingGeo.translate(0.45, 0, 0);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0x2b2118,
      side: THREE.DoubleSide,
      fog: false
    });

    const defs = [
      { cx: -25, cz: 60, h: 34, r: 22, s: 0.07, p: 0 },
      { cx: 30, cz: 130, h: 40, r: 26, s: 0.055, p: 2.1 },
      { cx: -20, cz: 200, h: 36, r: 20, s: 0.08, p: 4.2 },
      { cx: 25, cz: 280, h: 42, r: 24, s: 0.06, p: 1.2 }
    ];

    defs.forEach((def) => {
      const group = new THREE.Group();
      const leftWing = new THREE.Group();
      const rightWing = new THREE.Group();

      const leftMesh = new THREE.Mesh(wingGeo, wingMat);
      leftMesh.rotation.x = -Math.PI / 2;
      leftWing.add(leftMesh);

      // Mirror the right wing: same geometry, flipped pivot.
      const rightMesh = new THREE.Mesh(wingGeo, wingMat);
      rightMesh.rotation.x = -Math.PI / 2;
      rightMesh.rotation.y = Math.PI;
      rightWing.add(rightMesh);

      group.add(leftWing);
      group.add(rightWing);
      this.scene.add(group);
      this.birds.push({
        group, leftWing, rightWing,
        centerX: def.cx, centerZ: def.cz, height: def.h,
        radius: def.r, speed: def.s, phase: def.p
      });
    });
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
      const pos = banner.geometry.attributes.position as THREE.BufferAttribute;
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

    // Pennant strings + hanging banners: gentle sway around their pivots.
    for (let i = 0; i < this.pennantStrings.length; i++) {
      this.pennantStrings[i].rotation.x = Math.sin(time * 1.1 + i * 2.0) * 0.06;
    }
    for (let i = 0; i < this.hangingBanners.length; i++) {
      this.hangingBanners[i].rotation.x = Math.sin(time * 0.9 + i * 1.4) * 0.05;
    }

    // Torch flicker: flame scale + glow opacity/scale, no real lights.
    for (let i = 0; i < this.torches.length; i++) {
      const t = this.torches[i];
      const flick = Math.sin(time * 13 + t.phase) * 0.5 + Math.sin(time * 29 + t.phase * 2.0) * 0.5;
      t.flame.scale.y = 1 + flick * 0.18;
      t.flame.scale.x = 1 + flick * 0.08;
      t.flame.rotation.y = time * 2 + t.phase;
      const glowMat = t.glow.material as THREE.SpriteMaterial;
      glowMat.opacity = 0.55 + flick * 0.18;
      const gs = 3.0 + flick * 0.35;
      t.glow.scale.set(gs, gs, 1);
    }

    // Clouds drift slowly sideways.
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.sprite.position.x = c.baseX + Math.sin(time * 0.02 + c.phase) * 12;
      c.sprite.position.y = c.baseY + Math.sin(time * 0.013 + c.phase * 1.3) * 1.5;
    }

    // Dust motes drift and bob.
    if (this.dustPoints && this.dustBase && this.dustSeeds) {
      const pos = this.dustPoints.geometry.attributes.position as THREE.BufferAttribute;
      const n = this.dustSeeds.length;
      for (let i = 0; i < n; i++) {
        const s = this.dustSeeds[i];
        pos.setXYZ(
          i,
          this.dustBase[i * 3] + Math.sin(time * 0.23 + s * 2.0) * 0.5,
          this.dustBase[i * 3 + 1] + Math.sin(time * 0.5 + s) * 0.4,
          this.dustBase[i * 3 + 2]
        );
      }
      pos.needsUpdate = true;
    }

    // Birds circle overhead, wings flapping.
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      const theta = time * b.speed + b.phase;
      b.group.position.set(
        b.centerX + Math.cos(theta) * b.radius,
        b.height + Math.sin(time * 0.3 + b.phase) * 2,
        b.centerZ + Math.sin(theta) * b.radius
      );
      b.group.rotation.y = -theta;
      const flap = Math.sin(time * 7 + b.phase * 3.0) * 0.55;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;
    }
  }

  public dispose() {
    this.banners = [];
    this.pennantStrings = [];
    this.hangingBanners = [];
    this.torches = [];
    this.clouds = [];
    this.birds = [];
    this.dustPoints = null;
    this.dustBase = null;
    this.dustSeeds = null;
  }
}
