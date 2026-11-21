import * as THREE from 'three';

function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export interface ProceduralTextureSet {
  grass: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  brick: THREE.CanvasTexture;
  metal: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  camo: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy = 4): ProceduralTextureSet {
  // 1. Grass / Terrain detail texture (tiled for crisp micro-detail over vertex-colored terrain)
  const [gCanvas, gCtx] = createCanvas(256);
  gCtx.fillStyle = '#c8ceb8';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3500; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
    const px = Math.abs(x) * 256;
    const py = Math.abs(y) * 256;
    const shade = 165 + ((i * 37) % 65);
    gCtx.fillStyle = `rgb(${shade - 10}, ${shade}, ${shade - 22})`;
    gCtx.fillRect(px, py, 2, 3);
  }
  const grass = finalizeTexture(gCanvas, 90, 90, maxAnisotropy, true);

  // 2. Asphalt road texture with lane markings
  const [aCanvas, aCtx] = createCanvas(256);
  aCtx.fillStyle = '#2d3136';
  aCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const px = (i * 73) % 256;
    const py = (i * 137) % 256;
    const v = 36 + (i % 24);
    aCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 4})`;
    aCtx.fillRect(px, py, 2, 2);
  }
  aCtx.fillStyle = '#d4a638';
  aCtx.fillRect(124, 16, 8, 92);
  aCtx.fillRect(124, 144, 8, 92);
  aCtx.fillStyle = 'rgba(225, 230, 235, 0.55)';
  aCtx.fillRect(10, 0, 4, 256);
  aCtx.fillRect(242, 0, 4, 256);
  const asphalt = finalizeTexture(aCanvas, 1, 16, maxAnisotropy, true);

  // 3. Weathered Concrete
  const [cCanvas, cCtx] = createCanvas(256);
  cCtx.fillStyle = '#9aa0a6';
  cCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const px = (i * 59) % 256;
    const py = (i * 113) % 256;
    const v = 132 + (i % 38);
    cCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 3})`;
    cCtx.fillRect(px, py, 3, 2);
  }
  cCtx.strokeStyle = 'rgba(60, 64, 68, 0.25)';
  cCtx.lineWidth = 2;
  cCtx.strokeRect(0, 0, 256, 128);
  cCtx.strokeRect(0, 128, 256, 128);
  const concrete = finalizeTexture(cCanvas, 2, 2, maxAnisotropy, true);

  // 4. Brick / Stucco building facade
  const [bCanvas, bCtx] = createCanvas(256);
  bCtx.fillStyle = '#8b5a48';
  bCtx.fillRect(0, 0, 256, 256);
  const rowH = 24;
  const colW = 48;
  for (let y = 0; y < 256; y += rowH) {
    const offset = ((y / rowH) % 2) * (colW / 2);
    for (let x = -colW; x < 256 + colW; x += colW) {
      const shade = ((x * 7 + y * 13) % 22) - 11;
      bCtx.fillStyle = `rgb(${144 + shade}, ${88 + shade}, ${70 + shade})`;
      bCtx.fillRect(x + offset + 2, y + 2, colW - 4, rowH - 4);
    }
  }
  const brick = finalizeTexture(bCanvas, 2, 2, maxAnisotropy, true);

  // 5. Corrugated Military Metal
  const [mCanvas, mCtx] = createCanvas(256);
  mCtx.fillStyle = '#535e66';
  mCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    mCtx.fillStyle = 'rgba(255,255,255,0.08)';
    mCtx.fillRect(x, 0, 6, 256);
    mCtx.fillStyle = 'rgba(0,0,0,0.16)';
    mCtx.fillRect(x + 8, 0, 6, 256);
  }
  mCtx.fillStyle = 'rgba(30,35,40,0.28)';
  mCtx.fillRect(0, 124, 256, 4);
  const metal = finalizeTexture(mCanvas, 3, 2, maxAnisotropy, true);

  // 6. Wood Planks
  const [wCanvas, wCtx] = createCanvas(256);
  wCtx.fillStyle = '#7b583a';
  wCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const tone = ((y * 19) % 24) - 12;
    wCtx.fillStyle = `rgb(${120 + tone}, ${86 + tone}, ${56 + tone})`;
    wCtx.fillRect(0, y + 1, 256, 30);
    wCtx.fillStyle = 'rgba(40,25,12,0.22)';
    wCtx.fillRect(0, y + 12, 256, 2);
  }
  const wood = finalizeTexture(wCanvas, 2, 2, maxAnisotropy, true);

  // 7. Military Camo / Tarpaulin
  const [caCanvas, caCtx] = createCanvas(256);
  caCtx.fillStyle = '#47523a';
  caCtx.fillRect(0, 0, 256, 256);
  const patches = ['#36402c', '#5b6647', '#2b3024', '#6d6247'];
  for (let i = 0; i < 45; i++) {
    caCtx.fillStyle = patches[i % patches.length];
    caCtx.beginPath();
    caCtx.ellipse(
      ((i * 89) % 240) + 8,
      ((i * 53) % 240) + 8,
      18 + (i % 24),
      12 + (i % 18),
      (i * 0.7) % Math.PI,
      0,
      Math.PI * 2
    );
    caCtx.fill();
  }
  const camo = finalizeTexture(caCanvas, 2, 2, maxAnisotropy, true);

  // 8. Radial Contact Shadow (non-repeating)
  const [sCanvas, sCtx] = createCanvas(128);
  const grad = sCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(sCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  return {
    grass,
    asphalt,
    concrete,
    brick,
    metal,
    wood,
    camo,
    contactShadow,
    dispose: () => {
      grass.dispose();
      asphalt.dispose();
      concrete.dispose();
      brick.dispose();
      metal.dispose();
      wood.dispose();
      camo.dispose();
      contactShadow.dispose();
    },
  };
}
