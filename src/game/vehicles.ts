import * as THREE from 'three';
import { groundHeightAt } from './terrain';
import { VehicleSpec, VehicleType } from './types';

export const VEHICLE_SPECS: Record<VehicleType, VehicleSpec> = {
  jeep: {
    type: 'jeep',
    name: 'UAZ Off-Road Jeep',
    maxSpeed: 31,
    acceleration: 18,
    turnSpeed: 2.1,
    maxHp: 1200,
    seatHeight: 1.5,
    bodyColor: 0x3f4a37,
  },
  dacia: {
    type: 'dacia',
    name: 'Dacia 1300 Sedan',
    maxSpeed: 36,
    acceleration: 20,
    turnSpeed: 2.3,
    maxHp: 950,
    seatHeight: 1.25,
    bodyColor: 0xc29838,
  },
  motorcycle: {
    type: 'motorcycle',
    name: 'Tactical Motorcycle',
    maxSpeed: 42,
    acceleration: 27,
    turnSpeed: 2.9,
    maxHp: 600,
    seatHeight: 1.15,
    bodyColor: 0x2a2e33,
  },
  buggy: {
    type: 'buggy',
    name: 'Desert Dune Buggy',
    maxSpeed: 34,
    acceleration: 23,
    turnSpeed: 2.6,
    maxHp: 780,
    seatHeight: 1.2,
    bodyColor: 0xa86b2d,
  },
  pickup: {
    type: 'pickup',
    name: 'Rony Pickup Truck',
    maxSpeed: 30,
    acceleration: 17,
    turnSpeed: 2.0,
    maxHp: 1300,
    seatHeight: 1.55,
    bodyColor: 0x2d4963,
  },
};

export interface VehicleEntity {
  id: string;
  spec: VehicleSpec;
  group: THREE.Group;
  wheels: THREE.Mesh[];
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  hp: number;
  occupiedByPlayer: boolean;
}

function buildVehicleMesh(spec: VehicleSpec): { group: THREE.Group; wheels: THREE.Mesh[] } {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: spec.bodyColor,
    roughness: 0.42,
    metalness: 0.48,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d21,
    roughness: 0.65,
    metalness: 0.35,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x6ea8c7,
    roughness: 0.15,
    metalness: 0.5,
    transparent: true,
    opacity: 0.65,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.88, metalness: 0.08 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: 0xffd275,
    emissiveIntensity: 0.45,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 0.4,
  });

  const addWheel = (wx: number, wy: number, wz: number, radius: number, width: number) => {
    const wMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tireMat);
    wMesh.rotation.z = Math.PI / 2;
    wMesh.position.set(wx, wy, wz);
    wMesh.castShadow = true;
    group.add(wMesh);
    wheels.push(wMesh);
  };

  if (spec.type === 'motorcycle') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.45, 1.75), bodyMat);
    frame.position.set(0, 0.72, 0);
    frame.castShadow = true;
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.65), bodyMat);
    tank.position.set(0, 1.0, -0.22);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.7), trimMat);
    seat.position.set(0, 0.96, 0.35);
    const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), trimMat);
    handlebar.position.set(0, 1.24, -0.58);
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.88, 8), trimMat);
    fork.position.set(0, 0.82, -0.68);
    fork.rotation.x = 0.28;
    const headLight = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), headlightMat);
    headLight.position.set(0, 1.06, -0.82);

    group.add(frame, tank, seat, handlebar, fork, headLight);
    addWheel(0, 0.42, -0.86, 0.42, 0.22);
    addWheel(0, 0.42, 0.86, 0.42, 0.24);
    return { group, wheels };
  }

  // 4-wheeled vehicles (forward is -Z)
  const isBuggy = spec.type === 'buggy';
  const isPickup = spec.type === 'pickup';
  const isJeep = spec.type === 'jeep';

  const chassisW = isBuggy ? 1.85 : 2.1;
  const chassisL = isPickup ? 4.8 : isDaciaLength(spec.type);
  const wheelR = isBuggy || isJeep || isPickup ? 0.48 : 0.4;

  // 1. Lower Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(chassisW, 0.65, chassisL), bodyMat);
  chassis.position.set(0, wheelR + 0.28, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Cabin / Rollcage
  if (isBuggy) {
    const cageL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 1.9), trimMat);
    cageL.position.set(-0.75, wheelR + 0.95, 0.1);
    const cageR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 1.9), trimMat);
    cageR.position.set(0.75, wheelR + 0.95, 0.1);
    const cageTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.6), trimMat);
    cageTop.position.set(0, wheelR + 1.4, 0.1);
    group.add(cageL, cageR, cageTop);
  } else {
    const cabLen = isPickup ? 1.85 : 2.35;
    const cabZ = isPickup ? -0.45 : 0.25;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.88, 0.82, cabLen), bodyMat);
    cabin.position.set(0, wheelR + 0.98, cabZ);
    cabin.castShadow = true;

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.82, 0.64, 0.1), glassMat);
    windshield.position.set(0, wheelR + 0.98, cabZ - cabLen * 0.5);
    windshield.rotation.x = -0.22;

    const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.9, 0.52, cabLen * 0.72), glassMat);
    sideWindow.position.set(0, wheelR + 1.0, cabZ);
    group.add(cabin, windshield, sideWindow);

    if (isPickup) {
      const bedWalls = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.94, 0.45, 1.75), trimMat);
      bedWalls.position.set(0, wheelR + 0.65, 1.45);
      group.add(bedWalls);
    }
  }

  // 3. Bumpers & Lights
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 1.04, 0.22, 0.24), trimMat);
  frontBumper.position.set(0, wheelR + 0.12, -chassisL * 0.51);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 1.04, 0.22, 0.24), trimMat);
  rearBumper.position.set(0, wheelR + 0.12, chassisL * 0.51);

  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), headlightMat);
  hlL.position.set(-chassisW * 0.34, wheelR + 0.42, -chassisL * 0.51);
  const hlR = hlL.clone();
  hlR.position.x = chassisW * 0.34;

  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), taillightMat);
  tlL.position.set(-chassisW * 0.34, wheelR + 0.42, chassisL * 0.51);
  const tlR = tlL.clone();
  tlR.position.x = chassisW * 0.34;

  group.add(frontBumper, rearBumper, hlL, hlR, tlL, tlR);

  // 4. Four Wheels
  const wx = chassisW * 0.52;
  const wz = chassisL * 0.34;
  addWheel(-wx, wheelR, -wz, wheelR, 0.34);
  addWheel(wx, wheelR, -wz, wheelR, 0.34);
  addWheel(-wx, wheelR, wz, wheelR, 0.34);
  addWheel(wx, wheelR, wz, wheelR, 0.34);

  return { group, wheels };
}

function isDaciaLength(type: VehicleType): number {
  if (type === 'buggy') return 3.6;
  if (type === 'jeep') return 4.2;
  return 4.4;
}

export function spawnVehicles(scene: THREE.Scene): VehicleEntity[] {
  const placements: Array<{ type: VehicleType; x: number; z: number; yaw: number }> = [
    { type: 'jeep', x: -12, z: 325, yaw: 0.3 }, // Military Base road
    { type: 'pickup', x: 25, z: 342, yaw: -1.2 }, // Military Base east
    { type: 'dacia', x: -24, z: 5, yaw: 0.1 }, // Pochinki main road
    { type: 'motorcycle', x: 18, z: -42, yaw: 1.5 }, // Pochinki north
    { type: 'buggy', x: -285, z: -195, yaw: -0.6 }, // Airport
    { type: 'jeep', x: -322, z: 95, yaw: 0.8 }, // Harbor
    { type: 'pickup', x: 280, z: 120, yaw: -0.4 }, // Industrial
    { type: 'dacia', x: 48, z: -325, yaw: 2.8 }, // Severny Village
    { type: 'motorcycle', x: 295, z: -225, yaw: -2.1 }, // Yasna Village
    { type: 'buggy', x: -125, z: -125, yaw: 0.7 }, // Mid-West crossroad
    { type: 'dacia', x: 165, z: 220, yaw: -0.3 }, // East bridge approach
    { type: 'motorcycle', x: -30, z: 145, yaw: 0.0 }, // Main bridge north
  ];

  const vehicles: VehicleEntity[] = [];
  placements.forEach((p, idx) => {
    const spec = VEHICLE_SPECS[p.type];
    const { group, wheels } = buildVehicleMesh(spec);
    const y = groundHeightAt(p.x, p.z);
    group.position.set(p.x, y, p.z);
    group.rotation.y = p.yaw;
    scene.add(group);

    vehicles.push({
      id: `veh_${idx}`,
      spec,
      group,
      wheels,
      x: p.x,
      y,
      z: p.z,
      yaw: p.yaw,
      speed: 0,
      hp: spec.maxHp,
      occupiedByPlayer: false,
    });
  });

  return vehicles;
}
