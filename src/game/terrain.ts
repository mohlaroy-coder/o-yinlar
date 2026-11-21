import * as THREE from 'three';
import { MapZonePOI } from './types';

export const ISLAND_SIZE = 1200;
export const ISLAND_HALF = ISLAND_SIZE / 2;
export const WATER_LEVEL = 0.0;

export const MAP_POIS: MapZonePOI[] = [
  { id: 'military', name: 'Sosnovka Military Base', x: -30, z: 360, radius: 110, kind: 'military' },
  { id: 'city', name: 'Pochinki City', x: -10, z: -20, radius: 115, kind: 'city' },
  { id: 'airport', name: 'Zharki Airport', x: -310, z: -230, radius: 120, kind: 'airport' },
  { id: 'harbor', name: 'Georgopol Harbor', x: -350, z: 120, radius: 95, kind: 'harbor' },
  { id: 'industrial', name: 'Mylta Industrial Zone', x: 310, z: 130, radius: 95, kind: 'industrial' },
  { id: 'village_n', name: 'Severny Village', x: 40, z: -360, radius: 75, kind: 'village' },
  { id: 'village_e', name: 'Yasna Village', x: 320, z: -240, radius: 75, kind: 'village' },
  { id: 'forest', name: 'Whispering Pine Forest', x: -190, z: 160, radius: 100, kind: 'nature' },
  { id: 'mountain', name: 'Stalber Peak', x: 240, z: -380, radius: 110, kind: 'nature' },
];

export interface RoadSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  isBridge?: boolean;
}

// Connected island road network linking every major POI & crossing the river via bridges
export const ROAD_SEGMENTS: RoadSegment[] = [
  // Main North-South highway through Pochinki & Military Base (bridges across river at z ~ 185)
  { x1: 40, z1: -360, x2: -10, z2: -20, width: 10 },
  { x1: -10, z1: -20, x2: -20, z2: 140, width: 10 },
  { x1: -20, z1: 140, x2: -25, z2: 245, width: 10, isBridge: true },
  { x1: -25, z1: 245, x2: -30, z2: 360, width: 10 },

  // West highway: Airport -> Harbor -> Pochinki
  { x1: -310, z1: -230, x2: -350, z2: 120, width: 9 },
  { x1: -350, z1: 120, x2: -10, z2: -20, width: 9 },

  // East highway: Severny -> Yasna -> Industrial -> Military
  { x1: 40, z1: -360, x2: 320, z2: -240, width: 8 },
  { x1: 320, z1: -240, x2: 310, z2: 130, width: 9 },
  { x1: -10, z1: -20, x2: 310, z2: 130, width: 9 },
  { x1: 310, z1: 130, x2: 220, z2: 235, width: 9, isBridge: true },
  { x1: 220, z1: 235, x2: -30, z2: 360, width: 9 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Deterministic multi-octave terrain height function
export function rawIslandHeight(x: number, z: number): number {
  // Distance from island center (oval island shape)
  const nx = x / 540;
  const nz = z / 530;
  const radial = Math.sqrt(nx * nx + nz * nz);
  const coastNoise = Math.sin(x * 0.008) * Math.cos(z * 0.008) * 0.08 + Math.sin(x * 0.02 + z * 0.015) * 0.04;
  const islandMask = 1 - smoothstep(0.72, 1.03, radial + coastNoise);

  // Rolling hills
  const hills =
    Math.sin(x * 0.009) * Math.cos(z * 0.009) * 9.5 +
    Math.sin(x * 0.023 + 1.4) * Math.sin(z * 0.021 + 0.7) * 4.2 +
    Math.cos(x * 0.055 - z * 0.048) * 1.4;

  // Stalber mountain peak in NE (240, -380)
  const dMtn = Math.hypot(x - 240, z + 380);
  const mtnPeak = Math.max(0, 1 - dMtn / 150);
  const mtnHeight = mtnPeak * mtnPeak * 44;

  // Western ridge near forest
  const dRidge = Math.hypot(x + 220, z - 250);
  const ridgePeak = Math.max(0, 1 - dRidge / 130);
  const ridgeHeight = ridgePeak * ridgePeak * 18;

  let h = (6.5 + hills + mtnHeight + ridgeHeight) * islandMask - (1 - islandMask) * 8.5;

  // River channel slicing East-West across z ~ 195 + gentle sine curve
  const riverCenterZ = 192 + Math.sin(x * 0.008) * 26;
  const dRiver = Math.abs(z - riverCenterZ);
  if (dRiver < 36 && Math.abs(x) < 470) {
    const carve = 1 - smoothstep(10, 36, dRiver);
    h = THREE.MathUtils.lerp(h, -2.6, carve);
  }

  // Central Lake near (125, -135)
  const dLake = Math.hypot(x - 135, z + 130);
  if (dLake < 58) {
    const lakeCarve = 1 - smoothstep(22, 58, dLake);
    h = THREE.MathUtils.lerp(h, -2.2, lakeCarve);
  }

  // Flatten playable compound zones for crisp building & runway placement
  const plateaus: Array<{ x: number; z: number; r: number; targetH: number }> = [
    { x: -30, z: 360, r: 105, targetH: 5.5 }, // Military Base
    { x: -10, z: -20, r: 105, targetH: 6.2 }, // Pochinki City
    { x: -310, z: -230, r: 115, targetH: 5.0 }, // Airport
    { x: -350, z: 120, r: 85, targetH: 2.2 }, // Harbor
    { x: 310, z: 130, r: 88, targetH: 5.2 }, // Industrial
    { x: 40, z: -360, r: 65, targetH: 7.0 }, // Severny Village
    { x: 320, z: -240, r: 65, targetH: 6.8 }, // Yasna Village
  ];

  for (const p of plateaus) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r) {
      const blend = 1 - smoothstep(p.r * 0.58, p.r, d);
      h = THREE.MathUtils.lerp(h, p.targetH, blend);
    }
  }

  return h;
}

export function isOnBridgeAt(x: number, z: number): number | null {
  for (const seg of ROAD_SEGMENTS) {
    if (!seg.isBridge) continue;
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - seg.x1) * dx + (z - seg.z1) * dz) / lenSq));
    const px = seg.x1 + dx * t;
    const pz = seg.z1 + dz * t;
    const dist = Math.hypot(x - px, z - pz);
    if (dist <= seg.width * 0.62) {
      // Bridge deck sits at y = 4.6 with gentle approach ramps
      const ramp = Math.min(t * 5, (1 - t) * 5, 1);
      return 2.0 + ramp * 2.8;
    }
  }
  return null;
}

export function groundHeightAt(x: number, z: number): number {
  const bridgeH = isOnBridgeAt(x, z);
  const terrainH = rawIslandHeight(x, z);
  if (bridgeH !== null) {
    return Math.max(terrainH, bridgeH);
  }
  return terrainH;
}

export function getLocationName(x: number, z: number): string {
  let closest = 'Erangel Countryside';
  let minD = Infinity;
  for (const poi of MAP_POIS) {
    const d = Math.hypot(x - poi.x, z - poi.z);
    if (d < poi.radius * 1.25 && d < minD) {
      minD = d;
      closest = poi.name;
    }
  }
  return closest;
}

export function createTerrainMesh(grassTexture: THREE.Texture): {
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
} {
  const segs = 192;
  const geo = new THREE.PlaneGeometry(ISLAND_SIZE + 260, ISLAND_SIZE + 260, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = rawIslandHeight(x, z);
    pos.setY(i, h);

    if (h < 1.1) {
      // Wet sand / coastal beach
      c.setHex(0xc2b28b);
    } else if (h > 22) {
      // Rocky alpine mountain
      c.setHex(0x6e7378);
    } else if (h > 14) {
      // Highland scrub
      c.setHex(0x606b49);
    } else {
      // Lush olive/meadow grass with subtle variation
      const n = Math.sin(x * 0.03) * Math.cos(z * 0.03) * 0.5 + 0.5;
      c.setRGB(0.28 + n * 0.08, 0.38 + n * 0.09, 0.21 + n * 0.04);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: grassTexture,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });

  const terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;

  // Vast Ocean & River Water Plane
  const waterGeo = new THREE.PlaneGeometry(2800, 2800, 32, 32);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a4b66,
    roughness: 0.16,
    metalness: 0.12,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
    transparent: true,
    opacity: 0.88,
  });

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_LEVEL;
  waterMesh.receiveShadow = true;

  return { terrainMesh, waterMesh };
}
