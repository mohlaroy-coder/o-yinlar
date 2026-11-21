import React, { useRef, useState } from 'react';
import { BattleRoyaleEngine } from '../game/BattleRoyaleEngine';
import { HudSnapshot } from '../game/types';

interface MobileControlsProps {
  engine: BattleRoyaleEngine | null;
  hud: HudSnapshot;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ engine, hud }) => {
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });
  const stickTouchId = useRef<number | null>(null);
  const stickOrigin = useRef({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  const handleStickStart = (e: React.TouchEvent) => {
    if (stickTouchId.current !== null) return;
    const t = e.changedTouches[0];
    stickTouchId.current = t.identifier;
    stickOrigin.current = { x: t.clientX, y: t.clientY };
  };

  const handleStickMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === stickTouchId.current) {
        const dx = t.clientX - stickOrigin.current.x;
        const dy = t.clientY - stickOrigin.current.y;
        const maxR = 42;
        const dist = Math.hypot(dx, dy);
        const clampedX = dist > maxR ? (dx / dist) * maxR : dx;
        const clampedY = dist > maxR ? (dy / dist) * maxR : dy;
        setStickOffset({ x: clampedX, y: clampedY });
        engine?.setVirtualMove(clampedX / maxR, -clampedY / maxR);
      }
    }
  };

  const handleStickEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === stickTouchId.current) {
        stickTouchId.current = null;
        setStickOffset({ x: 0, y: 0 });
        engine?.setVirtualMove(0, 0);
      }
    }
  };

  const handleLookStart = (e: React.TouchEvent) => {
    if (lookTouchId.current !== null) return;
    const t = e.changedTouches[0];
    lookTouchId.current = t.identifier;
    lastLookPos.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lastLookPos.current.x;
        const dy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
        engine?.addVirtualLook(dx * 1.4, dy * 1.4);
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none">
      {/* Right-half Touch Look Area */}
      <div
        className="absolute right-0 top-14 bottom-24 w-1/2 pointer-events-auto"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
      />

      {/* Left Virtual Movement Thumbstick */}
      <div
        className="absolute left-6 bottom-10 w-28 h-28 rounded-full border-2 border-white/25 bg-black/45 flex items-center justify-center pointer-events-auto"
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
      >
        <div
          className="w-12 h-12 rounded-full bg-amber-400/80 border border-white/50 shadow-lg"
          style={{ transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)` }}
        />
      </div>

      {/* Right Action Cluster */}
      <div className="absolute right-5 bottom-8 flex flex-col items-end gap-2.5 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => engine?.toggleCameraMode()}
            className="px-3 py-2 rounded bg-[#0d1117]/90 border border-white/20 text-xs font-bold text-amber-400"
          >
            {hud.cameraMode}
          </button>
          <button
            type="button"
            onClick={() => engine?.triggerReload()}
            className="px-3 py-2 rounded bg-[#0d1117]/90 border border-white/20 text-xs font-bold text-slate-100"
          >
            RELOAD
          </button>
          <button
            type="button"
            onClick={() => engine?.triggerCrouch()}
            className="px-3 py-2 rounded bg-[#0d1117]/90 border border-white/20 text-xs font-bold text-slate-100"
          >
            CROUCH
          </button>
          <button
            type="button"
            onClick={() => engine?.triggerJump()}
            className="px-3 py-2 rounded bg-[#0d1117]/90 border border-white/20 text-xs font-bold text-slate-100"
          >
            JUMP
          </button>
        </div>

        <div className="flex items-center gap-3">
          {hud.interactPrompt && (
            <button
              type="button"
              onClick={() =>
                hud.interactPrompt?.type === 'loot'
                  ? engine?.triggerPickupNearest()
                  : engine?.triggerInteract()
              }
              className="px-4 py-3 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs shadow-lg"
            >
              {hud.interactPrompt.label}
            </button>
          )}

          <button
            type="button"
            onTouchStart={() => engine?.setVirtualAds(true)}
            onTouchEnd={() => engine?.setVirtualAds(false)}
            onMouseDown={() => engine?.setVirtualAds(true)}
            onMouseUp={() => engine?.setVirtualAds(false)}
            className="w-14 h-14 rounded-full bg-[#0d1117]/90 border-2 border-sky-400/70 text-xs font-bold text-sky-300"
          >
            AIM
          </button>

          <button
            type="button"
            onTouchStart={() => engine?.setVirtualFire(true)}
            onTouchEnd={() => engine?.setVirtualFire(false)}
            onMouseDown={() => engine?.setVirtualFire(true)}
            onMouseUp={() => engine?.setVirtualFire(false)}
            className="w-16 h-16 rounded-full bg-amber-500/90 border-2 border-amber-300 text-xs font-extrabold text-slate-950 shadow-xl"
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
};
