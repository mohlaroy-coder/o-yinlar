import * as THREE from 'three';
import { groundHeightAt, ISLAND_HALF, ROAD_SEGMENTS } from './terrain';
import { ProceduralTextureSet } from './textures';
import { LootItemData, WeaponId } from './types';
import { WEAPON_SPECS } from './weapons';

export interface BoxCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  isBuildingWall?: boolean;
  isMetal?: boolean;
}

export interface WorldBuildResult {
  worldGroup: THREE.Group;
  colliders: BoxCollider[];
  lootItems: LootItemData[];
  lootMeshes: Map<string, THREE.Group>;
  lootGroup: THREE.Group;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildIslandWorld(textures: ProceduralTextureSet): WorldBuildResult {
  const worldGroup = new THREE.Group();
  const lootGroup = new THREE.Group();
  worldGroup.add(lootGroup);

  const colliders: BoxCollider[] = [];
  const lootItems: LootItemData[] = [];
  const lootMeshes = new Map<string, THREE.Group>();
  const rand = seededRandom(42069);

  // Materials
  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.88,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const concreteMat = new THREE.MeshStandardMaterial({ map: textures.concrete, roughness: 0.84, metalness: 0.05 });
  const brickMat = new THREE.MeshStandardMaterial({ map: textures.brick, roughness: 0.88, metalness: 0.04 });
  const metalMat = new THREE.MeshStandardMaterial({ map: textures.metal, roughness: 0.45, metalness: 0.65 });
  const woodMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.86, metalness: 0.04 });
  const roofTerracotta = new THREE.MeshStandardMaterial({ color: 0x7a3d2e, roughness: 0.8, metalness: 0.05 });
  const roofSlate = new THREE.MeshStandardMaterial({ color: 0x3b424a, roughness: 0.72, metalness: 0.18 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x6ea8c7,
    roughness: 0.12,
    metalness: 0.3,
    transparent: true,
    opacity: 0.45,
  });

  // Helper to add a box mesh + optional collider
  const addBox = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    collide = true,
    isMetal = false,
    castShadow = true
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);

    if (collide) {
      // Compute world bounds assuming parent is only translated
      const wx = parent.position.x + x;
      const wy = parent.position.y + y;
      const wz = parent.position.z + z;
      colliders.push({
        minX: wx - w * 0.5,
        maxX: wx + w * 0.5,
        minY: wy - h * 0.5,
        maxY: wy + h * 0.5,
        minZ: wz - d * 0.5,
        maxZ: wz + d * 0.5,
        isBuildingWall: true,
        isMetal,
      });
    }
    return mesh;
  };

  // 1. Roads & Bridges
  for (const seg of ROAD_SEGMENTS) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const totalLen = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);

    if (seg.isBridge) {
      // Multi-part Steel Truss Bridge
      const bridgeGroup = new THREE.Group();
      const midX = (seg.x1 + seg.x2) * 0.5;
      const midZ = (seg.z1 + seg.z2) * 0.5;
      bridgeGroup.position.set(midX, 4.6, midZ);
      bridgeGroup.rotation.y = angle;

      const deck = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.55, totalLen), roadMat);
      deck.receiveShadow = true;
      deck.castShadow = true;
      bridgeGroup.add(deck);

      // Side steel guardrails
      const railGeo = new THREE.BoxGeometry(0.4, 1.35, totalLen);
      const leftRail = new THREE.Mesh(railGeo, metalMat);
      leftRail.position.set(-seg.width * 0.48, 0.9, 0);
      leftRail.castShadow = true;
      const rightRail = new THREE.Mesh(railGeo, metalMat);
      rightRail.position.set(seg.width * 0.48, 0.9, 0);
      rightRail.castShadow = true;
      bridgeGroup.add(leftRail, rightRail);

      // Overhead arches & pillars
      for (let p = -totalLen * 0.35; p <= totalLen * 0.35; p += totalLen * 0.35) {
        const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.9), metalMat);
        pillarL.position.set(-seg.width * 0.48, 1.5, p);
        const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.9), metalMat);
        pillarR.position.set(seg.width * 0.48, 1.5, p);
        const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.65, 0.9), metalMat);
        crossBeam.position.set(0, 6.0, p);
        bridgeGroup.add(pillarL, pillarR, crossBeam);
      }

      worldGroup.add(bridgeGroup);
    } else {
      // Segmented terrain-hugging road strips
      const steps = Math.max(4, Math.ceil(totalLen / 18));
      const stepLen = totalLen / steps;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const x0 = seg.x1 + dx * t0;
        const z0 = seg.z1 + dz * t0;
        const x1 = seg.x1 + dx * t1;
        const z1 = seg.z1 + dz * t1;
        const h0 = groundHeightAt(x0, z0);
        const h1 = groundHeightAt(x1, z1);
        const midY = (h0 + h1) * 0.5 + 0.08;
        const slopePitch = Math.atan2(h1 - h0, stepLen);

        const strip = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.14, stepLen + 0.5), roadMat);
        strip.position.set((x0 + x1) * 0.5, midY, (z0 + z1) * 0.5);
        strip.rotation.order = 'YXZ';
        strip.rotation.y = angle;
        strip.rotation.x = -slopePitch;
        strip.receiveShadow = true;
        worldGroup.add(strip);
      }
    }
  }

  // Track building footprints so trees don't spawn inside buildings
  const buildingZones: Array<{ x: number; z: number; r: number }> = [];
  const lootSpots: Array<{ x: number; y: number; z: number; tier: 'military' | 'city' | 'normal' }> = [];

  // 2. Enterable Houses (axis-aligned for accurate door/wall collision & smooth entry)
  const buildEnterableHouse = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    style: 'brick' | 'concrete' | 'wood' | 'hangar',
    doorSide: 'north' | 'south' | 'east' | 'west',
    tier: 'military' | 'city' | 'normal'
  ) => {
    const baseY = groundHeightAt(cx, cz);
    const house = new THREE.Group();
    house.position.set(cx, baseY, cz);
    buildingZones.push({ x: cx, z: cz, r: Math.max(w, d) * 0.72 });

    const wallMat =
      style === 'brick' ? brickMat : style === 'wood' ? woodMat : style === 'hangar' ? metalMat : concreteMat;
    const roofMat = style === 'hangar' ? metalMat : style === 'brick' ? roofTerracotta : roofSlate;
    const wallT = 0.42;
    const doorW = 2.4;
    const doorH = 2.65;

    // Foundation / Interior Floor
    addBox(house, w + 0.4, 0.3, d + 0.4, 0, 0.15, 0, concreteMat, false, false, false);

    // Build 4 walls with doorway cutout on doorSide & windows on other sides
    const buildWallWithOpening = (
      side: 'north' | 'south' | 'east' | 'west',
      isDoor: boolean
    ) => {
      const isNS = side === 'north' || side === 'south';
      const wallLen = isNS ? w : d;
      const offsetCoord = isNS
        ? (side === 'north' ? -d * 0.5 + wallT * 0.5 : d * 0.5 - wallT * 0.5)
        : (side === 'west' ? -w * 0.5 + wallT * 0.5 : w * 0.5 - wallT * 0.5);

      if (isDoor) {
        const segLen = (wallLen - doorW) * 0.5;
        if (segLen > 0.2) {
          if (isNS) {
            addBox(house, segLen, h, wallT, -wallLen * 0.5 + segLen * 0.5, h * 0.5 + 0.2, offsetCoord, wallMat);
            addBox(house, segLen, h, wallT, wallLen * 0.5 - segLen * 0.5, h * 0.5 + 0.2, offsetCoord, wallMat);
            // Lintel above door
            const lintelH = Math.max(0.3, h - doorH);
            addBox(house, doorW, lintelH, wallT, 0, doorH + lintelH * 0.5 + 0.2, offsetCoord, wallMat);
          } else {
            addBox(house, wallT, h, segLen, offsetCoord, h * 0.5 + 0.2, -wallLen * 0.5 + segLen * 0.5, wallMat);
            addBox(house, wallT, h, segLen, offsetCoord, h * 0.5 + 0.2, wallLen * 0.5 - segLen * 0.5, wallMat);
            const lintelH = Math.max(0.3, h - doorH);
            addBox(house, wallT, lintelH, doorW, offsetCoord, doorH + lintelH * 0.5 + 0.2, 0, wallMat);
          }
        }
      } else {
        // Windowed wall (sill + pillars + top)
        const winW = Math.min(2.2, wallLen * 0.35);
        const segLen = (wallLen - winW) * 0.5;
        if (isNS) {
          addBox(house, segLen, h, wallT, -wallLen * 0.5 + segLen * 0.5, h * 0.5 + 0.2, offsetCoord, wallMat);
          addBox(house, segLen, h, wallT, wallLen * 0.5 - segLen * 0.5, h * 0.5 + 0.2, offsetCoord, wallMat);
          addBox(house, winW, 1.1, wallT, 0, 0.75, offsetCoord, wallMat);
          addBox(house, winW, Math.max(0.4, h - 2.3), wallT, 0, h - (h - 2.3) * 0.5 + 0.2, offsetCoord, wallMat);
          addBox(house, winW, 1.2, 0.08, 0, 1.9, offsetCoord, glassMat, false, false, false);
        } else {
          addBox(house, wallT, h, segLen, offsetCoord, h * 0.5 + 0.2, -wallLen * 0.5 + segLen * 0.5, wallMat);
          addBox(house, wallT, h, segLen, offsetCoord, h * 0.5 + 0.2, wallLen * 0.5 - segLen * 0.5, wallMat);
          addBox(house, wallT, 1.1, winW, offsetCoord, 0.75, 0, wallMat);
          addBox(house, wallT, Math.max(0.4, h - 2.3), winW, offsetCoord, h - (h - 2.3) * 0.5 + 0.2, 0, wallMat);
          addBox(house, 0.08, 1.2, winW, offsetCoord, 1.9, 0, glassMat, false, false, false);
        }
      }
    };

    buildWallWithOpening('north', doorSide === 'north');
    buildWallWithOpening('south', doorSide === 'south');
    buildWallWithOpening('east', doorSide === 'east');
    buildWallWithOpening('west', doorSide === 'west');

    // Roof
    if (style === 'hangar') {
      const arch = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.52, w * 0.52, d + 0.6, 12, 1, false, 0, Math.PI),
        roofMat
      );
      arch.rotation.z = Math.PI / 2;
      arch.rotation.y = Math.PI / 2;
      arch.position.set(0, h + 0.15, 0);
      arch.scale.set(1, 0.45, 1);
      arch.castShadow = true;
      arch.receiveShadow = true;
      house.add(arch);
    } else {
      addBox(house, w + 0.9, 0.35, d + 0.9, 0, h + 0.35, 0, roofMat, false, false, true);
      if (style === 'brick' || style === 'wood') {
        const ridge = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.68, 2.1, 4), roofMat);
        ridge.rotation.y = Math.PI / 4;
        ridge.position.set(0, h + 1.5, 0);
        ridge.castShadow = true;
        house.add(ridge);
      }
    }

    // Interior furniture props (tactical crate & table)
    addBox(house, 1.3, 0.95, 1.3, -w * 0.26, 0.77, -d * 0.24, woodMat, true, false, true);
    addBox(house, 1.6, 0.8, 0.9, w * 0.24, 0.7, d * 0.2, woodMat, true, false, true);

    worldGroup.add(house);

    // Register 2-3 loot spots inside each house
    lootSpots.push(
      { x: cx - w * 0.18, y: baseY + 0.35, z: cz + d * 0.12, tier },
      { x: cx + w * 0.18, y: baseY + 0.35, z: cz - d * 0.15, tier }
    );
    if (tier === 'military') {
      lootSpots.push({ x: cx, y: baseY + 0.35, z: cz, tier });
    }
  };

  // --- POPULATE NAMED MAP ZONES ---

  // A. Sosnovka Military Base (-30, 360)
  buildEnterableHouse(-65, 345, 16, 24, 5.2, 'hangar', 'north', 'military');
  buildEnterableHouse(-25, 345, 16, 24, 5.2, 'hangar', 'north', 'military');
  buildEnterableHouse(18, 352, 18, 12, 4.2, 'concrete', 'west', 'military');
  buildEnterableHouse(-30, 395, 22, 11, 4.2, 'concrete', 'north', 'military');
  // Military Watchtower
  const towerY = groundHeightAt(24, 388);
  const tower = new THREE.Group();
  tower.position.set(24, towerY, 388);
  addBox(tower, 4.5, 11, 4.5, 0, 5.5, 0, metalMat, true, true);
  addBox(tower, 6.2, 0.4, 6.2, 0, 11.2, 0, concreteMat, false, true);
  addBox(tower, 5.5, 0.4, 5.5, 0, 14.2, 0, roofSlate, false, true);
  worldGroup.add(tower);
  buildingZones.push({ x: 24, z: 388, r: 7 });

  // B. Pochinki City (-10, -20)
  const pochinkiHouses: Array<[number, number, number, number, 'brick' | 'concrete' | 'wood', 'north' | 'south' | 'east' | 'west']> = [
    [-42, -52, 11, 9, 'brick', 'south'],
    [-16, -54, 12, 10, 'concrete', 'south'],
    [14, -50, 10, 11, 'brick', 'west'],
    [-46, -18, 11, 10, 'wood', 'east'],
    [16, -18, 12, 9, 'concrete', 'west'],
    [-38, 16, 12, 10, 'brick', 'north'],
    [-8, 18, 11, 10, 'concrete', 'north'],
    [22, 16, 10, 10, 'wood', 'west'],
  ];
  for (const [hx, hz, hw, hd, st, ds] of pochinkiHouses) {
    buildEnterableHouse(hx, hz, hw, hd, 3.8, st, ds, 'city');
  }

  // C. Zharki Airport (-310, -230)
  const apY = groundHeightAt(-310, -230);
  const runway = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 165), roadMat);
  runway.position.set(-310, apY + 0.1, -230);
  runway.receiveShadow = true;
  worldGroup.add(runway);
  buildingZones.push({ x: -310, z: -230, r: 95 });
  buildEnterableHouse(-272, -250, 16, 22, 5.0, 'hangar', 'west', 'military');
  buildEnterableHouse(-272, -205, 16, 22, 5.0, 'hangar', 'west', 'military');
  buildEnterableHouse(-345, -230, 14, 18, 4.4, 'concrete', 'east', 'city');
  // Parked static cargo plane on apron
  const planeProp = new THREE.Group();
  planeProp.position.set(-310, apY + 2.2, -275);
  addBox(planeProp, 4.2, 3.8, 22, 0, 0, 0, metalMat, true, true);
  addBox(planeProp, 26, 0.5, 4.2, 0, 0.6, -1, metalMat, false, true);
  addBox(planeProp, 8, 4.2, 1.2, 0, 2.8, 9.5, metalMat, false, true);
  worldGroup.add(planeProp);

  // D. Georgopol Harbor (-350, 120)
  buildEnterableHouse(-335, 95, 14, 10, 4.0, 'concrete', 'south', 'city');
  buildEnterableHouse(-370, 125, 15, 12, 4.5, 'hangar', 'east', 'city');
  // Shipping Containers (composite multi-colored industrial crates)
  const containerColors = [0x8b2e2e, 0x2a5470, 0x3b5e3c, 0xa86b24];
  for (let i = 0; i < 8; i++) {
    const cx = -355 + (i % 4) * 11;
    const cz = 142 + Math.floor(i / 4) * 8;
    const cy = groundHeightAt(cx, cz);
    const cMat = new THREE.MeshStandardMaterial({
      color: containerColors[i % containerColors.length],
      map: textures.metal,
      roughness: 0.55,
      metalness: 0.45,
    });
    const cont = new THREE.Group();
    cont.position.set(cx, cy, cz);
    addBox(cont, 7.2, 2.8, 2.9, 0, 1.4, 0, cMat, true, true);
    worldGroup.add(cont);
    buildingZones.push({ x: cx, z: cz, r: 5 });
    lootSpots.push({ x: cx + 4.5, y: cy + 0.15, z: cz, tier: 'city' });
  }

  // E. Mylta Industrial Zone (310, 130)
  buildEnterableHouse(295, 115, 18, 14, 4.8, 'hangar', 'south', 'city');
  buildEnterableHouse(330, 125, 16, 16, 4.4, 'concrete', 'west', 'city');
  buildEnterableHouse(308, 155, 14, 10, 3.8, 'brick', 'north', 'city');
  // Industrial Smokestacks
  for (const sx of [342, 352]) {
    const sy = groundHeightAt(sx, 148);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 22, 12), concreteMat);
    stack.position.set(sx, sy + 11, 148);
    stack.castShadow = true;
    worldGroup.add(stack);
    colliders.push({ minX: sx - 1.9, maxX: sx + 1.9, minY: sy, maxY: sy + 22, minZ: 146.1, maxZ: 149.9 });
  }

  // F. Severny Village (40, -360) & Yasna Village (320, -240)
  buildEnterableHouse(25, -370, 9.5, 8.5, 3.6, 'wood', 'south', 'normal');
  buildEnterableHouse(52, -355, 10, 9, 3.6, 'brick', 'west', 'normal');
  buildEnterableHouse(38, -335, 9, 8, 3.6, 'concrete', 'north', 'normal');

  buildEnterableHouse(305, -252, 10, 8.5, 3.6, 'brick', 'east', 'normal');
  buildEnterableHouse(334, -238, 9.5, 9, 3.6, 'wood', 'west', 'normal');
  buildEnterableHouse(318, -218, 10, 8, 3.6, 'concrete', 'north', 'normal');

  // Scattered roadside farmhouses
  buildEnterableHouse(-145, -110, 9, 8, 3.5, 'wood', 'south', 'normal');
  buildEnterableHouse(155, -35, 9.5, 8.5, 3.6, 'brick', 'west', 'normal');
  buildEnterableHouse(-165, 260, 9, 8, 3.5, 'wood', 'east', 'normal');
  buildEnterableHouse(145, 290, 10, 8.5, 3.6, 'concrete', 'north', 'normal');

  // 3. Instanced Vegetation (Trees with trunks + canopies, Boulders, Grass tufts)
  const treePositions: Array<{ x: number; y: number; z: number; scale: number; tint: number }> = [];
  for (let i = 0; i < 650; i++) {
    const tx = (rand() - 0.5) * (ISLAND_HALF * 1.72);
    const tz = (rand() - 0.5) * (ISLAND_HALF * 1.72);
    const ty = groundHeightAt(tx, tz);
    if (ty < 1.3 || ty > 28) continue;

    // Keep clear of buildings & roads
    let blocked = false;
    for (const bz of buildingZones) {
      if (Math.hypot(tx - bz.x, tz - bz.z) < bz.r + 3.5) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    for (const seg of ROAD_SEGMENTS) {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const lenSq = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((tx - seg.x1) * dx + (tz - seg.z1) * dz) / lenSq));
      const d = Math.hypot(tx - (seg.x1 + dx * t), tz - (seg.z1 + dz * t));
      if (d < seg.width + 3.5) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const scale = 0.78 + rand() * 0.65;
    treePositions.push({ x: tx, y: ty, z: tz, scale, tint: rand() });
  }

  if (treePositions.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 4.2, 7);
    trunkGeo.translate(0, 2.1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3623, roughness: 0.92, metalness: 0.02 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;

    const crownLowerGeo = new THREE.ConeGeometry(2.35, 4.6, 8);
    crownLowerGeo.translate(0, 5.2, 0);
    const crownUpperGeo = new THREE.ConeGeometry(1.75, 3.8, 8);
    crownUpperGeo.translate(0, 7.6, 0);

    const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.02 });
    const crownLowerInst = new THREE.InstancedMesh(crownLowerGeo, foliageMat, treePositions.length);
    const crownUpperInst = new THREE.InstancedMesh(crownUpperGeo, foliageMat, treePositions.length);
    crownLowerInst.castShadow = true;
    crownUpperInst.castShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    treePositions.forEach((tp, idx) => {
      dummy.position.set(tp.x, tp.y - 0.15, tp.z);
      dummy.rotation.set(0, tp.tint * Math.PI * 2, 0);
      dummy.scale.setScalar(tp.scale);
      dummy.updateMatrix();

      trunkInst.setMatrixAt(idx, dummy.matrix);
      crownLowerInst.setMatrixAt(idx, dummy.matrix);
      crownUpperInst.setMatrixAt(idx, dummy.matrix);

      color.setRGB(0.14 + tp.tint * 0.09, 0.28 + tp.tint * 0.11, 0.12 + tp.tint * 0.04);
      crownLowerInst.setColorAt(idx, color);
      crownUpperInst.setColorAt(idx, color.clone().offsetHSL(0, 0, 0.04));

      // Tree trunk collider
      colliders.push({
        minX: tp.x - 0.45 * tp.scale,
        maxX: tp.x + 0.45 * tp.scale,
        minY: tp.y,
        maxY: tp.y + 5 * tp.scale,
        minZ: tp.z - 0.45 * tp.scale,
        maxZ: tp.z + 0.45 * tp.scale,
      });
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    crownLowerInst.instanceMatrix.needsUpdate = true;
    crownUpperInst.instanceMatrix.needsUpdate = true;
    if (crownLowerInst.instanceColor) crownLowerInst.instanceColor.needsUpdate = true;
    if (crownUpperInst.instanceColor) crownUpperInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownLowerInst.computeBoundingSphere();
    crownUpperInst.computeBoundingSphere();

    worldGroup.add(trunkInst, crownLowerInst, crownUpperInst);
  }

  // Instanced Rocks / Boulders
  const rockCount = 160;
  const rockGeo = new THREE.DodecahedronGeometry(1.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6f72, roughness: 0.9, metalness: 0.06 });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  const rDummy = new THREE.Object3D();
  let rockIdx = 0;

  for (let i = 0; i < rockCount * 2 && rockIdx < rockCount; i++) {
    const rx = (rand() - 0.5) * (ISLAND_HALF * 1.75);
    const rz = (rand() - 0.5) * (ISLAND_HALF * 1.75);
    const ry = groundHeightAt(rx, rz);
    if (ry < 0.8) continue;
    let nearB = false;
    for (const bz of buildingZones) {
      if (Math.hypot(rx - bz.x, rz - bz.z) < bz.r + 3) {
        nearB = true;
        break;
      }
    }
    if (nearB) continue;

    const sc = 0.7 + rand() * 1.5;
    rDummy.position.set(rx, ry + sc * 0.55, rz);
    rDummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rDummy.scale.set(sc * 1.2, sc * 0.85, sc);
    rDummy.updateMatrix();
    rockInst.setMatrixAt(rockIdx, rDummy.matrix);
    colliders.push({
      minX: rx - sc * 1.2,
      maxX: rx + sc * 1.2,
      minY: ry,
      maxY: ry + sc * 1.6,
      minZ: rz - sc * 1.1,
      maxZ: rz + sc * 1.1,
    });
    rockIdx++;
  }
  rockInst.count = rockIdx;
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.computeBoundingSphere();
  worldGroup.add(rockInst);

  // 4. Spawn Ground Loot inside Buildings & Landmarks
  const weaponPoolNormal: WeaponId[] = ['uzi', 'ump45', 'shotgun', 'pistol', 'akm', 'scarl'];
  const weaponPoolCity: WeaponId[] = ['akm', 'm416', 'scarl', 'ump45', 'shotgun', 'kar98k', 'uzi'];
  const weaponPoolMilitary: WeaponId[] = ['m416', 'akm', 'scarl', 'kar98k', 'awm', 'ump45'];

  let uidCounter = 1;
  const spawnLootAt = (item: Omit<LootItemData, 'uid' | 'pickedUp'>) => {
    const uid = `loot_${uidCounter++}`;
    const fullItem: LootItemData = { ...item, uid, pickedUp: false };
    lootItems.push(fullItem);
    const mesh = createLootVisualMesh(fullItem);
    mesh.position.set(fullItem.x, fullItem.y, fullItem.z);
    lootGroup.add(mesh);
    lootMeshes.set(uid, mesh);
  };

  for (const spot of lootSpots) {
    const r = rand();
    if (r < 0.48) {
      const pool =
        spot.tier === 'military'
          ? weaponPoolMilitary
          : spot.tier === 'city'
            ? weaponPoolCity
            : weaponPoolNormal;
      const wId = pool[Math.floor(rand() * pool.length)];
      const spec = WEAPON_SPECS[wId];
      spawnLootAt({
        category: 'weapon',
        itemId: wId,
        name: spec.name,
        quantity: 1,
        x: spot.x,
        y: spot.y,
        z: spot.z,
      });
      // Accompanying ammo box right beside weapon
      spawnLootAt({
        category: 'ammo',
        itemId: spec.ammoType,
        name: `${spec.ammoType} Ammo`,
        quantity: wId === 'awm' ? 15 : 30,
        x: spot.x + 0.65,
        y: spot.y,
        z: spot.z + 0.45,
      });
    } else if (r < 0.72) {
      const roll = rand();
      const lvl: 1 | 2 | 3 = spot.tier === 'military' ? (roll < 0.45 ? 3 : 2) : roll < 0.25 ? 2 : 1;
      if (roll < 0.34) {
        spawnLootAt({
          category: 'helmet',
          itemId: `helmet_${lvl}`,
          name: `Helmet Lv.${lvl}`,
          quantity: 1,
          level: lvl,
          x: spot.x,
          y: spot.y,
          z: spot.z,
        });
      } else if (roll < 0.68) {
        spawnLootAt({
          category: 'vest',
          itemId: `vest_${lvl}`,
          name: `Police Vest Lv.${lvl}`,
          quantity: 1,
          level: lvl,
          x: spot.x,
          y: spot.y,
          z: spot.z,
        });
      } else {
        spawnLootAt({
          category: 'backpack',
          itemId: `backpack_${lvl}`,
          name: `Backpack Lv.${lvl}`,
          quantity: 1,
          level: lvl,
          x: spot.x,
          y: spot.y,
          z: spot.z,
        });
      }
    } else if (r < 0.92) {
      const mRoll = rand();
      if (mRoll < 0.2) {
        spawnLootAt({
          category: 'med',
          itemId: 'medkit',
          name: 'Med Kit',
          quantity: 1,
          x: spot.x,
          y: spot.y,
          z: spot.z,
        });
      } else if (mRoll < 0.52) {
        spawnLootAt({
          category: 'med',
          itemId: 'firstaid',
          name: 'First Aid Kit',
          quantity: 1,
          x: spot.x,
          y: spot.y,
          z: spot.z,
        });
      } else if (mRoll < 0.78) {
        spawnLootAt({
          category: 'med',
          itemId: 'bandage',
          name: 'Bandage',
          quantity: 5,
          x: spot.x,
          y: spot.y,
          z: spot.z,
        });
      } else {
        spawnLootAt({
          category: 'med',
          itemId: 'energy',
          name: 'Energy Drink',
          quantity: 1,
          x: spot.x,
          y: spot.y,
          z: spot.z,
        });
      }
    } else {
      spawnLootAt({
        category: 'weapon',
        itemId: 'grenade',
        name: 'Frag Grenade',
        quantity: 2,
        x: spot.x,
        y: spot.y,
        z: spot.z,
      });
    }
  }

  return { worldGroup, colliders, lootItems, lootMeshes, lootGroup };
}

export function createLootVisualMesh(item: LootItemData): THREE.Group {
  const g = new THREE.Group();
  let color = 0xd97706;
  let w = 0.52;
  let h = 0.22;
  let d = 0.34;

  if (item.category === 'weapon') {
    color = item.itemId === 'awm' || item.itemId === 'kar98k' ? 0x22c55e : 0xf59e0b;
    w = 0.78;
    h = 0.16;
    d = 0.24;
  } else if (item.category === 'med') {
    color = item.itemId === 'energy' ? 0x38bdf8 : 0xef4444;
    w = 0.38;
    h = 0.24;
    d = 0.32;
  } else if (item.category === 'helmet' || item.category === 'vest' || item.category === 'backpack') {
    color = item.level === 3 ? 0xa855f7 : item.level === 2 ? 0x3b82f6 : 0x94a3b8;
    w = 0.46;
    h = 0.32;
    d = 0.42;
  } else {
    color = 0x84cc16;
    w = 0.32;
    h = 0.18;
    d = 0.24;
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25 })
  );
  base.position.y = h * 0.5 + 0.05;
  base.castShadow = true;

  // Subtle glow ring on ground so loot is easy to spot inside buildings
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.36, 16),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;

  g.add(base, ring);
  return g;
}
