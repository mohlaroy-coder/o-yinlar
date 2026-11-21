import React, { useState } from 'react';
import { GameSettings, GraphicsPreset, ShadowQuality, WeatherPreset } from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onClose: () => void;
  inMatch?: boolean;
  onLeaveMatch?: () => void;
}

const PRESET_CONFIGS: Record<
  GraphicsPreset,
  { resolutionScale: number; shadowQuality: ShadowQuality; viewDistance: number }
> = {
  low: { resolutionScale: 0.72, shadowQuality: 'off', viewDistance: 340 },
  medium: { resolutionScale: 0.85, shadowQuality: 'low', viewDistance: 480 },
  high: { resolutionScale: 1.0, shadowQuality: 'medium', viewDistance: 620 },
  ultra: { resolutionScale: 1.0, shadowQuality: 'high', viewDistance: 900 },
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdate,
  onClose,
  inMatch,
  onLeaveMatch,
}) => {
  const [tab, setTab] = useState<'graphics' | 'audio' | 'controls'>('graphics');

  const applyPreset = (preset: GraphicsPreset) => {
    const cfg = PRESET_CONFIGS[preset];
    onUpdate({
      ...settings,
      graphicsPreset: preset,
      ...cfg,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#0e1218] border border-white/15 rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#121720]">
          <h2 className="font-display text-lg font-bold tracking-wide text-amber-400">
            GAME SETTINGS
          </h2>
          <div className="flex items-center gap-2">
            {inMatch && onLeaveMatch && (
              <button
                type="button"
                onClick={onLeaveMatch}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-red-600/80 hover:bg-red-600 text-white"
              >
                Exit to Lobby
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10"
            >
              Resume
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-white/10 bg-[#10151c] px-5 gap-2 pt-2">
          {(['graphics', 'audio', 'controls'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-semibold capitalize rounded-t border-b-2 transition-colors ${
                tab === t
                  ? 'border-amber-400 text-amber-400 bg-[#151b24]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5 max-h-[68vh] overflow-y-auto">
          {tab === 'graphics' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Graphics Quality Preset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'ultra'] as GraphicsPreset[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`py-2 text-xs font-semibold capitalize rounded border transition-colors ${
                        settings.graphicsPreset === p
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-[#171d27] text-slate-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">Resolution Scale</span>
                    <span className="font-mono-tabular text-amber-400">
                      {Math.round(settings.resolutionScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.65}
                    max={1.0}
                    step={0.05}
                    value={settings.resolutionScale}
                    onChange={(e) =>
                      onUpdate({ ...settings, resolutionScale: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">View Distance</span>
                    <span className="font-mono-tabular text-amber-400">{settings.viewDistance}m</span>
                  </div>
                  <input
                    type="range"
                    min={280}
                    max={950}
                    step={20}
                    value={settings.viewDistance}
                    onChange={(e) =>
                      onUpdate({ ...settings, viewDistance: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Shadow Quality
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['off', 'low', 'medium', 'high'] as ShadowQuality[]).map((sq) => (
                    <button
                      key={sq}
                      type="button"
                      onClick={() => onUpdate({ ...settings, shadowQuality: sq })}
                      className={`py-1.5 text-xs font-semibold capitalize rounded border ${
                        settings.shadowQuality === sq
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                          : 'bg-[#171d27] text-slate-300 border-white/10'
                      }`}
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Weather & Time Lighting
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(['clear', 'sunset', 'overcast', 'rain', 'night'] as WeatherPreset[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onUpdate({ ...settings, weather: w })}
                      className={`py-1.5 text-xs font-semibold capitalize rounded border ${
                        settings.weather === w
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                          : 'bg-[#171d27] text-slate-300 border-white/10'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showFps}
                    onChange={(e) => onUpdate({ ...settings, showFps: e.target.checked })}
                    className="accent-amber-500 w-4 h-4"
                  />
                  Show Live FPS Counter
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dayNightCycle}
                    onChange={(e) => onUpdate({ ...settings, dayNightCycle: e.target.checked })}
                    className="accent-amber-500 w-4 h-4"
                  />
                  Dynamic Day / Night Cycle
                </label>
              </div>
            </>
          )}

          {tab === 'audio' && (
            <div className="space-y-4">
              {(
                [
                  ['Master Volume', 'masterVolume'],
                  ['Weapons & SFX Volume', 'sfxVolume'],
                  ['Wind & Rain Ambience', 'ambientVolume'],
                  ['Lobby Music Volume', 'musicVolume'],
                ] as const
              ).map(([label, key]) => (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-mono-tabular text-amber-400">
                      {Math.round(settings[key] * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings[key]}
                    onChange={(e) =>
                      onUpdate({ ...settings, [key]: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'controls' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300">Mouse Look Sensitivity</span>
                  <span className="font-mono-tabular text-amber-400">
                    {settings.mouseSensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.1}
                  value={settings.mouseSensitivity}
                  onChange={(e) =>
                    onUpdate({ ...settings, mouseSensitivity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={settings.mobileControls}
                  onChange={(e) => onUpdate({ ...settings, mobileControls: e.target.checked })}
                  className="accent-amber-500 w-4 h-4"
                />
                Enable On-Screen Mobile Touch Controls
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs">
                {[
                  ['W A S D', 'Move / Drive'],
                  ['Mouse', 'Look / Aim'],
                  ['Left Click', 'Shoot / Throw'],
                  ['Right Click', 'Aim Down Sights'],
                  ['Space', 'Jump'],
                  ['Shift', 'Sprint'],
                  ['C', 'Crouch'],
                  ['R', 'Reload Weapon'],
                  ['F', 'Plane / Chute / Vehicle'],
                  ['E', 'Pick Up Loot'],
                  ['1 / 2 / 3 / 4', 'Switch Weapons'],
                  ['V', 'Switch FPP / TPP'],
                  ['Tab', 'Open Inventory'],
                  ['M', 'Tactical Map'],
                  ['7 / 8 / 9 / 0', 'Use Meds / Boost'],
                ].map(([key, action]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#161c25] border border-white/5"
                  >
                    <span className="text-slate-400">{action}</span>
                    <span className="font-mono-tabular text-amber-400 font-semibold">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
