import React from 'react';
import { Settings, Shield, Users, Volume2, VolumeX } from 'lucide-react';
import { CHARACTER_SKINS, GameMode, GameSettings } from '../game/types';

interface MainMenuProps {
  mode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  selectedSkin: number;
  onSelectSkin: (index: number) => void;
  onPlay: () => void;
  onOpenSettings: () => void;
  settings: GameSettings;
  onToggleMute: () => void;
  fps: number;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  mode,
  onSelectMode,
  selectedSkin,
  onSelectSkin,
  onPlay,
  onOpenSettings,
  settings,
  onToggleMute,
  fps,
}) => {
  const activeSkin = CHARACTER_SKINS[selectedSkin];

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-5 sm:p-7">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-4 pointer-events-auto">
        <div className="bg-[#0d1117]/90 border border-white/15 rounded-lg px-4 py-2.5">
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wider text-slate-100 leading-none">
            BATTLE ROYALE: <span className="text-amber-400">SURVIVAL ZONE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Erangel Island · 100 Combatants · FPP & TPP Tactical Shooter
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {settings.showFps && (
            <div className="px-3 py-2 rounded-lg bg-[#0d1117]/90 border border-white/15 font-mono-tabular text-xs text-emerald-400">
              {fps} FPS
            </div>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label="Toggle Sound"
            className="p-2.5 rounded-lg bg-[#0d1117]/90 hover:bg-[#161d28] border border-white/15 text-slate-200 transition-colors"
          >
            {settings.masterVolume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0d1117]/90 hover:bg-[#161d28] border border-white/15 text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Bottom Unified Deployment Dock (unobstructed center viewport for 3D character) */}
      <div className="pointer-events-auto w-full max-w-4xl mx-auto bg-[#0d1117]/92 border border-white/15 rounded-xl p-4 sm:p-5 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Mode Selector */}
          <div className="md:col-span-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Squad Mode</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-[#151b24] p-1 rounded-lg border border-white/10">
              {(
                [
                  { id: 'solo', label: 'Solo' },
                  { id: 'duo', label: 'Duo' },
                  { id: 'squad', label: 'Squad' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMode(m.id)}
                  className={`py-2 text-xs font-bold rounded transition-colors ${
                    mode === m.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Character Outfit Customization */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Operator Outfit</span>
              </span>
              <span className="text-amber-400 font-medium">{activeSkin.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {CHARACTER_SKINS.map((skin, idx) => (
                <button
                  key={skin.id}
                  type="button"
                  title={skin.name}
                  onClick={() => onSelectSkin(idx)}
                  className={`flex-1 py-2 px-1.5 rounded-lg border text-[11px] font-semibold truncate transition-colors ${
                    selectedSkin === idx
                      ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                      : 'border-white/10 bg-[#151b24] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {skin.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Play Action */}
          <div className="md:col-span-3 flex flex-col justify-end">
            <button
              type="button"
              onClick={onPlay}
              className="w-full py-3.5 px-6 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-display text-lg font-extrabold tracking-wider shadow-lg transition-colors cursor-pointer"
            >
              DEPLOY NOW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
