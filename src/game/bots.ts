import * as THREE from 'three';
import { HumanCharacterRig } from './character';
import { groundHeightAt, MAP_POIS } from './terrain';
import { CHARACTER_SKINS, GameMode, SafeZoneState, WeaponId } from './types';
import { WEAPON_SPECS } from './weapons';

const CALLSIGNS = [
  'GhostWalker', 'Kestrel_99', 'ViperSix', 'ShadowWolf', 'IronFang', 'ApexNomad', 'ZeroCool', 'DeltaHawk',
  'SniperFox', 'RaptorX', 'Spectre_07', 'BlazeUnit', 'FrostBite', 'RavenClaw', 'TitanCore', 'CobraStrike',
  'NightOwl', 'StormRider', 'EchoActual', 'Phantom_K', 'Valkyrie', 'Wraith_88', 'SteelRain', 'HavocActual',
  'Sierra_11', 'Reaper_21', 'LoneRanger', 'VenomEdge', 'TangoDown', 'RogueOps', 'ArcticFox', 'Maverick',
  'CobaltSix', 'Banshee_X', 'Kodiak_4', 'BulletProof', 'SableOps', 'Crosshair', 'Deadeye', 'OnyxUnit',
  'AshViper', 'Juggernaut', 'LynxRecon', 'Vortex_7', 'Spartan_01', 'NomadActual', 'OrionStrike', 'Jackal',
];

export type BotAIState = 'parachute' | 'roam' | 'rotate_zone' | 'combat' | 'follow_player';

export interface BotAgent {
  id: number;
  name: string;
  isTeammate: boolean;
  alive: boolean;
  hp: number;
  maxHp: number;
  armorReduction: number; // 0..0.45
  helmetReduction: number; // 0..0.45
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  weaponId: WeaponId;
  state: BotAIState;
  targetX: number;
  targetZ: number;
  strafeDir: number;
  strafeTimer: number;
  fireCooldown: number;
  parachuteOpen: boolean;
  dropDelay: number;
  rig: HumanCharacterRig | null;
  skinIndex: number;
  shootRecoil: number;
  crouching: boolean;
}

export interface BotHitEvent {
  bot: BotAgent;
  damage: number;
  headshot: boolean;
  killed: boolean;
}

export class BotSimulationManager {
  public bots: BotAgent[] = [];
  private rigPool: HumanCharacterRig[] = [];
  private scene: THREE.Scene;
  private shadowTexture: THREE.Texture;
  private nextSkirmishTimer = 2.8;

  constructor(scene: THREE.Scene, shadowTexture: THREE.Texture) {
    this.scene = scene;
    this.shadowTexture = shadowTexture;

    // Pre-allocate 28 detailed composite 3D character rigs for high FPS & zero mid-match GC
    for (let i = 0; i < 28; i++) {
      const rig = new HumanCharacterRig(CHARACTER_SKINS[i % CHARACTER_SKINS.length], this.shadowTexture);
      rig.root.visible = false;
      this.scene.add(rig.root);
      this.rigPool.push(rig);
    }
  }

  public spawnMatchBots(
    mode: GameMode,
    planeStartX: number,
    planeStartZ: number,
    planeDirX: number,
    planeDirZ: number
  ): void {
    // Release any active rigs
    for (const r of this.rigPool) {
      r.root.visible = false;
    }
    this.bots = [];

    const teammateCount = mode === 'squad' ? 3 : mode === 'duo' ? 1 : 0;
    const totalBots = 99;
    const weapons: WeaponId[] = ['akm', 'm416', 'scarl', 'ump45', 'uzi', 'shotgun', 'kar98k'];

    for (let i = 0; i < totalBots; i++) {
      const isTeammate = i < teammateCount;
      const poi = MAP_POIS[i % MAP_POIS.length];
      const scatterAngle = Math.random() * Math.PI * 2;
      const scatterDist = 18 + Math.random() * (poi.radius * 0.9);
      const landX = poi.x + Math.cos(scatterAngle) * scatterDist;
      const landZ = poi.z + Math.sin(scatterAngle) * scatterDist;

      // Start bots along the flight corridor or descending on parachute
      const along = 0.15 + Math.random() * 0.7;
      const spawnX = isTeammate
        ? planeStartX + planeDirX * 380 + (Math.random() - 0.5) * 28
        : THREE.MathUtils.lerp(planeStartX + planeDirX * along * 950, landX, 0.45);
      const spawnZ = isTeammate
        ? planeStartZ + planeDirZ * 380 + (Math.random() - 0.5) * 28
        : THREE.MathUtils.lerp(planeStartZ + planeDirZ * along * 950, landZ, 0.45);

      const suffix = i >= CALLSIGNS.length ? `_${i}` : '';
      const name = isTeammate ? `Squad-${i + 1}` : `${CALLSIGNS[i % CALLSIGNS.length]}${suffix}`;
      const wId = weapons[Math.floor(Math.random() * weapons.length)];

      this.bots.push({
        id: i + 1,
        name,
        isTeammate,
        alive: true,
        hp: 100,
        maxHp: 100,
        armorReduction: Math.random() < 0.55 ? 0.25 : 0.12,
        helmetReduction: Math.random() < 0.5 ? 0.25 : 0.1,
        x: spawnX,
        y: 115 + Math.random() * 45,
        z: spawnZ,
        vx: 0,
        vz: 0,
        yaw: Math.random() * Math.PI * 2,
        weaponId: wId,
        state: 'parachute',
        targetX: landX,
        targetZ: landZ,
        strafeDir: Math.random() < 0.5 ? -1 : 1,
        strafeTimer: 1 + Math.random() * 2,
        fireCooldown: 0.4 + Math.random() * 0.8,
        parachuteOpen: true,
        dropDelay: isTeammate ? 0.4 + i * 0.35 : Math.random() * 4.5,
        rig: null,
        skinIndex: isTeammate ? 0 : i % CHARACTER_SKINS.length,
        shootRecoil: 0,
        crouching: false,
      });
    }
  }

  public update(
    dt: number,
    elapsed: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerAlive: boolean,
    playerInPlane: boolean,
    safeZone: SafeZoneState,
    viewDistance: number,
    onBotFireAtPlayer: (bot: BotAgent, dist: number) => void,
    onKillEvent: (killerName: string, victimName: string, weaponName: string, headshot: boolean) => void
  ): void {
    // 1. Assign 3D character rigs to closest 28 alive bots (always prioritizing teammates + nearby enemies)
    const aliveBots = this.bots.filter((b) => b.alive);
    aliveBots.sort((a, b) => {
      if (a.isTeammate !== b.isTeammate) return a.isTeammate ? -1 : 1;
      const da = (a.x - playerX) ** 2 + (a.z - playerZ) ** 2;
      const db = (b.x - playerX) ** 2 + (b.z - playerZ) ** 2;
      return da - db;
    });

    // Clear old rig assignments
    for (const b of this.bots) b.rig = null;
    for (const r of this.rigPool) r.root.visible = false;

    const maxVisible = Math.min(this.rigPool.length, aliveBots.length);
    for (let i = 0; i < maxVisible; i++) {
      const bot = aliveBots[i];
      const dist = Math.hypot(bot.x - playerX, bot.z - playerZ);
      if (dist > Math.min(viewDistance, 380) && !bot.isTeammate) continue;

      const rig = this.rigPool[i];
      bot.rig = rig;
      rig.applySkin(CHARACTER_SKINS[bot.skinIndex]);
      rig.setEquipment(
        bot.helmetReduction > 0.2 ? 2 : 1,
        bot.armorReduction > 0.2 ? 2 : 1,
        1
      );
      rig.setWeapon(bot.state === 'parachute' ? null : bot.weaponId);
      rig.root.visible = true;
    }

    // 2. Simulate off-screen background Battle Royale skirmishes so alive count drops organically
    if (!playerInPlane) {
      this.nextSkirmishTimer -= dt;
      if (this.nextSkirmishTimer <= 0 && aliveBots.length > 8) {
        this.nextSkirmishTimer = 2.2 + Math.random() * 3.2;
        const farEnemies = aliveBots.filter(
          (b) => !b.isTeammate && !b.rig && Math.hypot(b.x - playerX, b.z - playerZ) > 160
        );
        if (farEnemies.length >= 2) {
          const killer = farEnemies[Math.floor(Math.random() * farEnemies.length)];
          const victim = farEnemies[Math.floor(Math.random() * farEnemies.length)];
          if (killer.id !== victim.id) {
            victim.alive = false;
            victim.hp = 0;
            onKillEvent(killer.name, victim.name, WEAPON_SPECS[killer.weaponId].name, Math.random() < 0.25);
          }
        }
      }
    }

    // 3. Update every alive bot's physics, AI, zone survival & 3D animation
    for (const bot of aliveBots) {
      if (bot.dropDelay > 0) {
        bot.dropDelay -= dt;
        continue;
      }

      if (bot.shootRecoil > 0) {
        bot.shootRecoil = Math.max(0, bot.shootRecoil - dt * 6);
      }

      const groundY = groundHeightAt(bot.x, bot.z);

      // Parachuting phase
      if (bot.state === 'parachute') {
        const dx = bot.targetX - bot.x;
        const dz = bot.targetZ - bot.z;
        const distT = Math.hypot(dx, dz);
        if (distT > 4) {
          bot.x += (dx / distT) * 14 * dt;
          bot.z += (dz / distT) * 14 * dt;
          bot.yaw = Math.atan2(-dx, -dz);
        }
        bot.y -= 13 * dt;
        if (bot.y <= groundY) {
          bot.y = groundY;
          bot.parachuteOpen = false;
          bot.state = bot.isTeammate ? 'follow_player' : 'roam';
        }
      } else {
        // Blue Zone damage to bots
        const distFromZone = Math.hypot(bot.x - safeZone.currentCenterX, bot.z - safeZone.currentCenterZ);
        if (distFromZone > safeZone.currentRadius) {
          bot.hp -= safeZone.damagePerSec * 0.85 * dt;
          if (bot.hp <= 0) {
            bot.alive = false;
            bot.hp = 0;
            if (bot.rig) bot.rig.root.visible = false;
            onKillEvent('Blue Zone', bot.name, 'Playzone', false);
            continue;
          }
        }

        // AI State Decision
        const distToPlayer = Math.hypot(bot.x - playerX, bot.z - playerZ);
        let moveSpeed = 4.4;
        let isSprinting = false;

        if (bot.isTeammate) {
          // Teammate follows player & engages nearby hostile bots
          if (playerInPlane) {
            bot.y = groundY;
          } else {
            const followDist = distToPlayer;
            if (followDist > 12) {
              const dx = playerX - bot.x;
              const dz = playerZ - bot.z;
              bot.yaw = Math.atan2(-dx, -dz);
              moveSpeed = followDist > 26 ? 6.8 : 4.8;
              isSprinting = followDist > 26;
              bot.x += (dx / followDist) * moveSpeed * dt;
              bot.z += (dz / followDist) * moveSpeed * dt;
            } else {
              moveSpeed = 0;
            }
          }
        } else if (distFromZone > safeZone.currentRadius * 0.88) {
          // Rotate inward toward Safe Zone
          bot.state = 'rotate_zone';
          const dx = safeZone.targetCenterX - bot.x;
          const dz = safeZone.targetCenterZ - bot.z;
          const d = Math.hypot(dx, dz) || 1;
          bot.yaw = Math.atan2(-dx, -dz);
          moveSpeed = 6.2;
          isSprinting = true;
          bot.x += (dx / d) * moveSpeed * dt;
          bot.z += (dz / d) * moveSpeed * dt;
        } else if (playerAlive && !playerInPlane && distToPlayer < 88 && playerY - groundHeightAt(playerX, playerZ) < 12) {
          // Combat engagement with Player!
          bot.state = 'combat';
          const dx = playerX - bot.x;
          const dz = playerZ - bot.z;
          bot.yaw = Math.atan2(-dx, -dz);

          bot.strafeTimer -= dt;
          if (bot.strafeTimer <= 0) {
            bot.strafeTimer = 0.9 + Math.random() * 1.4;
            bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
            bot.crouching = Math.random() < 0.25;
          }

          // Strafe & close/maintain optimal distance
          const perpX = -dz / distToPlayer;
          const perpZ = dx / distToPlayer;
          const radialFactor = distToPlayer > 36 ? 0.55 : distToPlayer < 16 ? -0.45 : 0;
          moveSpeed = 3.6;
          bot.x += (perpX * bot.strafeDir * 0.85 + (dx / distToPlayer) * radialFactor) * moveSpeed * dt;
          bot.z += (perpZ * bot.strafeDir * 0.85 + (dz / distToPlayer) * radialFactor) * moveSpeed * dt;

          bot.fireCooldown -= dt;
          if (bot.fireCooldown <= 0) {
            const spec = WEAPON_SPECS[bot.weaponId];
            bot.fireCooldown = Math.max(0.22, spec.fireRateMs / 1000) + Math.random() * 0.45;
            bot.shootRecoil = 1.0;
            onBotFireAtPlayer(bot, distToPlayer);
          }
        } else {
          // Roam between POIs & safe zone
          bot.state = 'roam';
          bot.crouching = false;
          const dx = bot.targetX - bot.x;
          const dz = bot.targetZ - bot.z;
          const d = Math.hypot(dx, dz);
          if (d < 8) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * safeZone.currentRadius * 0.72;
            bot.targetX = safeZone.currentCenterX + Math.cos(ang) * r;
            bot.targetZ = safeZone.currentCenterZ + Math.sin(ang) * r;
          } else {
            bot.yaw = Math.atan2(-dx, -dz);
            moveSpeed = 4.2;
            bot.x += (dx / d) * moveSpeed * dt;
            bot.z += (dz / d) * moveSpeed * dt;
          }
        }

        // Clamp inside island water rim
        bot.x = THREE.MathUtils.clamp(bot.x, -510, 510);
        bot.z = THREE.MathUtils.clamp(bot.z, -510, 510);
        bot.y = groundHeightAt(bot.x, bot.z);

        if (bot.rig) {
          bot.rig.root.position.set(bot.x, bot.y, bot.z);
          bot.rig.root.rotation.y = bot.yaw;
          bot.rig.updateAnimation({
            moveSpeed: moveSpeed > 0.1 ? moveSpeed / 4.5 : 0,
            isSprinting,
            isCrouching: bot.crouching,
            isAirborne: false,
            isParachuting: false,
            isSkydiving: false,
            isAds: bot.state === 'combat',
            shootRecoil: bot.shootRecoil,
            reloadProgress: 0,
            time: elapsed + bot.id * 0.37,
            pitch: 0,
          });
        }
        continue;
      }

      // Parachute animation update for visible rigs
      if (bot.rig) {
        bot.rig.root.position.set(bot.x, bot.y, bot.z);
        bot.rig.root.rotation.y = bot.yaw;
        bot.rig.updateAnimation({
          moveSpeed: 0,
          isSprinting: false,
          isCrouching: false,
          isAirborne: true,
          isParachuting: true,
          isSkydiving: false,
          isAds: false,
          shootRecoil: 0,
          reloadProgress: 0,
          time: elapsed + bot.id * 0.2,
          pitch: 0,
        });
      }
    }
  }

  public getAliveCount(playerAlive: boolean): number {
    let count = playerAlive ? 1 : 0;
    for (const b of this.bots) {
      if (b.alive) count++;
    }
    return count;
  }

  public getEnemyAliveCount(): number {
    let count = 0;
    for (const b of this.bots) {
      if (b.alive && !b.isTeammate) count++;
    }
    return count;
  }

  public getTeammateSnapshots(): Array<{ name: string; hp: number; alive: boolean; x: number; z: number }> {
    return this.bots
      .filter((b) => b.isTeammate)
      .map((b) => ({ name: b.name, hp: Math.ceil(b.hp), alive: b.alive, x: b.x, z: b.z }));
  }

  public getVisibleEnemyRigs(): Array<{ bot: BotAgent; rig: HumanCharacterRig }> {
    const out: Array<{ bot: BotAgent; rig: HumanCharacterRig }> = [];
    for (const b of this.bots) {
      if (b.alive && !b.isTeammate && b.rig && b.rig.root.visible) {
        out.push({ bot: b, rig: b.rig });
      }
    }
    return out;
  }
}
