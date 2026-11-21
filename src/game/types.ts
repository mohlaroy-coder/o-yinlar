export type GameMode = 'solo' | 'duo' | 'squad';
export type CameraMode = 'TPP' | 'FPP';
export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';
export type WeatherPreset = 'clear' | 'sunset' | 'overcast' | 'rain' | 'night';

export type WeaponId =
  | 'akm'
  | 'm416'
  | 'scarl'
  | 'awm'
  | 'kar98k'
  | 'uzi'
  | 'ump45'
  | 'shotgun'
  | 'pistol'
  | 'grenade';

export type AmmoType = '7.62mm' | '5.56mm' | '.300 Magnum' | '9mm' | '.45 ACP' | '12 Gauge' | 'Grenade';

export type WeaponCategory = 'AR' | 'SR' | 'SMG' | 'SG' | 'HG' | 'TH';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  ammoType: AmmoType;
  damage: number;
  headshotMult: number;
  fireRateMs: number; // ms between shots
  magSize: number;
  reloadTimeMs: number;
  automatic: boolean;
  recoilVertical: number;
  recoilHorizontal: number;
  baseSpread: number;
  adsSpread: number;
  adsFov: number;
  range: number;
  pellets: number;
  bulletSpeed: number;
  slotGroup: 'primary' | 'sidearm' | 'throwable';
  colorHex: number;
  accentHex: number;
}

export interface WeaponInstance {
  id: WeaponId;
  ammoInMag: number;
}

export type LootCategory = 'weapon' | 'ammo' | 'helmet' | 'vest' | 'backpack' | 'med';

export interface LootItemData {
  uid: string;
  category: LootCategory;
  itemId: string;
  name: string;
  quantity: number;
  level?: 1 | 2 | 3;
  x: number;
  y: number;
  z: number;
  pickedUp: boolean;
}

export type VehicleType = 'jeep' | 'dacia' | 'motorcycle' | 'buggy' | 'pickup';

export interface VehicleSpec {
  type: VehicleType;
  name: string;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  maxHp: number;
  seatHeight: number;
  bodyColor: number;
}

export interface CharacterSkin {
  id: string;
  name: string;
  description: string;
  shirtColor: number;
  pantsColor: number;
  vestColor: number;
  bootColor: number;
  skinTone: number;
  hairColor: number;
  accentColor: number;
}

export interface GameSettings {
  graphicsPreset: GraphicsPreset;
  resolutionScale: number; // 0.65 - 1.0
  shadowQuality: ShadowQuality;
  viewDistance: number; // 280 - 950
  showFps: boolean;
  dayNightCycle: boolean;
  weather: WeatherPreset;
  masterVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  musicVolume: number;
  mouseSensitivity: number;
  mobileControls: boolean;
}

export type MatchPhase = 'menu' | 'plane' | 'parachute' | 'combat' | 'victory' | 'defeat';

export interface KillFeedEntry {
  id: number;
  killer: string;
  victim: string;
  weapon: string;
  isPlayerKiller: boolean;
  isPlayerVictim: boolean;
  headshot: boolean;
  timestamp: number;
}

export interface MapZonePOI {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  kind: 'military' | 'city' | 'village' | 'industrial' | 'airport' | 'harbor' | 'nature';
}

export interface MinimapActor {
  x: number;
  z: number;
  yaw: number;
  kind: 'player' | 'teammate' | 'enemy_ping' | 'vehicle';
  label?: string;
}

export interface SafeZoneState {
  phase: number;
  currentCenterX: number;
  currentCenterZ: number;
  currentRadius: number;
  targetCenterX: number;
  targetCenterZ: number;
  targetRadius: number;
  timeRemainingSec: number;
  isShrinking: boolean;
  damagePerSec: number;
  outsideZone: boolean;
}

export interface MatchStats {
  rank: number;
  totalPlayers: number;
  kills: number;
  headshots: number;
  damageDealt: number;
  survivalTimeSec: number;
  distanceMeters: number;
  mode: GameMode;
  eliminatedBy?: string;
}

export interface InteractPrompt {
  type: 'loot' | 'vehicle' | 'plane' | 'parachute';
  label: string;
  subLabel?: string;
  keyHint: string;
}

export interface PlayerInventoryState {
  weapons: [WeaponInstance | null, WeaponInstance | null, WeaponInstance | null, number]; // slot 1, slot 2, pistol, grenade count
  activeSlot: 0 | 1 | 2 | 3;
  ammo: Record<AmmoType, number>;
  helmetLevel: 0 | 1 | 2 | 3;
  helmetDurability: number;
  vestLevel: 0 | 1 | 2 | 3;
  vestDurability: number;
  backpackLevel: 0 | 1 | 2 | 3;
  medkits: number;
  firstAids: number;
  bandages: number;
  energyDrinks: number;
}

export interface HudSnapshot {
  phase: MatchPhase;
  cameraMode: CameraMode;
  hp: number;
  maxHp: number;
  boost: number;
  aliveCount: number;
  kills: number;
  damageDealt: number;
  matchTimeSec: number;
  fps: number;
  isAds: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  isReloading: boolean;
  reloadProgress: number;
  isHealing: boolean;
  healLabel: string;
  healProgress: number;
  inVehicle: boolean;
  vehicleName: string;
  vehicleSpeedKmh: number;
  vehicleHp: number;
  vehicleMaxHp: number;
  altitudeMeters: number;
  fallSpeedKmh: number;
  crosshairSpread: number;
  hitMarkerTimer: number;
  hitMarkerHeadshot: boolean;
  damageFlashTimer: number;
  damageDirectionRad: number;
  pointerLocked: boolean;
  timeOfDayHour: number;
  weather: WeatherPreset;
  currentLocationName: string;
  inventory: PlayerInventoryState;
  nearbyLoot: LootItemData[];
  interactPrompt: InteractPrompt | null;
  safeZone: SafeZoneState;
  killFeed: KillFeedEntry[];
  teammates: Array<{ name: string; hp: number; alive: boolean; x: number; z: number }>;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  planePos: { x: number; z: number; yaw: number; active: boolean };
  minimapVehicles: Array<{ x: number; z: number; type: VehicleType }>;
  matchStats: MatchStats | null;
}

export const CHARACTER_SKINS: CharacterSkin[] = [
  {
    id: 'specops',
    name: 'Erangel Spec-Ops',
    description: 'Olive tactical jacket with charcoal cargo trousers',
    shirtColor: 0x3b4834,
    pantsColor: 0x26292e,
    vestColor: 0x1e2226,
    bootColor: 0x161618,
    skinTone: 0xd6a684,
    hairColor: 0x221b17,
    accentColor: 0xd97706,
  },
  {
    id: 'urban',
    name: 'Urban Striker',
    description: 'Stealth slate combat suit with titanium armor trim',
    shirtColor: 0x28303d,
    pantsColor: 0x181c24,
    vestColor: 0x111419,
    bootColor: 0x0d0f12,
    skinTone: 0xc4906e,
    hairColor: 0x151517,
    accentColor: 0x38bdf8,
  },
  {
    id: 'desert',
    name: 'Miramar Ranger',
    description: 'Arid coyote tan fatigues built for open ridges',
    shirtColor: 0x8f7958,
    pantsColor: 0x6b5a42,
    vestColor: 0x453b2d,
    bootColor: 0x2d241b,
    skinTone: 0xd9ad8b,
    hairColor: 0x3d2a1c,
    accentColor: 0xf59e0b,
  },
  {
    id: 'crimson',
    name: 'Vanguard Merc',
    description: 'Deep crimson field coat with reinforced dark plate',
    shirtColor: 0x6e2323,
    pantsColor: 0x222328,
    vestColor: 0x1a1a1d,
    bootColor: 0x121214,
    skinTone: 0x8e5c40,
    hairColor: 0x121010,
    accentColor: 0xef4444,
  },
  {
    id: 'arctic',
    name: 'Vikendi Recon',
    description: 'Frost-camo winter parka with alpine webbing',
    shirtColor: 0xbac4cf,
    pantsColor: 0x7c8794,
    vestColor: 0x323b46,
    bootColor: 0x1f242b,
    skinTone: 0xe3baa0,
    hairColor: 0x5c4228,
    accentColor: 0x60a5fa,
  },
];

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsPreset: 'high',
  resolutionScale: 1.0,
  shadowQuality: 'medium',
  viewDistance: 620,
  showFps: true,
  dayNightCycle: true,
  weather: 'clear',
  masterVolume: 0.75,
  sfxVolume: 0.85,
  ambientVolume: 0.55,
  musicVolume: 0.45,
  mouseSensitivity: 1.0,
  mobileControls: false,
};
