import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from './audio';
import { BotAgent, BotSimulationManager } from './bots';
import { HumanCharacterRig } from './character';
import { getLocationName, groundHeightAt, ISLAND_HALF, WATER_LEVEL, createTerrainMesh } from './terrain';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import {
  AmmoType,
  CHARACTER_SKINS,
  CameraMode,
  GameMode,
  GameSettings,
  HudSnapshot,
  InteractPrompt,
  KillFeedEntry,
  LootItemData,
  MatchPhase,
  MatchStats,
  PlayerInventoryState,
  SafeZoneState,
  WeaponId,
  WeaponInstance,
} from './types';
import { spawnVehicles, VehicleEntity } from './vehicles';
import { createFppViewmodelRig, WEAPON_SPECS } from './weapons';
import { BoxCollider, buildIslandWorld, createLootVisualMesh } from './worldBuilder';

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

interface BulletTracer {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface ActiveGrenade {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
}

interface ExplosionFlash {
  mesh: THREE.Mesh;
  life: number;
}

const ZONE_PHASES = [
  { waitSec: 32, shrinkSec: 38, targetRadius: 340, dmg: 1.8 },
  { waitSec: 26, shrinkSec: 34, targetRadius: 215, dmg: 3.5 },
  { waitSec: 22, shrinkSec: 28, targetRadius: 125, dmg: 6.0 },
  { waitSec: 18, shrinkSec: 24, targetRadius: 65, dmg: 10.0 },
  { waitSec: 14, shrinkSec: 20, targetRadius: 26, dmg: 15.0 },
  { waitSec: 10, shrinkSec: 16, targetRadius: 6, dmg: 22.0 },
];

export class BattleRoyaleEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;

  // Lighting & Sky
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private blueZoneMesh: THREE.Mesh;
  private rainPoints: THREE.Points;
  private cloudGroup: THREE.Group;

  // World & Actors
  private colliders: BoxCollider[] = [];
  private lootItems: LootItemData[] = [];
  private lootMeshes = new Map<string, THREE.Group>();
  private lootGroup!: THREE.Group;
  private vehicles: VehicleEntity[] = [];
  private botsManager: BotSimulationManager;

  // Player Rigs
  private playerRig: HumanCharacterRig;
  private fppRig: ReturnType<typeof createFppViewmodelRig>;
  private airplaneGroup: THREE.Group;

  // FX Pools
  private tracers: BulletTracer[] = [];
  private grenades: ActiveGrenade[] = [];
  private explosions: ExplosionFlash[] = [];

  // Core Loop
  private frameId = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private disposed = false;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;

  // Callbacks & Settings
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private settings: GameSettings;
  private selectedSkinIndex = 0;
  private gameMode: GameMode = 'solo';

  // Input State
  private keys: Record<string, boolean> = {};
  private pointerLocked = false;
  private mouseDownLeft = false;
  private mouseDownRight = false;
  private virtualMoveX = 0;
  private virtualMoveY = 0;
  private virtualFire = false;
  private virtualAds = false;

  // Match & Player State
  private phase: MatchPhase = 'menu';
  private cameraMode: CameraMode = 'TPP';
  private matchTimeSec = 0;
  private timeOfDayHour = 13.5;

  private playerPos = new THREE.Vector3(-12, 10, 48);
  private playerVel = new THREE.Vector3();
  private playerYaw = 0;
  private playerPitch = 0;
  private playerHp = 100;
  private playerMaxHp = 100;
  private playerBoost = 0;
  private playerKills = 0;
  private playerHeadshots = 0;
  private playerDamage = 0;
  private distanceTraveled = 0;
  private eliminatedBy = '';

  private isGrounded = true;
  private isCrouching = false;
  private isSprinting = false;
  private parachuteOpen = false;
  private footstepTimer = 0;
  private muzzleFlashTimer = 0;
  private shootRecoilOffset = 0;
  private hitMarkerTimer = 0;
  private hitMarkerHeadshot = false;
  private damageFlashTimer = 0;
  private damageDirectionRad = 0;

  // Weapon / Heal Timers
  private lastFireTime = 0;
  private isReloading = false;
  private reloadTimer = 0;
  private reloadDuration = 1.8;
  private isHealing = false;
  private healType: 'medkit' | 'firstaid' | 'bandage' | 'energy' | null = null;
  private healTimer = 0;
  private healDuration = 0;

  private activeVehicle: VehicleEntity | null = null;
  private planePos = new THREE.Vector3(-460, 195, -420);
  private planeDir = new THREE.Vector3(0.7, 0, 0.714).normalize();
  private planeProgress = 0;

  private inventory: PlayerInventoryState = this.createEmptyInventory();
  private killFeed: KillFeedEntry[] = [];
  private killFeedCounter = 1;
  private safeZone: SafeZoneState = this.createInitialSafeZone();
  private zonePhaseTimer = ZONE_PHASES[0].waitSec;
  private zoneStartCenterX = 0;
  private zoneStartCenterZ = 0;
  private zoneStartRadius = 560;
  private hudEmitAccum = 0;
  private matchStats: MatchStats | null = null;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    onHudUpdate: (snapshot: HudSnapshot) => void
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.onHudUpdate = onHudUpdate;

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // WebGL Context Loss Safeguards
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    // 3. Scene, Camera & Procedural RoomEnvironment
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x88b4d8);
    this.scene.fog = new THREE.FogExp2(0x88b4d8, 0.0018);

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.12, 1250);
    this.scene.add(this.camera);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 4. Lights
    this.hemiLight = new THREE.HemisphereLight(0xa7d3f5, 0x454f34, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.55);
    this.sunLight.position.set(160, 220, 110);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 520;
    this.sunLight.shadow.camera.left = -95;
    this.sunLight.shadow.camera.right = 95;
    this.sunLight.shadow.camera.top = 95;
    this.sunLight.shadow.camera.bottom = -95;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 5. Procedural Textures & Island World
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    const { terrainMesh, waterMesh } = createTerrainMesh(this.textures.grass);
    this.scene.add(terrainMesh, waterMesh);

    const world = buildIslandWorld(this.textures);
    this.colliders = world.colliders;
    this.lootItems = world.lootItems;
    this.lootMeshes = world.lootMeshes;
    this.lootGroup = world.lootGroup;
    this.scene.add(world.worldGroup);

    // 6. Clouds & Rain Particles
    this.cloudGroup = this.createSkyClouds();
    this.scene.add(this.cloudGroup);
    this.rainPoints = this.createRainSystem();
    this.scene.add(this.rainPoints);

    // 7. Blue Zone Energy Cylinder
    const bzGeo = new THREE.CylinderGeometry(1, 1, 320, 64, 1, true);
    const bzMat = new THREE.MeshBasicMaterial({
      color: 0x2563eb,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.blueZoneMesh = new THREE.Mesh(bzGeo, bzMat);
    this.blueZoneMesh.position.y = 140;
    this.blueZoneMesh.visible = false;
    this.scene.add(this.blueZoneMesh);

    // 8. Vehicles & Bots
    this.vehicles = spawnVehicles(this.scene);
    this.botsManager = new BotSimulationManager(this.scene, this.textures.contactShadow);

    // 9. Player 3D Rig & FPP Viewmodel Rig & Airplane
    this.playerRig = new HumanCharacterRig(CHARACTER_SKINS[this.selectedSkinIndex], this.textures.contactShadow);
    this.scene.add(this.playerRig.root);

    this.fppRig = createFppViewmodelRig(CHARACTER_SKINS[this.selectedSkinIndex].shirtColor);
    this.fppRig.root.visible = false;
    this.camera.add(this.fppRig.root);

    this.airplaneGroup = this.createCargoAirplane();
    this.airplaneGroup.visible = false;
    this.scene.add(this.airplaneGroup);

    // Place player at scenic Pochinki overlook for Main Menu showcase
    const menuY = groundHeightAt(-10, 42);
    this.playerPos.set(-10, menuY, 42);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.setWeapon('m416');
    this.playerRig.setEquipment(2, 2, 2);

    this.applySettings(this.settings);
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.tick();
  }

  private createEmptyInventory(): PlayerInventoryState {
    return {
      weapons: [null, null, { id: 'pistol', ammoInMag: 15 }, 1],
      activeSlot: 2,
      ammo: {
        '7.62mm': 0,
        '5.56mm': 0,
        '.300 Magnum': 0,
        '9mm': 30,
        '.45 ACP': 0,
        '12 Gauge': 0,
        Grenade: 1,
      },
      helmetLevel: 0,
      helmetDurability: 0,
      vestLevel: 0,
      vestDurability: 0,
      backpackLevel: 0,
      medkits: 0,
      firstAids: 0,
      bandages: 2,
      energyDrinks: 1,
    };
  }

  private createInitialSafeZone(): SafeZoneState {
    return {
      phase: 1,
      currentCenterX: 0,
      currentCenterZ: 0,
      currentRadius: 560,
      targetCenterX: (Math.random() - 0.5) * 140,
      targetCenterZ: (Math.random() - 0.5) * 140,
      targetRadius: ZONE_PHASES[0].targetRadius,
      timeRemainingSec: ZONE_PHASES[0].waitSec,
      isShrinking: false,
      damagePerSec: ZONE_PHASES[0].dmg,
      outsideZone: false,
    };
  }

  private createSkyClouds(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 24; i++) {
      const cluster = new THREE.Group();
      const angle = (i / 24) * Math.PI * 2;
      const dist = 220 + (i % 4) * 140;
      cluster.position.set(Math.cos(angle) * dist, 235 + (i % 3) * 18, Math.sin(angle) * dist);
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(22 + j * 4, 1), mat);
        puff.position.set((j - 1.5) * 18, (j % 2) * 5, (j % 3) * 8);
        puff.scale.set(1.6, 0.52, 1.15);
        cluster.add(puff);
      }
      g.add(cluster);
    }
    return g;
  }

  private createRainSystem(): THREE.Points {
    const count = 1600;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 45;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.24,
      transparent: true,
      opacity: 0.65,
    });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    return pts;
  }

  private createCargoAirplane(): THREE.Group {
    const plane = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x4b5548, roughness: 0.5, metalness: 0.45 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.4, metalness: 0.7 });

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.4, 28, 14), hullMat);
    fuselage.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 10), hullMat);
    nose.position.z = -14;
    nose.scale.set(1, 0.9, 1.4);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(36, 0.6, 5.2), hullMat);
    wing.position.set(0, 1.4, -1.5);
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.2, 4.5), hullMat);
    tailFin.position.set(0, 3.8, 12.2);
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(13, 0.45, 2.8), hullMat);
    tailWing.position.set(0, 1.2, 12.4);

    // Four turboprop engines
    for (const ex of [-11, -5.8, 5.8, 11]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.8, 10), darkMat);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(ex, 0.9, -3.5);
      plane.add(eng);
    }

    plane.add(fuselage, nose, wing, tailFin, tailWing);
    return plane;
  }

  public setSelectedSkin(index: number): void {
    this.selectedSkinIndex = THREE.MathUtils.clamp(index, 0, CHARACTER_SKINS.length - 1);
    const skin = CHARACTER_SKINS[this.selectedSkinIndex];
    this.playerRig.applySkin(skin);
    // Update FPP sleeve color
    this.camera.remove(this.fppRig.root);
    this.fppRig = createFppViewmodelRig(skin.shirtColor);
    this.fppRig.root.visible = this.phase === 'combat' && this.cameraMode === 'FPP' && !this.activeVehicle;
    this.camera.add(this.fppRig.root);
    const activeW = this.getActiveWeaponInstance();
    this.fppRig.updateWeapon(activeW ? activeW.id : null);
  }

  public applySettings(newSettings: GameSettings): void {
    this.settings = { ...newSettings };

    // Resolution & Shadow Quality
    const baseDpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(Math.max(0.6, baseDpr * this.settings.resolutionScale));

    const shadowsAllowed = !this.isSoftwareGl && this.settings.shadowQuality !== 'off';
    this.renderer.shadowMap.enabled = shadowsAllowed;
    this.sunLight.castShadow = shadowsAllowed;

    const mapSize =
      this.settings.shadowQuality === 'high' ? 2048 : this.settings.shadowQuality === 'medium' ? 1024 : 512;
    if (this.sunLight.shadow.mapSize.width !== mapSize) {
      this.sunLight.shadow.mapSize.set(mapSize, mapSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }

    // View Distance & Fog
    this.camera.far = Math.max(320, this.settings.viewDistance + 300);
    this.camera.updateProjectionMatrix();

    if (this.settings.weather === 'sunset') this.timeOfDayHour = 17.6;
    else if (this.settings.weather === 'night') this.timeOfDayHour = 22.8;
    else if (this.settings.weather === 'clear') this.timeOfDayHour = 13.5;

    soundEngine.setVolumes(
      this.settings.masterVolume,
      this.settings.sfxVolume,
      this.settings.ambientVolume,
      this.settings.musicVolume
    );
  }

  public startMatch(mode: GameMode): void {
    soundEngine.init();
    soundEngine.stopMenuMusic();
    this.gameMode = mode;
    this.matchTimeSec = 0;
    this.playerHp = 100;
    this.playerBoost = 0;
    this.playerKills = 0;
    this.playerHeadshots = 0;
    this.playerDamage = 0;
    this.distanceTraveled = 0;
    this.eliminatedBy = '';
    this.matchStats = null;
    this.killFeed = [];
    this.activeVehicle = null;
    this.isReloading = false;
    this.isHealing = false;
    this.isCrouching = false;
    this.parachuteOpen = false;
    this.inventory = this.createEmptyInventory();
    this.playerRig.setEquipment(0, 0, 0);
    this.playerRig.setWeapon('pistol');
    this.fppRig.updateWeapon('pistol');

    // Reset loot items & meshes
    for (const item of this.lootItems) {
      item.pickedUp = false;
      const mesh = this.lootMeshes.get(item.uid);
      if (mesh) mesh.visible = true;
    }

    // Reset vehicles
    for (const v of this.vehicles) {
      v.occupiedByPlayer = false;
      v.speed = 0;
      v.hp = v.spec.maxHp;
    }

    // Randomize airplane flight path across island
    const startAngle = Math.random() * Math.PI * 2;
    const dist = 580;
    this.planePos.set(Math.cos(startAngle) * dist, 195, Math.sin(startAngle) * dist);
    const endX = -Math.cos(startAngle) * dist + (Math.random() - 0.5) * 160;
    const endZ = -Math.sin(startAngle) * dist + (Math.random() - 0.5) * 160;
    this.planeDir.set(endX - this.planePos.x, 0, endZ - this.planePos.z).normalize();
    this.planeProgress = 0;
    this.airplaneGroup.visible = true;
    this.airplaneGroup.position.copy(this.planePos);
    this.airplaneGroup.rotation.y = Math.atan2(-this.planeDir.x, -this.planeDir.z);

    // Safe Zone init
    this.safeZone = this.createInitialSafeZone();
    this.zonePhaseTimer = ZONE_PHASES[0].waitSec;
    this.zoneStartCenterX = 0;
    this.zoneStartCenterZ = 0;
    this.zoneStartRadius = 560;
    this.blueZoneMesh.visible = true;

    // Spawn 99 AI Combatants
    this.botsManager.spawnMatchBots(
      mode,
      this.planePos.x,
      this.planePos.z,
      this.planeDir.x,
      this.planeDir.z
    );

    this.phase = 'plane';
    this.playerPos.copy(this.planePos);
    this.playerYaw = Math.atan2(-this.planeDir.x, -this.planeDir.z);
    this.playerPitch = -0.35;
    this.requestPointerLock();
    this.emitHud();
  }

  public returnToMenu(): void {
    this.exitPointerLock();
    this.phase = 'menu';
    this.airplaneGroup.visible = false;
    this.blueZoneMesh.visible = false;
    this.fppRig.root.visible = false;
    this.playerRig.root.visible = true;
    const menuY = groundHeightAt(-10, 42);
    this.playerPos.set(-10, menuY, 42);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.setWeapon('m416');
    this.playerRig.setEquipment(2, 2, 2);
    soundEngine.updateVehicleEngine(false, 0, false);
    this.emitHud();
  }

  public requestPointerLock(): void {
    if (this.settings.mobileControls) return;
    try {
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.renderer.domElement.requestPointerLock?.();
      }
    } catch {
      // Ignore browser gesture rejections
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  public toggleCameraMode(): void {
    this.cameraMode = this.cameraMode === 'TPP' ? 'FPP' : 'TPP';
    this.emitHud();
  }

  public selectWeaponSlot(slot: 0 | 1 | 2 | 3): void {
    if (this.phase !== 'combat') return;
    if (slot < 3 && !this.inventory.weapons[slot]) return;
    if (slot === 3 && this.inventory.weapons[3] <= 0) return;

    this.inventory.activeSlot = slot;
    this.isReloading = false;
    const activeId = slot === 3 ? 'grenade' : this.inventory.weapons[slot]?.id || null;
    this.playerRig.setWeapon(activeId);
    this.fppRig.updateWeapon(activeId);
    soundEngine.playPickup();
    this.emitHud();
  }

  public useConsumable(kind: 'medkit' | 'firstaid' | 'bandage' | 'energy'): void {
    if (this.phase !== 'combat' || this.isHealing) return;
    if (kind === 'medkit' && this.inventory.medkits <= 0) return;
    if (kind === 'firstaid' && this.inventory.firstAids <= 0) return;
    if (kind === 'bandage' && this.inventory.bandages <= 0) return;
    if (kind === 'energy' && this.inventory.energyDrinks <= 0) return;

    this.isHealing = true;
    this.isReloading = false;
    this.healType = kind;
    this.healDuration = kind === 'medkit' ? 4.0 : kind === 'firstaid' ? 3.0 : kind === 'energy' ? 2.2 : 1.6;
    this.healTimer = this.healDuration;
    this.emitHud();
  }

  public pickupItemByUid(uid: string): void {
    const item = this.lootItems.find((l) => l.uid === uid && !l.pickedUp);
    if (!item) return;

    item.pickedUp = true;
    const mesh = this.lootMeshes.get(item.uid);
    if (mesh) mesh.visible = false;
    soundEngine.playPickup();

    if (item.category === 'weapon') {
      const wId = item.itemId as WeaponId;
      const spec = WEAPON_SPECS[wId];
      if (wId === 'grenade') {
        this.inventory.weapons[3] += item.quantity;
        this.inventory.ammo.Grenade += item.quantity;
      } else if (spec.slotGroup === 'sidearm') {
        this.inventory.weapons[2] = { id: wId, ammoInMag: spec.magSize };
      } else {
        if (!this.inventory.weapons[0]) {
          this.inventory.weapons[0] = { id: wId, ammoInMag: spec.magSize };
          this.selectWeaponSlot(0);
        } else if (!this.inventory.weapons[1]) {
          this.inventory.weapons[1] = { id: wId, ammoInMag: spec.magSize };
          this.selectWeaponSlot(1);
        } else {
          const replaceIdx = this.inventory.activeSlot === 1 ? 1 : 0;
          this.inventory.weapons[replaceIdx] = { id: wId, ammoInMag: spec.magSize };
          this.selectWeaponSlot(replaceIdx);
        }
      }
      // Bonus starting ammo in weapon pickup
      if (wId !== 'grenade') {
        this.inventory.ammo[spec.ammoType] += spec.magSize;
      }
    } else if (item.category === 'ammo') {
      const aType = item.itemId as AmmoType;
      this.inventory.ammo[aType] = (this.inventory.ammo[aType] || 0) + item.quantity;
    } else if (item.category === 'helmet') {
      const lvl = item.level || 1;
      if (lvl >= this.inventory.helmetLevel) {
        this.inventory.helmetLevel = lvl;
        this.inventory.helmetDurability = lvl === 3 ? 230 : lvl === 2 ? 150 : 80;
      }
    } else if (item.category === 'vest') {
      const lvl = item.level || 1;
      if (lvl >= this.inventory.vestLevel) {
        this.inventory.vestLevel = lvl;
        this.inventory.vestDurability = lvl === 3 ? 250 : lvl === 2 ? 200 : 140;
      }
    } else if (item.category === 'backpack') {
      const lvl = item.level || 1;
      if (lvl >= this.inventory.backpackLevel) {
        this.inventory.backpackLevel = lvl;
      }
    } else if (item.category === 'med') {
      if (item.itemId === 'medkit') this.inventory.medkits += item.quantity;
      else if (item.itemId === 'firstaid') this.inventory.firstAids += item.quantity;
      else if (item.itemId === 'bandage') this.inventory.bandages += item.quantity;
      else if (item.itemId === 'energy') this.inventory.energyDrinks += item.quantity;
    }

    this.playerRig.setEquipment(
      this.inventory.helmetLevel,
      this.inventory.vestLevel,
      this.inventory.backpackLevel
    );
    this.emitHud();
  }

  // Mobile / Touch API
  public setVirtualMove(x: number, y: number): void {
    this.virtualMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.virtualMoveY = THREE.MathUtils.clamp(y, -1, 1);
  }
  public addVirtualLook(dx: number, dy: number): void {
    const sens = 0.004 * this.settings.mouseSensitivity;
    this.playerYaw -= dx * sens;
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * sens, -1.35, 1.35);
  }
  public setVirtualFire(down: boolean): void {
    this.virtualFire = down;
  }
  public setVirtualAds(down: boolean): void {
    this.virtualAds = down;
  }
  public triggerJump(): void {
    if (this.phase === 'plane') {
      this.jumpFromPlane();
    } else if (this.phase === 'combat' && this.isGrounded && !this.activeVehicle) {
      this.playerVel.y = 7.4;
      this.isGrounded = false;
      this.isCrouching = false;
    }
  }
  public triggerCrouch(): void {
    if (this.phase === 'combat' && !this.activeVehicle) {
      this.isCrouching = !this.isCrouching;
    }
  }
  public triggerReload(): void {
    this.startReload();
  }
  public triggerInteract(): void {
    this.handleInteractAction();
  }
  public triggerPickupNearest(): void {
    this.pickupNearestLoot();
  }

  private getActiveWeaponInstance(): WeaponInstance | null {
    const slot = this.inventory.activeSlot;
    if (slot === 3) {
      return this.inventory.weapons[3] > 0 ? { id: 'grenade', ammoInMag: 1 } : null;
    }
    return this.inventory.weapons[slot];
  }

  private jumpFromPlane(): void {
    if (this.phase !== 'plane') return;
    this.phase = 'parachute';
    this.parachuteOpen = false;
    this.airplaneGroup.visible = false;
    this.playerPos.set(this.planePos.x, this.planePos.y - 4, this.planePos.z);
    this.playerVel.set(this.planeDir.x * 16, -8, this.planeDir.z * 16);
    this.emitHud();
  }

  private openParachute(): void {
    if (this.phase !== 'parachute' || this.parachuteOpen) return;
    this.parachuteOpen = true;
    soundEngine.playPickup();
    this.emitHud();
  }

  private startReload(): void {
    if (this.phase !== 'combat' || this.isReloading || this.activeVehicle) return;
    const w = this.getActiveWeaponInstance();
    if (!w || w.id === 'grenade') return;
    const spec = WEAPON_SPECS[w.id];
    const reserve = this.inventory.ammo[spec.ammoType] || 0;
    if (w.ammoInMag >= spec.magSize || reserve <= 0) return;

    this.isReloading = true;
    this.isHealing = false;
    this.reloadDuration = spec.reloadTimeMs / 1000;
    this.reloadTimer = this.reloadDuration;
    soundEngine.playReload();
  }

  private handleInteractAction(): void {
    if (this.phase === 'plane') {
      this.jumpFromPlane();
      return;
    }
    if (this.phase === 'parachute') {
      this.openParachute();
      return;
    }
    if (this.phase !== 'combat') return;

    if (this.activeVehicle) {
      // Exit vehicle
      const exitX = this.activeVehicle.x + Math.cos(this.activeVehicle.yaw) * 2.4;
      const exitZ = this.activeVehicle.z - Math.sin(this.activeVehicle.yaw) * 2.4;
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle = null;
      this.playerPos.set(exitX, groundHeightAt(exitX, exitZ), exitZ);
      this.playerRig.root.visible = this.cameraMode === 'TPP';
      soundEngine.updateVehicleEngine(false, 0, false);
      this.emitHud();
      return;
    }

    // Check nearest vehicle within 4.5m
    let bestVeh: VehicleEntity | null = null;
    let bestDist = 4.5;
    for (const v of this.vehicles) {
      if (v.hp <= 0) continue;
      const d = Math.hypot(v.x - this.playerPos.x, v.z - this.playerPos.z);
      if (d < bestDist) {
        bestDist = d;
        bestVeh = v;
      }
    }
    if (bestVeh) {
      this.activeVehicle = bestVeh;
      bestVeh.occupiedByPlayer = true;
      this.isReloading = false;
      this.isHealing = false;
      this.playerRig.root.visible = false;
      this.fppRig.root.visible = false;
      soundEngine.playPickup();
      this.emitHud();
      return;
    }

    this.pickupNearestLoot();
  }

  private pickupNearestLoot(): void {
    if (this.phase !== 'combat') return;
    let best: LootItemData | null = null;
    let bestD = 3.2;
    for (const item of this.lootItems) {
      if (item.pickedUp) continue;
      const d = Math.hypot(item.x - this.playerPos.x, item.z - this.playerPos.z);
      if (d < bestD && Math.abs(item.y - this.playerPos.y) < 2.6) {
        bestD = d;
        best = item;
      }
    }
    if (best) {
      this.pickupItemByUid(best.uid);
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked) {
      this.mouseDownLeft = false;
      this.mouseDownRight = false;
    }
    this.emitHud();
  };

  private onContextMenu = (e: MouseEvent): void => {
    if (this.phase === 'combat' || this.phase === 'parachute' || this.phase === 'plane') {
      e.preventDefault();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;
    if (this.phase === 'menu' || this.phase === 'victory' || this.phase === 'defeat') return;

    if (e.code === 'KeyV') {
      this.toggleCameraMode();
    } else if (e.code === 'KeyF') {
      this.handleInteractAction();
    } else if (e.code === 'KeyE') {
      this.pickupNearestLoot();
    } else if (e.code === 'KeyR') {
      this.startReload();
    } else if (e.code === 'KeyC') {
      this.triggerCrouch();
    } else if (e.code === 'Space') {
      if (this.phase === 'plane') {
        this.jumpFromPlane();
      } else if (this.phase === 'combat' && this.isGrounded && !this.activeVehicle) {
        this.playerVel.y = 7.4;
        this.isGrounded = false;
        this.isCrouching = false;
      }
    } else if (e.code === 'Digit1') {
      this.selectWeaponSlot(0);
    } else if (e.code === 'Digit2') {
      this.selectWeaponSlot(1);
    } else if (e.code === 'Digit3') {
      this.selectWeaponSlot(2);
    } else if (e.code === 'Digit4') {
      this.selectWeaponSlot(3);
    } else if (e.code === 'Digit7') {
      this.useConsumable('medkit');
    } else if (e.code === 'Digit8') {
      this.useConsumable('firstaid');
    } else if (e.code === 'Digit9') {
      this.useConsumable('bandage');
    } else if (e.code === 'Digit0') {
      this.useConsumable('energy');
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    if (this.phase === 'menu' || this.phase === 'victory' || this.phase === 'defeat') return;

    const isAds = this.mouseDownRight || this.virtualAds;
    const sens = 0.0021 * this.settings.mouseSensitivity * (isAds ? 0.58 : 1.0);
    this.playerYaw -= e.movementX * sens;
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - e.movementY * sens, -1.35, 1.35);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'combat' && this.phase !== 'parachute' && this.phase !== 'plane') return;
    // Ignore clicks on UI overlays
    if (e.target !== this.renderer.domElement && !this.pointerLocked) return;

    soundEngine.init();
    if (!this.pointerLocked && !this.settings.mobileControls) {
      this.requestPointerLock();
    }

    if (e.button === 0) {
      this.mouseDownLeft = true;
      if (this.phase === 'combat' && !this.activeVehicle) {
        this.tryFireWeapon(true);
      }
    } else if (e.button === 2) {
      this.mouseDownRight = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDownLeft = false;
    else if (e.button === 2) this.mouseDownRight = false;
  };

  private tryFireWeapon(isInitialClick: boolean): void {
    const w = this.getActiveWeaponInstance();
    if (!w) return;
    const spec = WEAPON_SPECS[w.id];
    if (!spec.automatic && !isInitialClick) return;

    const now = performance.now();
    if (now - this.lastFireTime < spec.fireRateMs) return;

    if (w.id === 'grenade') {
      if (this.inventory.weapons[3] <= 0) return;
      this.lastFireTime = now;
      this.inventory.weapons[3]--;
      this.inventory.ammo.Grenade = this.inventory.weapons[3];
      this.throwGrenade();
      if (this.inventory.weapons[3] <= 0) {
        this.selectWeaponSlot(this.inventory.weapons[0] ? 0 : this.inventory.weapons[1] ? 1 : 2);
      }
      return;
    }

    if (w.ammoInMag <= 0) {
      this.startReload();
      return;
    }

    if (this.isReloading) return;
    this.isHealing = false;

    this.lastFireTime = now;
    w.ammoInMag--;
    this.muzzleFlashTimer = 0.055;
    this.shootRecoilOffset = Math.min(0.18, this.shootRecoilOffset + 0.085);
    soundEngine.playGunshot(w.id, 1.0);

    // Apply Recoil to camera pitch/yaw
    const isAds = this.mouseDownRight || this.virtualAds;
    const adsScale = isAds ? 0.72 : 1.0;
    this.playerPitch = THREE.MathUtils.clamp(
      this.playerPitch + spec.recoilVertical * adsScale,
      -1.35,
      1.35
    );
    this.playerYaw += (Math.random() - 0.5) * spec.recoilHorizontal * 2 * adsScale;

    // Fire pellets (1 for rifles/snipers, 8 for shotgun)
    const spread = isAds ? spec.adsSpread : spec.baseSpread * (this.isSprinting ? 1.8 : 1.0);
    const eyeY = this.playerPos.y + (this.isCrouching ? 1.12 : 1.6);

    for (let p = 0; p < spec.pellets; p++) {
      _rayOrigin.set(this.playerPos.x, eyeY, this.playerPos.z);
      _rayDir.set(0, 0, -1);
      _rayDir.applyEuler(new THREE.Euler(this.playerPitch, this.playerYaw, 0, 'YXZ'));
      _rayDir.x += (Math.random() - 0.5) * spread;
      _rayDir.y += (Math.random() - 0.5) * spread;
      _rayDir.z += (Math.random() - 0.5) * spread;
      _rayDir.normalize();

      this.resolveShotRay(_rayOrigin, _rayDir, spec.range, spec.damage, spec.headshotMult, spec.name);
    }

    if (w.ammoInMag === 0) {
      this.startReload();
    }
  }

  private resolveShotRay(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxRange: number,
    baseDamage: number,
    headshotMult: number,
    weaponName: string
  ): void {
    let closestWallDist = maxRange;
    let hitMetal = false;

    // 1. Check Building/Obstacle Colliders (AABB slab test)
    for (const box of this.colliders) {
      const d = this.rayIntersectAABB(origin, dir, box, closestWallDist);
      if (d !== null && d < closestWallDist) {
        closestWallDist = d;
        hitMetal = !!box.isMetal;
      }
    }

    // Check Terrain intersection steps
    for (let t = 8; t < closestWallDist; t += 6) {
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      if (py <= groundHeightAt(px, pz)) {
        closestWallDist = t;
        break;
      }
    }

    // 2. Check Enemy Bot Hitboxes
    let hitBot: BotAgent | null = null;
    let hitDist = closestWallDist;
    let isHeadshot = false;

    const candidates = this.botsManager.getVisibleEnemyRigs();
    for (const { bot } of candidates) {
      const bodyMinY = bot.y;
      const bodyMaxY = bot.y + (bot.crouching ? 1.25 : 1.72);
      const botBox: BoxCollider = {
        minX: bot.x - 0.44,
        maxX: bot.x + 0.44,
        minY: bodyMinY,
        maxY: bodyMaxY,
        minZ: bot.z - 0.44,
        maxZ: bot.z + 0.44,
      };
      const d = this.rayIntersectAABB(origin, dir, botBox, hitDist);
      if (d !== null && d < hitDist) {
        hitDist = d;
        hitBot = bot;
        const hitY = origin.y + dir.y * d;
        isHeadshot = hitY >= bodyMaxY - 0.34;
      }
    }

    // Spawn 3D Tracer Streak
    const endPoint = _vec3A.copy(origin).addScaledVector(dir, hitDist);
    this.spawnTracer(origin, endPoint);

    if (hitBot) {
      const armorMit = isHeadshot ? hitBot.helmetReduction : hitBot.armorReduction;
      const dmg = baseDamage * (isHeadshot ? headshotMult : 1.0) * (1 - armorMit);
      hitBot.hp -= dmg;
      this.playerDamage += Math.round(dmg);
      this.hitMarkerTimer = 0.22;
      this.hitMarkerHeadshot = isHeadshot;
      soundEngine.playHitMarker(isHeadshot);

      if (hitBot.hp <= 0 && hitBot.alive) {
        hitBot.alive = false;
        hitBot.hp = 0;
        if (hitBot.rig) hitBot.rig.root.visible = false;
        this.playerKills++;
        if (isHeadshot) this.playerHeadshots++;
        this.pushKillFeed('You', hitBot.name, weaponName, true, false, isHeadshot);
        this.spawnDeathCrate(hitBot);
      }
    } else if (hitDist < maxRange) {
      soundEngine.playImpact(hitMetal);
    }
  }

  private rayIntersectAABB(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    box: BoxCollider,
    maxDist: number
  ): number | null {
    const invX = dir.x !== 0 ? 1 / dir.x : 1e9;
    const invY = dir.y !== 0 ? 1 / dir.y : 1e9;
    const invZ = dir.z !== 0 ? 1 / dir.z : 1e9;

    const t1 = (box.minX - origin.x) * invX;
    const t2 = (box.maxX - origin.x) * invX;
    const t3 = (box.minY - origin.y) * invY;
    const t4 = (box.maxY - origin.y) * invY;
    const t5 = (box.minZ - origin.z) * invZ;
    const t6 = (box.maxZ - origin.z) * invZ;

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

    if (tmax < 0 || tmin > tmax || tmin > maxDist) return null;
    return Math.max(0, tmin);
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const dist = start.distanceTo(end);
    if (dist < 1) return;
    const len = Math.min(dist, 16);
    const geo = new THREE.BoxGeometry(0.035, 0.035, len);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);

    const mid = _vec3B.copy(start).lerp(end, 0.35);
    mesh.position.copy(mid);
    mesh.lookAt(end);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.09, maxLife: 0.09 });
  }

  private throwGrenade(): void {
    const eyeY = this.playerPos.y + (this.isCrouching ? 1.15 : 1.55);
    const pos = new THREE.Vector3(this.playerPos.x, eyeY, this.playerPos.z);
    const vel = new THREE.Vector3(0, 0, -1)
      .applyEuler(new THREE.Euler(this.playerPitch + 0.18, this.playerYaw, 0, 'YXZ'))
      .multiplyScalar(27);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b4834, roughness: 0.4, metalness: 0.5 })
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.grenades.push({ mesh, pos, vel, fuse: 2.5 });
    soundEngine.playPickup();
  }

  private detonateGrenade(pos: THREE.Vector3): void {
    soundEngine.playExplosion(1.0);
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 })
    );
    flash.position.copy(pos);
    this.scene.add(flash);
    this.explosions.push({ mesh: flash, life: 0.35 });

    // Area damage to bots
    for (const bot of this.botsManager.bots) {
      if (!bot.alive || bot.isTeammate) continue;
      const d = Math.hypot(bot.x - pos.x, bot.z - pos.z);
      if (d < 16) {
        const dmg = 135 * (1 - d / 16);
        bot.hp -= dmg;
        this.playerDamage += Math.round(dmg);
        if (bot.hp <= 0) {
          bot.alive = false;
          bot.hp = 0;
          if (bot.rig) bot.rig.root.visible = false;
          this.playerKills++;
          this.pushKillFeed('You', bot.name, 'Frag Grenade', true, false, false);
          this.spawnDeathCrate(bot);
        }
      }
    }

    // Area damage to player
    const pd = Math.hypot(this.playerPos.x - pos.x, this.playerPos.z - pos.z);
    if (pd < 12) {
      this.applyDamageToPlayer(95 * (1 - pd / 12), pos.x, pos.z, 'Frag Grenade');
    }
  }

  private spawnDeathCrate(bot: BotAgent): void {
    const uid = `crate_${Date.now()}_${bot.id}`;
    const spec = WEAPON_SPECS[bot.weaponId];
    const loot: LootItemData = {
      uid,
      category: 'weapon',
      itemId: bot.weaponId,
      name: `${spec.name} (Crate)`,
      quantity: 1,
      x: bot.x,
      y: bot.y + 0.1,
      z: bot.z,
      pickedUp: false,
    };
    this.lootItems.push(loot);
    const mesh = createLootVisualMesh(loot);
    mesh.position.set(loot.x, loot.y, loot.z);
    this.lootGroup.add(mesh);
    this.lootMeshes.set(uid, mesh);
  }

  private applyDamageToPlayer(rawDmg: number, srcX: number, srcZ: number, attackerName: string): void {
    if (this.phase !== 'combat') return;

    const vestMit = this.inventory.vestLevel === 3 ? 0.45 : this.inventory.vestLevel === 2 ? 0.32 : this.inventory.vestLevel === 1 ? 0.18 : 0;
    const finalDmg = rawDmg * (1 - vestMit);
    this.playerHp = Math.max(0, this.playerHp - finalDmg);
    if (this.inventory.vestDurability > 0) {
      this.inventory.vestDurability = Math.max(0, this.inventory.vestDurability - finalDmg * 0.5);
      if (this.inventory.vestDurability === 0) this.inventory.vestLevel = 0;
    }

    this.damageFlashTimer = 0.35;
    this.damageDirectionRad = Math.atan2(srcX - this.playerPos.x, srcZ - this.playerPos.z) - this.playerYaw;

    if (this.playerHp <= 0) {
      this.eliminatedBy = attackerName;
      this.pushKillFeed(attackerName, 'You', 'Rifle', false, true, false);
      this.endMatch(false);
    }
  }

  private pushKillFeed(
    killer: string,
    victim: string,
    weapon: string,
    isPlayerKiller: boolean,
    isPlayerVictim: boolean,
    headshot: boolean
  ): void {
    this.killFeed.unshift({
      id: this.killFeedCounter++,
      killer,
      victim,
      weapon,
      isPlayerKiller,
      isPlayerVictim,
      headshot,
      timestamp: this.matchTimeSec,
    });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  private endMatch(victory: boolean): void {
    this.exitPointerLock();
    soundEngine.updateVehicleEngine(false, 0, false);
    const aliveEnemies = this.botsManager.getEnemyAliveCount();
    const rank = victory ? 1 : Math.max(2, aliveEnemies + 1);
    this.matchStats = {
      rank,
      totalPlayers: 100,
      kills: this.playerKills,
      headshots: this.playerHeadshots,
      damageDealt: this.playerDamage,
      survivalTimeSec: Math.round(this.matchTimeSec),
      distanceMeters: Math.round(this.distanceTraveled),
      mode: this.gameMode,
      eliminatedBy: victory ? undefined : this.eliminatedBy || 'Hostile Fire',
    };
    this.phase = victory ? 'victory' : 'defeat';
    this.emitHud();
  }

  private resolveHorizontalCollisions(x: number, y: number, z: number, radius: number): { x: number; z: number } {
    let rx = THREE.MathUtils.clamp(x, -ISLAND_HALF + 20, ISLAND_HALF - 20);
    let rz = THREE.MathUtils.clamp(z, -ISLAND_HALF + 20, ISLAND_HALF - 20);

    for (const c of this.colliders) {
      if (y + 1.65 < c.minY || y + 0.25 > c.maxY) continue;
      const closestX = THREE.MathUtils.clamp(rx, c.minX, c.maxX);
      const closestZ = THREE.MathUtils.clamp(rz, c.minZ, c.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          // Inside box center fallback
          rx += radius;
        }
      }
    }
    return { x: rx, z: rz };
  }

  private updateAtmosphere(dt: number): void {
    if (this.settings.dayNightCycle && this.phase !== 'menu') {
      this.timeOfDayHour = (this.timeOfDayHour + dt * 0.08) % 24;
    }

    const hour = this.timeOfDayHour;
    const sunAngle = ((hour - 6) / 12) * Math.PI;
    const sunHeight = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 260;
    const sunY = Math.max(18, sunHeight * 240);
    this.sunLight.position.set(this.playerPos.x + sunX, sunY, this.playerPos.z + 110);
    this.sunLight.target.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);

    let skyHex = 0x88b4d8;
    let sunIntensity = 1.5;
    let hemiIntensity = 0.72;
    let fogDensity = 0.0016;

    if (this.settings.weather === 'sunset' || (hour > 16.8 && hour < 19.2)) {
      skyHex = 0xd98254;
      sunIntensity = 1.25;
      this.sunLight.color.setHex(0xffb074);
      fogDensity = 0.0021;
    } else if (this.settings.weather === 'night' || hour < 5.5 || hour > 19.5) {
      skyHex = 0x0f172a;
      sunIntensity = 0.42;
      hemiIntensity = 0.35;
      this.sunLight.color.setHex(0x8aa8d6);
      fogDensity = 0.0028;
    } else if (this.settings.weather === 'overcast') {
      skyHex = 0x94a3b8;
      sunIntensity = 0.95;
      fogDensity = 0.0034;
      this.sunLight.color.setHex(0xe2e8f0);
    } else if (this.settings.weather === 'rain') {
      skyHex = 0x566475;
      sunIntensity = 0.75;
      hemiIntensity = 0.55;
      fogDensity = 0.0042;
      this.sunLight.color.setHex(0xcbd5e1);
    } else {
      this.sunLight.color.setHex(0xfff1d6);
    }

    // Scale fog gently by user viewDistance setting
    const viewScale = 620 / Math.max(280, this.settings.viewDistance);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.setHex(skyHex);
    fog.density = fogDensity * viewScale;
    (this.scene.background as THREE.Color).setHex(skyHex);
    this.sunLight.intensity = sunIntensity;
    this.hemiLight.intensity = hemiIntensity;

    // Rain particle update
    const isRain = this.settings.weather === 'rain';
    this.rainPoints.visible = isRain;
    if (isRain) {
      this.rainPoints.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      const posAttr = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - 42 * dt;
        if (y < -4) y = 40;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }

    this.cloudGroup.rotation.y += dt * 0.004;
    const skySpeed = this.phase === 'parachute' ? Math.abs(this.playerVel.y) : 0;
    soundEngine.updateAmbience(isRain, skySpeed);
  }

  private updateSafeZone(dt: number): void {
    const phaseSpec = ZONE_PHASES[Math.min(this.safeZone.phase - 1, ZONE_PHASES.length - 1)];
    this.zonePhaseTimer -= dt;

    if (!this.safeZone.isShrinking) {
      if (this.zonePhaseTimer <= 0) {
        this.safeZone.isShrinking = true;
        this.zonePhaseTimer = phaseSpec.shrinkSec;
        this.zoneStartCenterX = this.safeZone.currentCenterX;
        this.zoneStartCenterZ = this.safeZone.currentCenterZ;
        this.zoneStartRadius = this.safeZone.currentRadius;
      }
    } else {
      const progress = 1 - Math.max(0, this.zonePhaseTimer) / phaseSpec.shrinkSec;
      this.safeZone.currentCenterX = THREE.MathUtils.lerp(
        this.zoneStartCenterX,
        this.safeZone.targetCenterX,
        progress
      );
      this.safeZone.currentCenterZ = THREE.MathUtils.lerp(
        this.zoneStartCenterZ,
        this.safeZone.targetCenterZ,
        progress
      );
      this.safeZone.currentRadius = THREE.MathUtils.lerp(
        this.zoneStartRadius,
        this.safeZone.targetRadius,
        progress
      );

      if (this.zonePhaseTimer <= 0) {
        this.safeZone.isShrinking = false;
        if (this.safeZone.phase < ZONE_PHASES.length) {
          this.safeZone.phase++;
          const next = ZONE_PHASES[this.safeZone.phase - 1];
          this.zonePhaseTimer = next.waitSec;
          this.safeZone.damagePerSec = next.dmg;
          const shiftAngle = Math.random() * Math.PI * 2;
          const maxShift = Math.max(0, this.safeZone.currentRadius - next.targetRadius) * 0.55;
          this.safeZone.targetCenterX = this.safeZone.currentCenterX + Math.cos(shiftAngle) * maxShift;
          this.safeZone.targetCenterZ = this.safeZone.currentCenterZ + Math.sin(shiftAngle) * maxShift;
          this.safeZone.targetRadius = next.targetRadius;
        } else {
          this.zonePhaseTimer = 999;
        }
      }
    }

    this.safeZone.timeRemainingSec = Math.max(0, Math.ceil(this.zonePhaseTimer));
    this.blueZoneMesh.position.set(this.safeZone.currentCenterX, 140, this.safeZone.currentCenterZ);
    this.blueZoneMesh.scale.set(this.safeZone.currentRadius, 1, this.safeZone.currentRadius);

    const dist = Math.hypot(
      this.playerPos.x - this.safeZone.currentCenterX,
      this.playerPos.z - this.safeZone.currentCenterZ
    );
    this.safeZone.outsideZone = dist > this.safeZone.currentRadius;
    if (this.safeZone.outsideZone && this.phase === 'combat') {
      this.playerHp -= this.safeZone.damagePerSec * dt;
      if (this.playerHp <= 0) {
        this.playerHp = 0;
        this.eliminatedBy = 'Blue Zone';
        this.endMatch(false);
      }
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsed += dt;

    // FPS Measurement
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.updateAtmosphere(dt);

    if (this.phase === 'menu') {
      // Showcase rotating camera around character
      const orbitAngle = this.elapsed * 0.28;
      this.playerRig.root.rotation.y = Math.sin(this.elapsed * 0.4) * 0.35;
      this.playerRig.updateAnimation({
        moveSpeed: 0,
        isSprinting: false,
        isCrouching: false,
        isAirborne: false,
        isParachuting: false,
        isSkydiving: false,
        isAds: false,
        shootRecoil: 0,
        reloadProgress: 0,
        time: this.elapsed,
        pitch: 0,
      });
      this.camera.position.set(
        this.playerPos.x + Math.sin(orbitAngle) * 3.4,
        this.playerPos.y + 1.65,
        this.playerPos.z + Math.cos(orbitAngle) * 3.4
      );
      this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.15, this.playerPos.z);
    } else if (this.phase === 'plane' || this.phase === 'parachute' || this.phase === 'combat') {
      this.matchTimeSec += dt;
      this.updateMatchFrame(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateMatchFrame(dt: number): void {
    this.updateSafeZone(dt);

    // Update FX pools
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        (tr.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vel.y -= 18 * dt;
      g.pos.addScaledVector(g.vel, dt);
      const gy = groundHeightAt(g.pos.x, g.pos.z) + 0.14;
      if (g.pos.y <= gy) {
        g.pos.y = gy;
        g.vel.y = Math.abs(g.vel.y) * 0.42;
        g.vel.x *= 0.65;
        g.vel.z *= 0.65;
      }
      g.mesh.position.copy(g.pos);
      if (g.fuse <= 0) {
        this.scene.remove(g.mesh);
        this.detonateGrenade(g.pos);
        this.grenades.splice(i, 1);
      }
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      ex.mesh.scale.addScalar(dt * 26);
      (ex.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ex.life * 2.5);
      if (ex.life <= 0) {
        this.scene.remove(ex.mesh);
        this.explosions.splice(i, 1);
      }
    }

    // Decay HUD timers
    if (this.hitMarkerTimer > 0) this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    if (this.damageFlashTimer > 0) this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    if (this.shootRecoilOffset > 0) this.shootRecoilOffset = Math.max(0, this.shootRecoilOffset - dt * 0.65);

    // Energy Boost Regen
    if (this.playerBoost > 0 && this.phase === 'combat') {
      this.playerBoost = Math.max(0, this.playerBoost - dt * 1.4);
      if (this.playerHp < 100) {
        this.playerHp = Math.min(100, this.playerHp + dt * 2.4);
      }
    }

    // Movement Inputs
    const moveF = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0) + this.virtualMoveY;
    const moveR = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0) + this.virtualMoveX;

    // 1. PLANE PHASE
    if (this.phase === 'plane') {
      this.planeProgress += dt * 48;
      this.planePos.addScaledVector(this.planeDir, 48 * dt);
      this.airplaneGroup.position.copy(this.planePos);
      this.playerPos.copy(this.planePos);
      this.playerRig.root.visible = false;
      this.fppRig.root.visible = false;

      // Orbit chase camera behind cargo plane
      const camDist = 32;
      _vec3A.set(0, 0, camDist).applyEuler(new THREE.Euler(this.playerPitch, this.playerYaw, 0, 'YXZ'));
      this.camera.position.copy(this.planePos).add(_vec3A).add(_vec3B.set(0, 6, 0));
      this.camera.lookAt(this.planePos);

      if (this.planeProgress > 1100) {
        this.jumpFromPlane();
      }
    }
    // 2. PARACHUTE / SKYDIVE PHASE
    else if (this.phase === 'parachute') {
      const groundY = groundHeightAt(this.playerPos.x, this.playerPos.z);
      const agl = this.playerPos.y - groundY;

      if (!this.parachuteOpen && agl < 35) {
        this.openParachute();
      }

      const fwdX = -Math.sin(this.playerYaw);
      const fwdZ = -Math.cos(this.playerYaw);
      const rightX = Math.cos(this.playerYaw);
      const rightZ = -Math.sin(this.playerYaw);

      if (!this.parachuteOpen) {
        // Skydiving physics
        const diveSpeed = moveF > 0.2 ? 36 : 22;
        const horizSpeed = moveF > 0.2 ? 26 : 14;
        this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, (fwdX * moveF + rightX * moveR) * horizSpeed, 3.5, dt);
        this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, (fwdZ * moveF + rightZ * moveR) * horizSpeed, 3.5, dt);
        this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, -diveSpeed, 3.0, dt);
      } else {
        // Parachute canopy glide
        const glideSpeed = 16;
        this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, (fwdX * moveF + rightX * moveR) * glideSpeed, 4.0, dt);
        this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, (fwdZ * moveF + rightZ * moveR) * glideSpeed, 4.0, dt);
        this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, -7.8, 5.0, dt);
      }

      this.playerPos.addScaledVector(this.playerVel, dt);
      this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -ISLAND_HALF + 30, ISLAND_HALF - 30);
      this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -ISLAND_HALF + 30, ISLAND_HALF - 30);

      if (this.playerPos.y <= groundHeightAt(this.playerPos.x, this.playerPos.z)) {
        this.playerPos.y = groundHeightAt(this.playerPos.x, this.playerPos.z);
        this.playerVel.set(0, 0, 0);
        this.parachuteOpen = false;
        this.isGrounded = true;
        this.phase = 'combat';
      }

      this.playerRig.root.visible = true;
      this.fppRig.root.visible = false;
      this.playerRig.root.position.copy(this.playerPos);
      this.playerRig.root.rotation.y = this.playerYaw;
      this.playerRig.updateAnimation({
        moveSpeed: 0,
        isSprinting: false,
        isCrouching: false,
        isAirborne: true,
        isParachuting: this.parachuteOpen,
        isSkydiving: !this.parachuteOpen,
        isAds: false,
        shootRecoil: 0,
        reloadProgress: 0,
        time: this.elapsed,
        pitch: this.playerPitch,
      });

      const camDist = this.parachuteOpen ? 6.5 : 5.2;
      _vec3A.set(0, 0, camDist).applyEuler(new THREE.Euler(this.playerPitch, this.playerYaw, 0, 'YXZ'));
      this.camera.position.copy(this.playerPos).add(_vec3B.set(0, 1.5, 0)).add(_vec3A);
      this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z);
    }
    // 3. COMBAT PHASE (ON FOOT OR DRIVING VEHICLE)
    else if (this.phase === 'combat') {
      if (this.activeVehicle) {
        this.updateVehicleDriving(dt, moveF, moveR);
      } else {
        this.updateFootCombat(dt, moveF, moveR);
      }
    }

    // Update AI Bots
    this.botsManager.update(
      dt,
      this.elapsed,
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z,
      this.phase === 'combat' || this.phase === 'parachute',
      this.phase === 'plane',
      this.safeZone,
      this.settings.viewDistance,
      (bot, dist) => {
        if (this.phase !== 'combat') return;
        const spec = WEAPON_SPECS[bot.weaponId];
        soundEngine.playGunshot(bot.weaponId, Math.max(0.08, 1 - dist / 140));
        // Bot shot accuracy scales with distance & cover
        const hitChance = THREE.MathUtils.clamp(0.46 - dist * 0.0042 - (this.isCrouching ? 0.08 : 0), 0.06, 0.45);
        if (Math.random() < hitChance) {
          this.applyDamageToPlayer(spec.damage * 0.42, bot.x, bot.z, bot.name);
        }
        // Spawn visual enemy tracer
        const start = _vec3A.set(bot.x, bot.y + 1.45, bot.z);
        const end = _vec3B.set(
          this.playerPos.x + (Math.random() - 0.5) * 1.4,
          this.playerPos.y + 1.2 + (Math.random() - 0.5) * 0.8,
          this.playerPos.z + (Math.random() - 0.5) * 1.4
        );
        this.spawnTracer(start, end);
      },
      (killer, victim, weapon, hs) => {
        this.pushKillFeed(killer, victim, weapon, false, false, hs);
      }
    );

    // Check Victory Condition
    if (
      (this.phase === 'combat' || this.phase === 'parachute') &&
      this.botsManager.getEnemyAliveCount() === 0
    ) {
      this.endMatch(true);
    }

    // Periodic HUD Sync (~20Hz smooth React state updates)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateVehicleDriving(dt: number, throttle: number, steer: number): void {
    const v = this.activeVehicle!;
    const spec = v.spec;

    if (Math.abs(throttle) > 0.05) {
      v.speed = THREE.MathUtils.clamp(
        v.speed + throttle * spec.acceleration * dt,
        -spec.maxSpeed * 0.4,
        spec.maxSpeed
      );
    } else {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 2.2, dt);
    }

    if (Math.abs(v.speed) > 0.4) {
      const steerDir = v.speed >= 0 ? -1 : 1;
      v.yaw += steer * steerDir * spec.turnSpeed * Math.min(1, Math.abs(v.speed) / 8) * dt;
    }

    const nextX = v.x - Math.sin(v.yaw) * v.speed * dt;
    const nextZ = v.z - Math.cos(v.yaw) * v.speed * dt;
    const resolved = this.resolveHorizontalCollisions(nextX, v.y, nextZ, 1.55);

    if (Math.hypot(resolved.x - nextX, resolved.z - nextZ) > 0.15) {
      v.speed *= 0.35; // Bump slowdown
    }

    this.distanceTraveled += Math.hypot(resolved.x - v.x, resolved.z - v.z);
    v.x = resolved.x;
    v.z = resolved.z;
    v.y = Math.max(WATER_LEVEL - 0.3, groundHeightAt(v.x, v.z));

    v.group.position.set(v.x, v.y, v.z);
    v.group.rotation.y = v.yaw;

    // Spin wheels
    for (const w of v.wheels) {
      w.rotation.x -= v.speed * dt * 2.2;
    }

    this.playerPos.set(v.x, v.y + spec.seatHeight, v.z);
    soundEngine.updateVehicleEngine(true, v.speed / spec.maxSpeed, spec.type === 'motorcycle');

    // Third-person driving chase camera
    const targetFov = 74 + Math.min(12, Math.abs(v.speed) * 0.35);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();

    const chaseYaw = this.playerYaw;
    _vec3A.set(0, 0, 7.2).applyEuler(new THREE.Euler(THREE.MathUtils.clamp(this.playerPitch, -0.5, 0.35), chaseYaw, 0, 'YXZ'));
    _vec3B.set(v.x, v.y + 2.3, v.z).add(_vec3A);
    _vec3B.y = Math.max(groundHeightAt(_vec3B.x, _vec3B.z) + 0.8, _vec3B.y);
    this.camera.position.lerp(_vec3B, 1 - Math.exp(-12 * dt));
    this.camera.lookAt(v.x, v.y + 1.4, v.z);
  }

  private updateFootCombat(dt: number, moveF: number, moveR: number): void {
    // Reload Timer
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const w = this.getActiveWeaponInstance();
        if (w && w.id !== 'grenade') {
          const spec = WEAPON_SPECS[w.id];
          const needed = spec.magSize - w.ammoInMag;
          const avail = this.inventory.ammo[spec.ammoType] || 0;
          const take = Math.min(needed, avail);
          w.ammoInMag += take;
          this.inventory.ammo[spec.ammoType] -= take;
        }
      }
    }

    // Healing Timer
    if (this.isHealing) {
      this.healTimer -= dt;
      if (this.healTimer <= 0 && this.healType) {
        if (this.healType === 'medkit' && this.inventory.medkits > 0) {
          this.inventory.medkits--;
          this.playerHp = 100;
        } else if (this.healType === 'firstaid' && this.inventory.firstAids > 0) {
          this.inventory.firstAids--;
          this.playerHp = Math.min(100, Math.max(this.playerHp, 75));
        } else if (this.healType === 'bandage' && this.inventory.bandages > 0) {
          this.inventory.bandages--;
          this.playerHp = Math.min(75, this.playerHp + 15);
        } else if (this.healType === 'energy' && this.inventory.energyDrinks > 0) {
          this.inventory.energyDrinks--;
          this.playerBoost = Math.min(100, this.playerBoost + 45);
        }
        this.isHealing = false;
        this.healType = null;
      }
    }

    // Firing (auto weapons held down)
    if (this.mouseDownLeft || this.virtualFire) {
      this.tryFireWeapon(false);
    }

    const isAds = this.mouseDownRight || this.virtualAds;
    const wantsSprint = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && moveF > 0.2 && !isAds && !this.isCrouching;
    this.isSprinting = wantsSprint;

    const len = Math.hypot(moveF, moveR);
    const normF = len > 1 ? moveF / len : moveF;
    const normR = len > 1 ? moveR / len : moveR;

    const baseSpeed = this.isCrouching ? 3.2 : wantsSprint ? 8.2 : isAds ? 3.6 : 5.4;
    const waterSlow = this.playerPos.y < WATER_LEVEL - 0.35 ? 0.58 : 1.0;
    const moveSpeed = baseSpeed * waterSlow;

    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);
    const rightX = Math.cos(this.playerYaw);
    const rightZ = -Math.sin(this.playerYaw);

    const targetVx = (fwdX * normF + rightX * normR) * moveSpeed;
    const targetVz = (fwdZ * normF + rightZ * normR) * moveSpeed;
    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, 14, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, 14, dt);

    // Gravity & Grounding
    this.playerVel.y -= 21 * dt;
    const prevX = this.playerPos.x;
    const prevZ = this.playerPos.z;
    const nextX = prevX + this.playerVel.x * dt;
    const nextZ = prevZ + this.playerVel.z * dt;
    const resolved = this.resolveHorizontalCollisions(nextX, this.playerPos.y, nextZ, 0.42);

    this.playerPos.x = resolved.x;
    this.playerPos.z = resolved.z;
    this.playerPos.y += this.playerVel.y * dt;

    const floorY = Math.max(WATER_LEVEL - 0.9, groundHeightAt(this.playerPos.x, this.playerPos.z));
    if (this.playerPos.y <= floorY) {
      this.playerPos.y = floorY;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    const stepDist = Math.hypot(this.playerPos.x - prevX, this.playerPos.z - prevZ);
    this.distanceTraveled += stepDist;

    // Footstep Audio
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.isGrounded && horizSpeed > 1.2) {
      this.footstepTimer -= dt * (wantsSprint ? 1.5 : 1.0);
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.42;
        soundEngine.playFootstep(wantsSprint, false);
      }
    }

    // Update 3D Character Rig
    const activeW = this.getActiveWeaponInstance();
    this.playerRig.setWeapon(activeW ? activeW.id : null);
    this.fppRig.updateWeapon(activeW ? activeW.id : null);

    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;
    const reloadProg = this.isReloading ? 1 - this.reloadTimer / this.reloadDuration : 0;

    this.playerRig.updateAnimation({
      moveSpeed: horizSpeed / 5.4,
      isSprinting: wantsSprint,
      isCrouching: this.isCrouching,
      isAirborne: !this.isGrounded,
      isParachuting: false,
      isSkydiving: false,
      isAds,
      shootRecoil: this.shootRecoilOffset * 8,
      reloadProgress: reloadProg,
      time: this.elapsed,
      pitch: this.playerPitch,
    });

    // Camera FOV Transition (Sprint widen vs ADS zoom)
    const spec = activeW ? WEAPON_SPECS[activeW.id] : null;
    const targetFov = isAds && spec ? spec.adsFov : wantsSprint ? 77 : 70;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
    this.camera.updateProjectionMatrix();

    const eyeHeight = this.isCrouching ? 1.12 : 1.62;

    if (this.cameraMode === 'FPP') {
      this.playerRig.root.visible = false;
      this.fppRig.root.visible = true;

      this.camera.position.set(this.playerPos.x, this.playerPos.y + eyeHeight, this.playerPos.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.playerYaw;
      this.camera.rotation.x = this.playerPitch;
      this.camera.rotation.z = 0;

      // Animate FPP Viewmodel Anchor (ADS centering, walk sway, recoil kick, reload dip)
      const targetX = isAds ? 0.0 : 0.22;
      const targetY = isAds ? -0.145 : -0.21 - Math.sin(reloadProg * Math.PI) * 0.18;
      const targetZ = isAds ? -0.34 : -0.44 + this.shootRecoilOffset * 0.45;
      const swayX = horizSpeed > 0.4 ? Math.cos(this.elapsed * 9) * (isAds ? 0.002 : 0.01) : 0;
      const swayY = horizSpeed > 0.4 ? Math.abs(Math.sin(this.elapsed * 9)) * (isAds ? 0.002 : 0.012) : 0;

      this.fppRig.weaponAnchor.position.x = THREE.MathUtils.damp(this.fppRig.weaponAnchor.position.x, targetX + swayX, 16, dt);
      this.fppRig.weaponAnchor.position.y = THREE.MathUtils.damp(this.fppRig.weaponAnchor.position.y, targetY + swayY, 16, dt);
      this.fppRig.weaponAnchor.position.z = THREE.MathUtils.damp(this.fppRig.weaponAnchor.position.z, targetZ, 22, dt);
      this.fppRig.weaponAnchor.rotation.x = this.shootRecoilOffset * 0.9 - Math.sin(reloadProg * Math.PI) * 0.45;
      this.fppRig.muzzleFlash.visible = this.muzzleFlashTimer > 0;
      this.fppRig.muzzleFlash.rotation.z += dt * 40;
    } else {
      // TPP Camera (Over-the-right-shoulder with smooth damping & wall collision pull-in)
      this.playerRig.root.visible = true;
      this.fppRig.root.visible = false;

      const camDist = isAds ? 1.85 : 3.4;
      const shoulderOffset = isAds ? 0.52 : 0.62;
      const pivot = _vec3C.set(this.playerPos.x, this.playerPos.y + eyeHeight + 0.1, this.playerPos.z);

      _vec3A.set(shoulderOffset, 0.15, camDist).applyEuler(new THREE.Euler(this.playerPitch, this.playerYaw, 0, 'YXZ'));
      const desiredCam = _vec3B.copy(pivot).add(_vec3A);

      // Raycheck against building walls so TPP camera never clips inside a wall
      const dirToCam = desiredCam.clone().sub(pivot);
      const maxD = dirToCam.length();
      dirToCam.normalize();
      let safeD = maxD;
      for (const c of this.colliders) {
        const hitD = this.rayIntersectAABB(pivot, dirToCam, c, safeD);
        if (hitD !== null && hitD < safeD) {
          safeD = Math.max(0.45, hitD - 0.25);
        }
      }
      desiredCam.copy(pivot).addScaledVector(dirToCam, safeD);
      desiredCam.y = Math.max(groundHeightAt(desiredCam.x, desiredCam.z) + 0.35, desiredCam.y);

      this.camera.position.lerp(desiredCam, 1 - Math.exp(-18 * dt));
      const lookTarget = pivot.clone().addScaledVector(
        new THREE.Vector3(0, 0, -10).applyEuler(new THREE.Euler(this.playerPitch, this.playerYaw, 0, 'YXZ')),
        1
      );
      this.camera.lookAt(lookTarget);
    }
  }

  private getNearbyLootAndPrompt(): { nearbyLoot: LootItemData[]; interactPrompt: InteractPrompt | null } {
    if (this.phase === 'plane') {
      return {
        nearbyLoot: [],
        interactPrompt: {
          type: 'plane',
          label: 'Jump from Transport Plane',
          subLabel: getLocationName(this.planePos.x, this.planePos.z),
          keyHint: 'F / Space',
        },
      };
    }

    if (this.phase === 'parachute') {
      return {
        nearbyLoot: [],
        interactPrompt: this.parachuteOpen
          ? null
          : {
              type: 'parachute',
              label: 'Deploy Parachute',
              subLabel: 'Auto-deploys at 35m',
              keyHint: 'F',
            },
      };
    }

    if (this.activeVehicle) {
      return {
        nearbyLoot: [],
        interactPrompt: {
          type: 'vehicle',
          label: `Exit ${this.activeVehicle.spec.name}`,
          keyHint: 'F',
        },
      };
    }

    // Check nearby vehicles first
    for (const v of this.vehicles) {
      if (v.hp <= 0) continue;
      if (Math.hypot(v.x - this.playerPos.x, v.z - this.playerPos.z) < 4.5) {
        return {
          nearbyLoot: this.findNearbyLoot(),
          interactPrompt: {
            type: 'vehicle',
            label: `Drive ${v.spec.name}`,
            keyHint: 'F',
          },
        };
      }
    }

    const nearbyLoot = this.findNearbyLoot();
    const interactPrompt: InteractPrompt | null =
      nearbyLoot.length > 0
        ? {
            type: 'loot',
            label: `Pick up ${nearbyLoot[0].name}`,
            subLabel: nearbyLoot[0].quantity > 1 ? `x${nearbyLoot[0].quantity}` : undefined,
            keyHint: 'E',
          }
        : null;

    return { nearbyLoot, interactPrompt };
  }

  private findNearbyLoot(): LootItemData[] {
    const out: Array<{ item: LootItemData; d: number }> = [];
    for (const item of this.lootItems) {
      if (item.pickedUp) continue;
      const d = Math.hypot(item.x - this.playerPos.x, item.z - this.playerPos.z);
      if (d < 3.4 && Math.abs(item.y - this.playerPos.y) < 2.6) {
        out.push({ item, d });
      }
    }
    out.sort((a, b) => a.d - b.d);
    return out.map((o) => o.item);
  }

  private emitHud(): void {
    const { nearbyLoot, interactPrompt } = this.getNearbyLootAndPrompt();
    const groundY = groundHeightAt(this.playerPos.x, this.playerPos.z);
    const activeW = this.getActiveWeaponInstance();
    const spec = activeW ? WEAPON_SPECS[activeW.id] : null;
    const isAds = this.mouseDownRight || this.virtualAds;
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);

    const healLabelMap = {
      medkit: 'Using Med Kit',
      firstaid: 'Using First Aid Kit',
      bandage: 'Applying Bandage',
      energy: 'Drinking Energy Drink',
    };

    const snapshot: HudSnapshot = {
      phase: this.phase,
      cameraMode: this.cameraMode,
      hp: Math.ceil(this.playerHp),
      maxHp: this.playerMaxHp,
      boost: Math.round(this.playerBoost),
      aliveCount: this.botsManager.getAliveCount(this.phase !== 'defeat'),
      kills: this.playerKills,
      damageDealt: this.playerDamage,
      matchTimeSec: Math.floor(this.matchTimeSec),
      fps: this.currentFps,
      isAds,
      isCrouching: this.isCrouching,
      isSprinting: this.isSprinting,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - this.reloadTimer / this.reloadDuration : 0,
      isHealing: this.isHealing,
      healLabel: this.healType ? healLabelMap[this.healType] : '',
      healProgress: this.isHealing && this.healDuration > 0 ? 1 - this.healTimer / this.healDuration : 0,
      inVehicle: !!this.activeVehicle,
      vehicleName: this.activeVehicle ? this.activeVehicle.spec.name : '',
      vehicleSpeedKmh: this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 3.6) : 0,
      vehicleHp: this.activeVehicle ? Math.round(this.activeVehicle.hp) : 0,
      vehicleMaxHp: this.activeVehicle ? this.activeVehicle.spec.maxHp : 100,
      altitudeMeters: Math.max(0, Math.round(this.playerPos.y - groundY)),
      fallSpeedKmh: Math.round(Math.abs(this.playerVel.y) * 3.6),
      crosshairSpread:
        (spec ? (isAds ? spec.adsSpread : spec.baseSpread) : 0.02) * 1400 +
        horizSpeed * 2.2 +
        this.shootRecoilOffset * 120,
      hitMarkerTimer: this.hitMarkerTimer,
      hitMarkerHeadshot: this.hitMarkerHeadshot,
      damageFlashTimer: this.damageFlashTimer,
      damageDirectionRad: this.damageDirectionRad,
      pointerLocked: this.pointerLocked,
      timeOfDayHour: this.timeOfDayHour,
      weather: this.settings.weather,
      currentLocationName: getLocationName(this.playerPos.x, this.playerPos.z),
      inventory: {
        ...this.inventory,
        weapons: [...this.inventory.weapons] as PlayerInventoryState['weapons'],
        ammo: { ...this.inventory.ammo },
      },
      nearbyLoot,
      interactPrompt,
      safeZone: { ...this.safeZone },
      killFeed: [...this.killFeed],
      teammates: this.botsManager.getTeammateSnapshots(),
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerYaw: this.playerYaw,
      planePos: {
        x: this.planePos.x,
        z: this.planePos.z,
        yaw: Math.atan2(-this.planeDir.x, -this.planeDir.z),
        active: this.phase === 'plane',
      },
      minimapVehicles: this.vehicles.map((v) => ({ x: v.x, z: v.z, type: v.spec.type })),
      matchStats: this.matchStats,
    };

    this.onHudUpdate(snapshot);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.exitPointerLock();

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);

    soundEngine.updateVehicleEngine(false, 0, false);
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
