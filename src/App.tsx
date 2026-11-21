import { useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { InventoryOverlay } from './components/InventoryOverlay';
import { MainMenu } from './components/MainMenu';
import { MobileControls } from './components/MobileControls';
import { SettingsModal } from './components/SettingsModal';
import { TacticalMap } from './components/TacticalMap';
import { soundEngine } from './game/audio';
import { BattleRoyaleEngine } from './game/BattleRoyaleEngine';
import { DEFAULT_SETTINGS, GameMode, GameSettings, HudSnapshot } from './game/types';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BattleRoyaleEngine | null>(null);

  const [mode, setMode] = useState<GameMode>('solo');
  const [selectedSkin, setSelectedSkin] = useState<number>(0);
  const [settings, setSettings] = useState<GameSettings>(() => ({
    ...DEFAULT_SETTINGS,
    mobileControls: typeof window !== 'undefined' && 'ontouchstart' in window && window.innerWidth < 900,
  }));
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Mount Three.js BattleRoyaleEngine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new BattleRoyaleEngine(container, settings, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global UI overlay hotkeys (Tab = Inventory, M = Map, Escape = Settings)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const phase = hud?.phase;
      if (!phase || phase === 'menu' || phase === 'victory' || phase === 'defeat') return;

      if (e.code === 'Tab') {
        e.preventDefault();
        setShowMap(false);
        setShowSettings(false);
        setShowInventory((prev) => {
          const next = !prev;
          if (next) engineRef.current?.exitPointerLock();
          else engineRef.current?.requestPointerLock();
          return next;
        });
      } else if (e.code === 'KeyM') {
        setShowInventory(false);
        setShowSettings(false);
        setShowMap((prev) => {
          const next = !prev;
          if (next) engineRef.current?.exitPointerLock();
          else engineRef.current?.requestPointerLock();
          return next;
        });
      } else if (e.code === 'Escape') {
        if (showInventory) {
          setShowInventory(false);
        } else if (showMap) {
          setShowMap(false);
        } else {
          setShowSettings((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud?.phase, showInventory, showMap]);

  const handleUpdateSettings = (next: GameSettings) => {
    setSettings(next);
    engineRef.current?.applySettings(next);
  };

  const handleSelectSkin = (index: number) => {
    setSelectedSkin(index);
    engineRef.current?.setSelectedSkin(index);
  };

  const handlePlay = () => {
    setShowSettings(false);
    setShowInventory(false);
    setShowMap(false);
    engineRef.current?.startMatch(mode);
  };

  const handleToggleMute = () => {
    soundEngine.init();
    if (settings.masterVolume > 0) {
      handleUpdateSettings({ ...settings, masterVolume: 0 });
    } else {
      handleUpdateSettings({ ...settings, masterVolume: 0.75 });
      if (hud?.phase === 'menu') soundEngine.startMenuMusic();
    }
  };

  const inActiveMatch =
    hud && (hud.phase === 'plane' || hud.phase === 'parachute' || hud.phase === 'combat' || hud.phase === 'victory' || hud.phase === 'defeat');

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b0e13]">
      {/* Dedicated Isolated WebGL Container */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full" />

      {/* Main Menu Overlay */}
      {(!hud || hud.phase === 'menu') && (
        <MainMenu
          mode={mode}
          onSelectMode={setMode}
          selectedSkin={selectedSkin}
          onSelectSkin={handleSelectSkin}
          onPlay={handlePlay}
          onOpenSettings={() => {
            soundEngine.init();
            soundEngine.startMenuMusic();
            setShowSettings(true);
          }}
          settings={settings}
          onToggleMute={handleToggleMute}
          fps={hud?.fps ?? 60}
        />
      )}

      {/* Active Gameplay HUD */}
      {inActiveMatch && (
        <GameHUD
          hud={hud}
          settings={settings}
          engine={engineRef.current}
          onOpenInventory={() => {
            engineRef.current?.exitPointerLock();
            setShowMap(false);
            setShowInventory(true);
          }}
          onOpenMap={() => {
            engineRef.current?.exitPointerLock();
            setShowInventory(false);
            setShowMap(true);
          }}
          onOpenSettings={() => {
            engineRef.current?.exitPointerLock();
            setShowSettings(true);
          }}
          onPlayAgain={handlePlay}
          onReturnLobby={() => {
            setShowInventory(false);
            setShowMap(false);
            setShowSettings(false);
            engineRef.current?.returnToMenu();
          }}
        />
      )}

      {/* Mobile Touch Controls */}
      {inActiveMatch &&
        settings.mobileControls &&
        (hud.phase === 'plane' || hud.phase === 'parachute' || hud.phase === 'combat') && (
          <MobileControls engine={engineRef.current} hud={hud} />
        )}

      {/* Inventory & Looting Modal */}
      {inActiveMatch && showInventory && hud.phase === 'combat' && (
        <InventoryOverlay
          hud={hud}
          onPickupItem={(uid) => engineRef.current?.pickupItemByUid(uid)}
          onSelectSlot={(slot) => engineRef.current?.selectWeaponSlot(slot)}
          onUseConsumable={(kind) => engineRef.current?.useConsumable(kind)}
          onClose={() => {
            setShowInventory(false);
            engineRef.current?.requestPointerLock();
          }}
        />
      )}

      {/* Full-Screen Tactical Map */}
      {inActiveMatch && showMap && (
        <TacticalMap
          hud={hud}
          fullScreen={true}
          onClose={() => {
            setShowMap(false);
            engineRef.current?.requestPointerLock();
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdate={handleUpdateSettings}
          onClose={() => {
            setShowSettings(false);
            if (hud && (hud.phase === 'combat' || hud.phase === 'parachute' || hud.phase === 'plane')) {
              engineRef.current?.requestPointerLock();
            }
          }}
          inMatch={!!inActiveMatch}
          onLeaveMatch={() => {
            setShowSettings(false);
            setShowInventory(false);
            setShowMap(false);
            engineRef.current?.returnToMenu();
          }}
        />
      )}
    </div>
  );
}
