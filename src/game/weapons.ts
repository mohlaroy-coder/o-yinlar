import * as THREE from 'three';
import { WeaponId, WeaponSpec } from './types';

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  akm: {
    id: 'akm',
    name: 'AKM',
    category: 'AR',
    ammoType: '7.62mm',
    damage: 44,
    headshotMult: 2.1,
    fireRateMs: 105,
    magSize: 30,
    reloadTimeMs: 2100,
    automatic: true,
    recoilVertical: 0.026,
    recoilHorizontal: 0.011,
    baseSpread: 0.022,
    adsSpread: 0.004,
    adsFov: 52,
    range: 420,
    pellets: 1,
    bulletSpeed: 290,
    slotGroup: 'primary',
    colorHex: 0x26292e,
    accentHex: 0x6b4426,
  },
  m416: {
    id: 'm416',
    name: 'M416',
    category: 'AR',
    ammoType: '5.56mm',
    damage: 38,
    headshotMult: 2.1,
    fireRateMs: 86,
    magSize: 30,
    reloadTimeMs: 1850,
    automatic: true,
    recoilVertical: 0.017,
    recoilHorizontal: 0.007,
    baseSpread: 0.017,
    adsSpread: 0.0028,
    adsFov: 50,
    range: 440,
    pellets: 1,
    bulletSpeed: 320,
    slotGroup: 'primary',
    colorHex: 0x1f2328,
    accentHex: 0x3b4048,
  },
  scarl: {
    id: 'scarl',
    name: 'SCAR-L',
    category: 'AR',
    ammoType: '5.56mm',
    damage: 39,
    headshotMult: 2.05,
    fireRateMs: 96,
    magSize: 30,
    reloadTimeMs: 1950,
    automatic: true,
    recoilVertical: 0.016,
    recoilHorizontal: 0.006,
    baseSpread: 0.018,
    adsSpread: 0.003,
    adsFov: 50,
    range: 430,
    pellets: 1,
    bulletSpeed: 315,
    slotGroup: 'primary',
    colorHex: 0x9b8763,
    accentHex: 0x2d2b26,
  },
  awm: {
    id: 'awm',
    name: 'AWM',
    category: 'SR',
    ammoType: '.300 Magnum',
    damage: 118,
    headshotMult: 2.5,
    fireRateMs: 1350,
    magSize: 5,
    reloadTimeMs: 2800,
    automatic: false,
    recoilVertical: 0.065,
    recoilHorizontal: 0.012,
    baseSpread: 0.045,
    adsSpread: 0.0005,
    adsFov: 22,
    range: 750,
    pellets: 1,
    bulletSpeed: 480,
    slotGroup: 'primary',
    colorHex: 0x45533a,
    accentHex: 0x1d2125,
  },
  kar98k: {
    id: 'kar98k',
    name: 'Kar98k',
    category: 'SR',
    ammoType: '7.62mm',
    damage: 86,
    headshotMult: 2.45,
    fireRateMs: 1180,
    magSize: 5,
    reloadTimeMs: 2500,
    automatic: false,
    recoilVertical: 0.055,
    recoilHorizontal: 0.01,
    baseSpread: 0.042,
    adsSpread: 0.0008,
    adsFov: 26,
    range: 680,
    pellets: 1,
    bulletSpeed: 420,
    slotGroup: 'primary',
    colorHex: 0x6e472b,
    accentHex: 0x2a2e33,
  },
  uzi: {
    id: 'uzi',
    name: 'Micro UZI',
    category: 'SMG',
    ammoType: '9mm',
    damage: 24,
    headshotMult: 1.8,
    fireRateMs: 54,
    magSize: 25,
    reloadTimeMs: 1450,
    automatic: true,
    recoilVertical: 0.012,
    recoilHorizontal: 0.009,
    baseSpread: 0.025,
    adsSpread: 0.008,
    adsFov: 58,
    range: 210,
    pellets: 1,
    bulletSpeed: 240,
    slotGroup: 'primary',
    colorHex: 0x26292e,
    accentHex: 0x41464e,
  },
  ump45: {
    id: 'ump45',
    name: 'UMP45',
    category: 'SMG',
    ammoType: '.45 ACP',
    damage: 34,
    headshotMult: 1.85,
    fireRateMs: 92,
    magSize: 25,
    reloadTimeMs: 1750,
    automatic: true,
    recoilVertical: 0.014,
    recoilHorizontal: 0.006,
    baseSpread: 0.018,
    adsSpread: 0.005,
    adsFov: 54,
    range: 270,
    pellets: 1,
    bulletSpeed: 255,
    slotGroup: 'primary',
    colorHex: 0x22252a,
    accentHex: 0x525760,
  },
  shotgun: {
    id: 'shotgun',
    name: 'S1897 Shotgun',
    category: 'SG',
    ammoType: '12 Gauge',
    damage: 19, // x8 pellets = 152 close range
    headshotMult: 1.5,
    fireRateMs: 740,
    magSize: 5,
    reloadTimeMs: 2300,
    automatic: false,
    recoilVertical: 0.06,
    recoilHorizontal: 0.02,
    baseSpread: 0.068,
    adsSpread: 0.044,
    adsFov: 58,
    range: 95,
    pellets: 8,
    bulletSpeed: 220,
    slotGroup: 'primary',
    colorHex: 0x2a2d32,
    accentHex: 0x5f3d23,
  },
  pistol: {
    id: 'pistol',
    name: 'P92 Pistol',
    category: 'HG',
    ammoType: '9mm',
    damage: 28,
    headshotMult: 1.9,
    fireRateMs: 220,
    magSize: 15,
    reloadTimeMs: 1350,
    automatic: false,
    recoilVertical: 0.018,
    recoilHorizontal: 0.006,
    baseSpread: 0.02,
    adsSpread: 0.006,
    adsFov: 60,
    range: 180,
    pellets: 1,
    bulletSpeed: 230,
    slotGroup: 'sidearm',
    colorHex: 0x282b30,
    accentHex: 0x16181c,
  },
  grenade: {
    id: 'grenade',
    name: 'Frag Grenade',
    category: 'TH',
    ammoType: 'Grenade',
    damage: 130,
    headshotMult: 1.0,
    fireRateMs: 1000,
    magSize: 1,
    reloadTimeMs: 800,
    automatic: false,
    recoilVertical: 0.01,
    recoilHorizontal: 0,
    baseSpread: 0.01,
    adsSpread: 0.01,
    adsFov: 65,
    range: 48,
    pellets: 1,
    bulletSpeed: 28,
    slotGroup: 'throwable',
    colorHex: 0x3b4834,
    accentHex: 0xd97706,
  },
};

/**
 * Builds a composite 6-10 part procedural 3D weapon model oriented along -Z (barrel forward).
 */
export function createWeaponMesh(weaponId: WeaponId): THREE.Group {
  const spec = WEAPON_SPECS[weaponId];
  const group = new THREE.Group();

  const gunMetal = new THREE.MeshStandardMaterial({
    color: spec.colorHex,
    roughness: 0.34,
    metalness: 0.78,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentHex,
    roughness: weaponId === 'akm' || weaponId === 'kar98k' || weaponId === 'shotgun' ? 0.72 : 0.45,
    metalness: weaponId === 'akm' || weaponId === 'kar98k' || weaponId === 'shotgun' ? 0.08 : 0.5,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x15181c,
    roughness: 0.28,
    metalness: 0.88,
  });

  if (weaponId === 'grenade') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), gunMetal);
    body.scale.set(1, 1.22, 1);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.03, 12), darkSteel);
    collar.position.y = 0.068;
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.075, 0.022), accentMat);
    spoon.position.set(0.03, 0.04, 0);
    spoon.rotation.z = -0.22;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 8, 16), accentMat);
    ring.position.set(-0.025, 0.075, 0);
    group.add(body, collar, spoon, ring);
    return group;
  }

  if (weaponId === 'pistol') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.04, 0.22), gunMetal);
    slide.position.set(0, 0.03, -0.04);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.19), darkSteel);
    frame.position.set(0, 0.002, -0.025);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 0.042), accentMat);
    grip.position.set(0, -0.055, 0.04);
    grip.rotation.x = 0.24;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), darkSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.028, -0.155);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.01), accentMat);
    sight.position.set(0, 0.054, -0.13);
    group.add(slide, frame, grip, barrel, sight);
    return group;
  }

  // Long guns / SMGs
  const isSniper = weaponId === 'awm' || weaponId === 'kar98k';
  const isSmg = weaponId === 'uzi' || weaponId === 'ump45';
  const isShotgun = weaponId === 'shotgun';

  const bodyLen = isSniper ? 0.42 : isSmg ? 0.24 : 0.34;
  const barrelLen = isSniper ? 0.56 : isSmg ? 0.18 : isShotgun ? 0.46 : 0.36;

  // 1. Receiver
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.072, bodyLen), gunMetal);
  receiver.position.set(0, 0.02, 0);

  // 2. Handguard / Forend
  const handguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.052, barrelLen * 0.65),
    accentMat
  );
  handguard.position.set(0, 0.018, -bodyLen * 0.5 - barrelLen * 0.28);

  // 3. Barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.013, barrelLen, 12),
    darkSteel
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.032, -bodyLen * 0.5 - barrelLen * 0.48);

  // 4. Muzzle brake / Flash hider
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.014, 0.055, 12),
    darkSteel
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.032, -bodyLen * 0.5 - barrelLen * 0.96);

  // 5. Pistol grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.115, 0.044), accentMat);
  grip.position.set(0, -0.055, bodyLen * 0.22);
  grip.rotation.x = 0.26;

  // 6. Stock
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.038, 0.085, isSmg ? 0.16 : 0.26),
    accentMat
  );
  stock.position.set(0, 0.005, bodyLen * 0.5 + (isSmg ? 0.07 : 0.12));

  // 7. Magazine
  const mag = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, isSniper ? 0.06 : 0.16, 0.052),
    darkSteel
  );
  mag.position.set(0, isSniper ? -0.04 : -0.085, -bodyLen * 0.14);
  if (weaponId === 'akm') mag.rotation.x = -0.25;
  if (weaponId === 'uzi') mag.position.set(0, -0.085, bodyLen * 0.22);

  // 8. Optic / Sight Rail
  if (isSniper) {
    const scopeTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.24, 14),
      darkSteel
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.085, -0.02);
    const scopeLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.022, 0.05, 14),
      gunMetal
    );
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.position.set(0, 0.085, -0.14);
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.03, 0.14), darkSteel);
    mount.position.set(0, 0.062, -0.02);
    group.add(scopeTube, scopeLens, mount);
  } else {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.015, bodyLen * 0.8), darkSteel);
    rail.position.set(0, 0.062, -0.02);
    const redDot = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.055), darkSteel);
    redDot.position.set(0, 0.08, 0.02);
    const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.026, 0.015), darkSteel);
    frontPost.position.set(0, 0.056, -bodyLen * 0.5 - barrelLen * 0.78);
    group.add(rail, redDot, frontPost);
  }

  group.add(receiver, handguard, barrel, muzzle, grip, stock, mag);

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
    }
  });

  return group;
}

/**
 * Creates a detailed First-Person Viewmodel (sleeves, forearms, tactical gloves, weapon mount, muzzle flash).
 */
export function createFppViewmodelRig(sleeveColor = 0x3b4834): {
  root: THREE.Group;
  weaponAnchor: THREE.Group;
  muzzleFlash: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  updateWeapon: (id: WeaponId | null) => void;
} {
  const root = new THREE.Group();
  const weaponAnchor = new THREE.Group();
  weaponAnchor.position.set(0.22, -0.21, -0.44);

  const sleeveMat = new THREE.MeshStandardMaterial({ color: sleeveColor, roughness: 0.82, metalness: 0.05 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.72, metalness: 0.12 });

  // Right arm (trigger hand)
  const rightArm = new THREE.Group();
  const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.052, 0.34, 10), sleeveMat);
  rSleeve.rotation.x = Math.PI / 2;
  rSleeve.position.set(0.04, -0.06, 0.22);
  const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.058, 0.095), gloveMat);
  rGlove.position.set(0.0, -0.045, 0.05);
  rightArm.add(rSleeve, rGlove);

  // Left arm (foregrip support hand)
  const leftArm = new THREE.Group();
  const lSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.38, 10), sleeveMat);
  lSleeve.rotation.set(Math.PI / 2.2, 0, -0.32);
  lSleeve.position.set(-0.14, -0.09, 0.04);
  const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.056, 0.09), gloveMat);
  lGlove.position.set(-0.01, -0.025, -0.17);
  leftArm.add(lSleeve, lGlove);

  // Muzzle flash star
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffc65c,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), flashMat);
  muzzleFlash.scale.set(1, 1, 2.2);
  muzzleFlash.position.set(0, 0.032, -0.68);
  muzzleFlash.visible = false;

  weaponAnchor.add(rightArm, leftArm, muzzleFlash);
  root.add(weaponAnchor);

  let currentWeaponMesh: THREE.Group | null = null;
  let currentId: WeaponId | null = null;

  const updateWeapon = (id: WeaponId | null) => {
    if (id === currentId) return;
    currentId = id;
    if (currentWeaponMesh) {
      weaponAnchor.remove(currentWeaponMesh);
      currentWeaponMesh = null;
    }
    if (id) {
      currentWeaponMesh = createWeaponMesh(id);
      weaponAnchor.add(currentWeaponMesh);
      leftArm.visible = id !== 'pistol' && id !== 'grenade';
      const isLong = id === 'awm' || id === 'kar98k';
      muzzleFlash.position.z = isLong ? -0.9 : id === 'pistol' ? -0.25 : -0.64;
    } else {
      leftArm.visible = false;
    }
  };

  return { root, weaponAnchor, muzzleFlash, leftArm, rightArm, updateWeapon };
}
