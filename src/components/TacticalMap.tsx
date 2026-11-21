import React, { useEffect, useRef } from 'react';
import { ISLAND_HALF, MAP_POIS, ROAD_SEGMENTS } from '../game/terrain';
import { HudSnapshot } from '../game/types';

interface TacticalMapProps {
  hud: HudSnapshot;
  fullScreen: boolean;
  onClose?: () => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({ hud, fullScreen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const scale = size / (ISLAND_HALF * 2);

    const toPx = (wx: number, wz: number): [number, number] => [
      (wx + ISLAND_HALF) * scale,
      (wz + ISLAND_HALF) * scale,
    ];

    // Ocean background
    ctx.fillStyle = '#0f2b3d';
    ctx.fillRect(0, 0, size, size);

    // Island landmass silhouette
    ctx.fillStyle = '#36462b';
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.5, size * 0.43, size * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highland tint around Stalber mountain
    const [mx, my] = toPx(240, -380);
    ctx.fillStyle = 'rgba(110, 115, 118, 0.55)';
    ctx.beginPath();
    ctx.arc(mx, my, 120 * scale, 0, Math.PI * 2);
    ctx.fill();

    // River East-West
    ctx.strokeStyle = '#164663';
    ctx.lineWidth = Math.max(4, 34 * scale);
    ctx.beginPath();
    for (let x = -470; x <= 470; x += 25) {
      const rz = 192 + Math.sin(x * 0.008) * 26;
      const [px, py] = toPx(x, rz);
      if (x === -470) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Lake
    const [lx, ly] = toPx(135, -130);
    ctx.fillStyle = '#164663';
    ctx.beginPath();
    ctx.arc(lx, ly, 44 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Roads & Bridges
    for (const seg of ROAD_SEGMENTS) {
      const [x1, y1] = toPx(seg.x1, seg.z1);
      const [x2, y2] = toPx(seg.x2, seg.z2);
      ctx.strokeStyle = seg.isBridge ? '#d97706' : '#575d66';
      ctx.lineWidth = Math.max(1.5, seg.width * scale);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // POI Markers & Labels
    for (const poi of MAP_POIS) {
      const [px, py] = toPx(poi.x, poi.z);
      ctx.fillStyle =
        poi.kind === 'military'
          ? 'rgba(245, 158, 11, 0.25)'
          : poi.kind === 'nature'
            ? 'rgba(34, 197, 94, 0.14)'
            : 'rgba(226, 232, 240, 0.22)';
      ctx.beginPath();
      ctx.arc(px, py, poi.radius * scale * 0.65, 0, Math.PI * 2);
      ctx.fill();

      if (fullScreen) {
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(poi.name, px, py + 4);
      }
    }

    // Vehicles (shown as small amber dots on full map or nearby on minimap)
    ctx.fillStyle = '#fbbf24';
    for (const v of hud.minimapVehicles) {
      const [vx, vy] = toPx(v.x, v.z);
      ctx.fillRect(vx - 1.5, vy - 1.5, 3, 3);
    }

    // Next Safe Zone (White circle)
    const [tx, ty] = toPx(hud.safeZone.targetCenterX, hud.safeZone.targetCenterZ);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = fullScreen ? 2 : 1.5;
    ctx.beginPath();
    ctx.arc(tx, ty, hud.safeZone.targetRadius * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Current Blue Zone (Blue circle)
    const [bx, by] = toPx(hud.safeZone.currentCenterX, hud.safeZone.currentCenterZ);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = fullScreen ? 2.5 : 1.8;
    ctx.beginPath();
    ctx.arc(bx, by, hud.safeZone.currentRadius * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Teammates
    for (const tm of hud.teammates) {
      if (!tm.alive) continue;
      const [mx2, my2] = toPx(tm.x, tm.z);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(mx2, my2, fullScreen ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Plane Icon if active
    if (hud.planePos.active) {
      const [apx, apy] = toPx(hud.planePos.x, hud.planePos.z);
      ctx.save();
      ctx.translate(apx, apy);
      ctx.rotate(-hud.planePos.yaw);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Player Arrow
    const [plx, ply] = toPx(hud.playerX, hud.playerZ);
    ctx.save();
    ctx.translate(plx, ply);
    ctx.rotate(-hud.playerYaw);
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#0b0e13';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, fullScreen ? -8 : -6);
    ctx.lineTo(fullScreen ? 6 : 4.5, fullScreen ? 6 : 4.5);
    ctx.lineTo(0, fullScreen ? 3 : 2);
    ctx.lineTo(fullScreen ? -6 : -4.5, fullScreen ? 6 : 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [hud, fullScreen]);

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <div
          className="bg-[#0e1218] border border-white/15 rounded-lg p-4 max-w-2xl w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display text-lg font-bold tracking-wide text-amber-400">
                ERANGEL TACTICAL MAP
              </h2>
              <p className="text-xs text-slate-400">
                Zone {hud.safeZone.phase} · {hud.safeZone.isShrinking ? 'Closing' : 'Next shrink'} in{' '}
                <span className="font-mono-tabular text-slate-200">{hud.safeZone.timeRemainingSec}s</span> ·
                Current Sector: <span className="text-slate-200">{hud.currentLocationName}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-white/10"
            >
              Close (M)
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={620}
            height={620}
            className="w-full aspect-square rounded border border-white/10"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="text-amber-400">▲ You</span>
            <span className="text-emerald-400">● Squadmate</span>
            <span className="text-blue-400">◯ Blue Zone</span>
            <span className="text-white">◯ Safe Zone</span>
            <span className="text-amber-300">■ Vehicles</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117]/90 border border-white/15 rounded overflow-hidden shadow-lg">
      <canvas ref={canvasRef} width={168} height={168} className="block w-[156px] h-[156px]" />
      <div className="px-2 py-1 flex items-center justify-between text-[11px] border-t border-white/10 bg-[#0a0d12]">
        <span className="truncate max-w-[100px] text-slate-300">{hud.currentLocationName}</span>
        <span className="font-mono-tabular text-amber-400 font-semibold">[M]</span>
      </div>
    </div>
  );
};
