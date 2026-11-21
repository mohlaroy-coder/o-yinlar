import React from 'react';
import { Backpack, Camera, Crosshair, Map as MapIcon, Settings, Shield, Trophy } from 'lucide-react';
import { BattleRoyaleEngine } from '../game/BattleRoyaleEngine';
import { GameSettings, HudSnapshot } from '../game/types';
import { WEAPON_SPECS } from '../game/weapons';
import { TacticalMap } from './TacticalMap';

interface GameHUDProps {
  hud: HudSnapshot;
  settings: GameSettings;
  engine: BattleRoyaleEngine | null;
  onOpenInventory: () => void;
  onOpenMap: () => void;
  onOpenSettings: () => void;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  settings,
  engine,
  onOpenInventory,
  onOpenMap,
  onOpenSettings,
  onPlayAgain,
  onReturnLobby,
}) => {
  const activeSlot = hud.inventory.activeSlot;
  const activeWeaponInst =
    activeSlot === 0 || activeSlot === 1 || activeSlot === 2
      ? hud.inventory.weapons[activeSlot]
      : null;
  const activeWeaponId = activeSlot === 3 ? 'grenade' : activeWeaponInst?.id ?? null;
  const activeSpec = activeWeaponId ? WEAPON_SPECS[activeWeaponId] : null;
  const isSniperAds = hud.isAds && (activeWeaponId === 'awm' || activeWeaponId === 'kar98k');

  // End-of-Match Victory / Defeat Screen
  if ((hud.phase === 'victory' || hud.phase === 'defeat') && hud.matchStats) {
    const isWin = hud.phase === 'victory';
    const st = hud.matchStats;
    return (
      <div className="fixed inset-0 z-50 bg-black/82 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#0d1117] border border-white/15 rounded-xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className={`w-7 h-7 ${isWin ? 'text-amber-400' : 'text-slate-400'}`} />
            <h2
              className={`font-display text-2xl sm:text-3xl font-extrabold tracking-wide ${
                isWin ? 'text-amber-400' : 'text-slate-100'
              }`}
            >
              {isWin ? 'WINNER WINNER CHICKEN DINNER!' : 'BETTER LUCK NEXT TIME!'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Rank <span className="font-mono-tabular text-amber-400 font-bold">#{st.rank}</span> / {st.totalPlayers} ·{' '}
            <span className="capitalize">{st.mode}</span> Mode
            {st.eliminatedBy ? ` · Eliminated by ${st.eliminatedBy}` : ''}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              ['Kills', String(st.kills)],
              ['Headshots', String(st.headshots)],
              ['Damage', String(st.damageDealt)],
              ['Survived', formatTime(st.survivalTimeSec)],
              ['Distance', `${st.distanceMeters}m`],
              ['Rank', `#${st.rank}`],
            ].map(([label, val]) => (
              <div key={label} className="p-3 rounded-lg bg-[#151b24] border border-white/10">
                <div className="text-[11px] text-slate-400">{label}</div>
                <div className="font-display text-xl font-bold text-slate-100 tabular-nums mt-0.5">{val}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex-1 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold tracking-wide"
            >
              PLAY AGAIN
            </button>
            <button
              type="button"
              onClick={onReturnLobby}
              className="px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-white/10"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  const spreadPx = Math.min(48, Math.max(6, hud.crosshairSpread));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Damage Red Vignette */}
      {hud.damageFlashTimer > 0 && (
        <div
          className="fixed inset-0 pointer-events-none border-[10px] border-red-600/70"
          style={{ opacity: Math.min(1, hud.damageFlashTimer * 3) }}
        />
      )}

      {/* Blue Zone Warning Edge */}
      {hud.safeZone.outsideZone && hud.phase === 'combat' && (
        <div className="fixed inset-0 pointer-events-none border-[4px] border-blue-500/65" />
      )}

      {/* Sniper Optic Scope Overlay */}
      {isSniperAds && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] rounded-full border-[4px] border-black shadow-[0_0_0_9999px_rgba(0,0,0,0.88)] relative flex items-center justify-center">
            <div className="absolute inset-x-0 h-[1px] bg-black/80" />
            <div className="absolute inset-y-0 w-[1px] bg-black/80" />
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </div>
        </div>
      )}

      {/* Dynamic Crosshair & Hitmarker */}
      {hud.phase === 'combat' && !hud.inVehicle && !isSniperAds && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-1 h-1">
            <div className="w-1 h-1 rounded-full bg-white/90" />
            <div
              className="absolute left-0 w-[2px] h-2.5 bg-white/85 -translate-x-1/2"
              style={{ bottom: `${spreadPx}px` }}
            />
            <div
              className="absolute left-0 w-[2px] h-2.5 bg-white/85 -translate-x-1/2"
              style={{ top: `${spreadPx}px` }}
            />
            <div
              className="absolute top-0 h-[2px] w-2.5 bg-white/85 -translate-y-1/2"
              style={{ right: `${spreadPx}px` }}
            />
            <div
              className="absolute top-0 h-[2px] w-2.5 bg-white/85 -translate-y-1/2"
              style={{ left: `${spreadPx}px` }}
            />

            {hud.hitMarkerTimer > 0 && (
              <div
                className={`absolute -inset-3 flex items-center justify-center font-bold text-lg ${
                  hud.hitMarkerHeadshot ? 'text-red-500' : 'text-white'
                }`}
              >
                ✕
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top-Left: Match Status, Safe Zone & Teammates */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-[#0d1117]/90 border border-white/15 rounded-lg px-3 py-2">
          <div className="flex items-baseline gap-1.5 pr-3 border-r border-white/10">
            <span className="font-mono-tabular text-lg font-bold text-slate-100">{hud.aliveCount}</span>
            <span className="text-[11px] font-semibold text-slate-400">ALIVE</span>
          </div>
          <div className="flex items-baseline gap-1.5 pr-3 border-r border-white/10">
            <span className="font-mono-tabular text-lg font-bold text-amber-400">{hud.kills}</span>
            <span className="text-[11px] font-semibold text-slate-400">KILLS</span>
          </div>
          <div className="font-mono-tabular text-xs text-slate-300">{formatTime(hud.matchTimeSec)}</div>
        </div>

        {/* Safe Zone Indicator */}
        <div
          className={`px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            hud.safeZone.outsideZone
              ? 'bg-blue-950/90 border-blue-400/60 text-blue-200'
              : 'bg-[#0d1117]/90 border-white/15 text-slate-200'
          }`}
        >
          <span>
            {hud.safeZone.outsideZone
              ? 'OUTSIDE SAFE ZONE'
              : hud.safeZone.isShrinking
                ? `Zone ${hud.safeZone.phase} Closing`
                : `Zone ${hud.safeZone.phase} Hold`}
          </span>
          <span className="font-mono-tabular font-bold text-amber-400">
            {hud.safeZone.timeRemainingSec}s
          </span>
        </div>

        {/* Squadmates (Duo/Squad) */}
        {hud.teammates.length > 0 && (
          <div className="bg-[#0d1117]/90 border border-white/15 rounded-lg p-2 space-y-1.5 min-w-[175px]">
            {hud.teammates.map((tm) => (
              <div key={tm.name} className="text-xs">
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className={tm.alive ? 'text-emerald-400 font-medium' : 'text-slate-500 line-through'}>
                    {tm.name}
                  </span>
                  <span className="font-mono-tabular text-slate-300">{tm.alive ? `${tm.hp}%` : 'KO'}</span>
                </div>
                <div className="h-1 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${tm.alive ? tm.hp : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-Right: Minimap, Quick Controls & Kill Feed */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 pointer-events-auto">
          {settings.showFps && (
            <div className="px-2.5 py-1.5 rounded bg-[#0d1117]/90 border border-white/15 font-mono-tabular text-xs text-emerald-400">
              {hud.fps} FPS
            </div>
          )}
          <button
            type="button"
            onClick={() => engine?.toggleCameraMode()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#0d1117]/90 hover:bg-[#161d28] border border-white/15 text-xs font-bold text-amber-400"
            title="Switch Camera (V)"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{hud.cameraMode} [V]</span>
          </button>
          <button
            type="button"
            onClick={onOpenInventory}
            className="p-1.5 rounded bg-[#0d1117]/90 hover:bg-[#161d28] border border-white/15 text-slate-200"
            title="Inventory (Tab)"
          >
            <Backpack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenMap}
            className="p-1.5 rounded bg-[#0d1117]/90 hover:bg-[#161d28] border border-white/15 text-slate-200"
            title="Tactical Map (M)"
          >
            <MapIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded bg-[#0d1117]/90 hover:bg-[#161d28] border border-white/15 text-slate-200"
            title="Settings (Esc)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="pointer-events-auto cursor-pointer" onClick={onOpenMap}>
          <TacticalMap hud={hud} fullScreen={false} />
        </div>

        {/* Kill Feed */}
        <div className="flex flex-col items-end gap-1 max-w-[290px]">
          {hud.killFeed.map((kf) => (
            <div
              key={kf.id}
              className="px-2.5 py-1 rounded bg-[#0d1117]/88 border border-white/10 text-[11px] flex items-center gap-1.5"
            >
              <span className={kf.isPlayerKiller ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                {kf.killer}
              </span>
              <span className="text-slate-400">[{kf.weapon}{kf.headshot ? ' HS' : ''}]</span>
              <span className={kf.isPlayerVictim ? 'text-red-400 font-bold' : 'text-slate-300'}>
                {kf.victim}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pointer Lock Helper Banner */}
      {!hud.pointerLocked && !settings.mobileControls && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={() => engine?.requestPointerLock()}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-xl"
          >
            Click to Lock Mouse & Aim (Esc to release cursor)
          </button>
        </div>
      )}

      {/* Parachute Altimeter */}
      {hud.phase === 'parachute' && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-[#0d1117]/90 border border-white/15 rounded-lg p-3 space-y-1">
          <div className="text-[11px] text-slate-400">ALTITUDE</div>
          <div className="font-mono-tabular text-xl font-bold text-amber-400">{hud.altitudeMeters}m</div>
          <div className="text-[11px] text-slate-400 pt-1">DESCENT</div>
          <div className="font-mono-tabular text-sm font-semibold text-slate-100">{hud.fallSpeedKmh} km/h</div>
        </div>
      )}

      {/* Vehicle Speedometer */}
      {hud.inVehicle && (
        <div className="absolute left-6 bottom-28 bg-[#0d1117]/90 border border-white/15 rounded-lg p-3 min-w-[175px]">
          <div className="text-xs font-semibold text-amber-400 mb-1">{hud.vehicleName}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono-tabular text-2xl font-bold text-slate-100">{hud.vehicleSpeedKmh}</span>
            <span className="text-xs text-slate-400">km/h</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${(hud.vehicleHp / hud.vehicleMaxHp) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Reload / Heal Progress Bar */}
      {(hud.isReloading || hud.isHealing) && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-[#0d1117]/92 border border-white/15 rounded-lg px-4 py-2 min-w-[210px]">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-100 font-semibold">
              {hud.isReloading ? 'Reloading...' : hud.healLabel}
            </span>
            <span className="font-mono-tabular text-amber-400">
              {Math.round((hud.isReloading ? hud.reloadProgress : hud.healProgress) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-75"
              style={{ width: `${(hud.isReloading ? hud.reloadProgress : hud.healProgress) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Contextual Interact Prompt */}
      {hud.interactPrompt && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={() =>
              hud.interactPrompt?.type === 'loot'
                ? engine?.triggerPickupNearest()
                : engine?.triggerInteract()
            }
            className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-[#0d1117]/95 border border-amber-400/60 shadow-xl"
          >
            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono-tabular text-xs font-extrabold">
              {hud.interactPrompt.keyHint}
            </span>
            <span className="text-xs font-semibold text-slate-100">{hud.interactPrompt.label}</span>
            {hud.interactPrompt.subLabel && (
              <span className="text-xs text-amber-400 font-mono-tabular">{hud.interactPrompt.subLabel}</span>
            )}
          </button>
        </div>
      )}

      {/* Bottom-Center Tactical Status Bar (Health, Armor, Weapons, Ammo) */}
      {!settings.mobileControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[94vw] max-w-2xl bg-[#0d1117]/92 border border-white/15 rounded-xl px-4 py-2.5 shadow-2xl pointer-events-auto">
          {/* Weapon Slots Row */}
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[0, 1, 2, 3].map((slot) => {
                const isSelected = activeSlot === slot;
                const w = slot < 3 ? hud.inventory.weapons[slot as 0 | 1 | 2] : null;
                const label =
                  slot === 3
                    ? `Frag (${hud.inventory.weapons[3]})`
                    : w
                      ? WEAPON_SPECS[w.id].name
                      : slot === 2
                        ? 'Sidearm'
                        : `Slot ${slot + 1}`;
                const enabled = slot === 3 ? hud.inventory.weapons[3] > 0 : !!w;

                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={!enabled}
                    onClick={() => engine?.selectWeaponSlot(slot as 0 | 1 | 2 | 3)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-[#151b24] border-white/10 text-slate-300 hover:text-white'
                    } ${!enabled ? 'opacity-40 cursor-default' : ''}`}
                  >
                    <span className="font-mono-tabular text-amber-400 mr-1">{slot + 1}</span>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Active Ammo Readout */}
            {activeSpec && (
              <div className="flex items-baseline gap-1.5 shrink-0 pl-2">
                <Crosshair className="w-3.5 h-3.5 text-amber-400 self-center" />
                <span className="font-mono-tabular text-xl font-bold text-slate-100">
                  {activeSlot === 3 ? hud.inventory.weapons[3] : activeWeaponInst?.ammoInMag ?? 0}
                </span>
                <span className="font-mono-tabular text-xs text-slate-400">
                  / {hud.inventory.ammo[activeSpec.ammoType] || 0}
                </span>
              </div>
            )}
          </div>

          {/* Health, Boost & Gear Row */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono-tabular text-slate-200">
                H{hud.inventory.helmetLevel} · V{hud.inventory.vestLevel} · B{hud.inventory.backpackLevel}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-1">
              {/* Boost Bar */}
              <div className="h-1 bg-slate-800 rounded overflow-hidden">
                <div className="h-full bg-sky-400" style={{ width: `${hud.boost}%` }} />
              </div>
              {/* Health Bar */}
              <div className="h-3 bg-slate-800 rounded overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.hp > 50 ? 'bg-slate-100' : hud.hp > 25 ? 'bg-amber-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
                />
              </div>
            </div>

            <div className="font-mono-tabular text-sm font-bold text-slate-100 w-10 text-right">
              {hud.hp}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
