import * as THREE from 'three';

/**
 * Runtime canvas-generated textures for the Qila Rush visual overhaul.
 * No external image assets, no new dependencies. Every texture is generated
 * once and cached — callers share the same CanvasTexture instance.
 */

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,240,210,${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 2 + Math.random() * 2);
  }
}

let sandstoneTex: THREE.CanvasTexture | null = null;
/** Warm sandstone ashlar blocks — causeway, walls, parapets, torana towers. */
export function getSandstoneTexture(): THREE.CanvasTexture {
  if (sandstoneTex) return sandstoneTex;
  const [canvas, ctx] = makeCanvas(512, 512);
  if (!ctx) return toTexture(canvas);
  ctx.fillStyle = '#d9ab72';
  ctx.fillRect(0, 0, 512, 512);

  // Ashlar block courses with per-block shade variation
  const rowH = 64;
  for (let row = 0; row < 512 / rowH; row++) {
    const offset = row % 2 === 0 ? 0 : 64;
    for (let x = -64; x < 512 + 64; x += 128) {
      const shade = 0.9 + Math.random() * 0.22;
      const r = Math.floor(217 * shade);
      const g = Math.floor(171 * shade);
      const b = Math.floor(114 * shade);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + offset + 3, row * rowH + 3, 122, rowH - 6);
      // Top-light edge on each block
      ctx.fillStyle = 'rgba(255,235,200,0.25)';
      ctx.fillRect(x + offset + 3, row * rowH + 3, 122, 4);
    }
  }

  // Mortar lines
  ctx.strokeStyle = '#8a5a30';
  ctx.lineWidth = 3;
  for (let y = 0; y <= 512; y += rowH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  for (let row = 0; row < 512 / rowH; row++) {
    const offset = row % 2 === 0 ? 0 : 64;
    for (let x = offset; x <= 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, row * rowH);
      ctx.lineTo(x, row * rowH + rowH);
      ctx.stroke();
    }
  }

  // A few hairline cracks
  ctx.strokeStyle = 'rgba(90,55,25,0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 36;
      y += Math.random() * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  speckle(ctx, 512, 512, 2600, 0.07);
  sandstoneTex = toTexture(canvas);
  return sandstoneTex;
}

let marbleTex: THREE.CanvasTexture | null = null;
/** Pale cream marble with soft gold-grey veining — chhatri domes, trims. */
export function getMarbleTexture(): THREE.CanvasTexture {
  if (marbleTex) return marbleTex;
  const [canvas, ctx] = makeCanvas(256, 256);
  if (!ctx) return toTexture(canvas);
  ctx.fillStyle = '#f3e6cf';
  ctx.fillRect(0, 0, 256, 256);

  // Soft cloudy patches
  for (let i = 0; i < 14; i++) {
    const grad = ctx.createRadialGradient(
      Math.random() * 256, Math.random() * 256, 4,
      Math.random() * 256, Math.random() * 256, 40 + Math.random() * 50
    );
    grad.addColorStop(0, 'rgba(214,182,138,0.20)');
    grad.addColorStop(1, 'rgba(214,182,138,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }

  // Veins
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(180,140,80,0.45)' : 'rgba(120,110,100,0.35)';
    ctx.lineWidth = 0.8 + Math.random() * 1.4;
    let x = Math.random() * 256;
    let y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < 256) {
      x += (Math.random() - 0.5) * 44;
      y += 18 + Math.random() * 26;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  speckle(ctx, 256, 256, 500, 0.05);
  marbleTex = toTexture(canvas);
  return marbleTex;
}

let woodTex: THREE.CanvasTexture | null = null;
/** Heavy dark timber planks with grain + knots — barricades. */
export function getWoodTexture(): THREE.CanvasTexture {
  if (woodTex) return woodTex;
  const [canvas, ctx] = makeCanvas(512, 256);
  if (!ctx) return toTexture(canvas);
  ctx.fillStyle = '#6b3a1c';
  ctx.fillRect(0, 0, 512, 256);

  // Horizontal planks
  const plankH = 64;
  for (let p = 0; p < 256 / plankH; p++) {
    const shade = 0.88 + Math.random() * 0.28;
    const r = Math.floor(107 * shade);
    const g = Math.floor(58 * shade);
    const b = Math.floor(28 * shade);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, p * plankH + 2, 512, plankH - 4);

    // Grain lines
    ctx.strokeStyle = 'rgba(40,18,6,0.5)';
    ctx.lineWidth = 1.2;
    for (let gLine = 0; gLine < 7; gLine++) {
      const y0 = p * plankH + 8 + Math.random() * (plankH - 16);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= 512; x += 32) {
        ctx.lineTo(x, y0 + Math.sin(x * 0.02 + gLine) * 3 + (Math.random() - 0.5) * 2);
      }
      ctx.stroke();
    }

    // Knot
    if (Math.random() > 0.3) {
      const kx = 40 + Math.random() * 430;
      const ky = p * plankH + plankH / 2;
      ctx.strokeStyle = 'rgba(35,15,5,0.7)';
      ctx.lineWidth = 2;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(kx, ky, ring * 5, ring * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Plank gap + iron nail dots
    ctx.fillStyle = 'rgba(20,8,2,0.85)';
    ctx.fillRect(0, p * plankH, 512, 3);
    ctx.fillStyle = '#2b2f36';
    for (let nx = 24; nx < 512; nx += 96) {
      ctx.beginPath();
      ctx.arc(nx, p * plankH + plankH / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  speckle(ctx, 512, 256, 900, 0.06);
  woodTex = toTexture(canvas);
  return woodTex;
}

let skyTex: THREE.CanvasTexture | null = null;
/** Golden-hour vertical gradient for the sky dome (canvas top = zenith). */
export function getSkyTexture(): THREE.CanvasTexture {
  if (skyTex) return skyTex;
  const [canvas, ctx] = makeCanvas(16, 512);
  if (!ctx) return toTexture(canvas);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#1d3a6e');
  grad.addColorStop(0.38, '#5f8fc9');
  grad.addColorStop(0.58, '#e8a75e');
  grad.addColorStop(0.72, '#ffc46b');
  grad.addColorStop(0.86, '#f2b25c');
  grad.addColorStop(1.0, '#d99a55');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 512);
  skyTex = toTexture(canvas);
  skyTex.wrapS = THREE.ClampToEdgeWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;
  return skyTex;
}

let glowTex: THREE.CanvasTexture | null = null;
/** Soft radial glow — sun halo, torch glows, cloud puffs share this. */
export function getGlowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const [canvas, ctx] = makeCanvas(128, 128);
  if (!ctx) return toTexture(canvas);
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = toTexture(canvas);
  glowTex.wrapS = THREE.ClampToEdgeWrapping;
  glowTex.wrapT = THREE.ClampToEdgeWrapping;
  return glowTex;
}

let cloudTex: THREE.CanvasTexture | null = null;
/** A few merged soft puffs — one billboarded cloud sprite. */
export function getCloudTexture(): THREE.CanvasTexture {
  if (cloudTex) return cloudTex;
  const [canvas, ctx] = makeCanvas(256, 128);
  if (!ctx) return toTexture(canvas);
  const puffs: Array<[number, number, number]> = [
    [70, 78, 42], [120, 62, 52], [175, 78, 44], [105, 88, 36], [155, 92, 32]
  ];
  for (const [x, y, r] of puffs) {
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(255,246,230,0.85)');
    grad.addColorStop(0.6, 'rgba(255,240,220,0.45)');
    grad.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  cloudTex = toTexture(canvas);
  cloudTex.wrapS = THREE.ClampToEdgeWrapping;
  cloudTex.wrapT = THREE.ClampToEdgeWrapping;
  return cloudTex;
}

const bannerEmblemCache = new Map<string, THREE.CanvasTexture>();
/** Vertical hanging banner cloth: coloured field, gold border, sun emblem. */
export function getBannerEmblemTexture(baseColor: string): THREE.CanvasTexture {
  const cached = bannerEmblemCache.get(baseColor);
  if (cached) return cached;
  const [canvas, ctx] = makeCanvas(128, 256);
  if (!ctx) return toTexture(canvas);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);

  // Cloth shading: darker edges, lighter centre fold
  const shade = ctx.createLinearGradient(0, 0, 128, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.35)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0.10)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 128, 256);

  // Gold border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.strokeRect(7, 7, 114, 242);
  ctx.strokeStyle = 'rgba(254,240,138,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(15, 15, 98, 226);

  // Sun / chakra emblem
  ctx.save();
  ctx.translate(64, 108);
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 5;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 32, Math.sin(a) * 32);
    ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44);
    ctx.stroke();
  }
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Small diamond motif near the hem
  ctx.fillStyle = '#fde047';
  ctx.save();
  ctx.translate(64, 205);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();

  const tex = toTexture(canvas);
  bannerEmblemCache.set(baseColor, tex);
  return tex;
}
