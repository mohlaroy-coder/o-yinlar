import React from 'react';
import { AmmoType, HudSnapshot, LootItemData } from '../game/types';
import { WEAPON_SPECS } from '../game/weapons';

interface InventoryOverlayProps {
  hud: HudSnapshot;
  onPickupItem: (uid: string) => void;
  onSelectSlot: (slot: 0 | 1 | 2 | 3) => void;
  onUseConsumable: (kind: 'medkit' | 'firstaid' | 'bandage' | 'energy') => void;
  onClose: () => void;
}

export const InventoryOverlay: React.FC<InventoryOverlayProps> = ({
  hud,
  onPickupItem,
  onSelectSlot,
  onUseConsumable,
  onClose,
}) => {
  const { inventory, nearbyLoot } = hud;
  const ammoEntries = Object.entries(inventory.ammo) as Array<[AmmoType, number]>;

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-[#0e1218] border border-white/15 rounded-lg p-5 shadow-2xl grid grid-cols-1 md:grid-cols-3 gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Proximity Loot */}
        <div className="flex flex-col border border-white/10 rounded bg-[#131820] p-3 max-h-[460px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <h3 className="font-display text-sm font-bold tracking-wider text-amber-400">
              VICINITY LOOT
            </h3>
            <span className="text-xs text-slate-400 font-mono-tabular">{nearbyLoot.length} items</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {nearbyLoot.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                No loot nearby. Enter buildings or approach crates.
              </p>
            ) : (
              nearbyLoot.map((item: LootItemData) => (
                <button
                  key={item.uid}
                  type="button"
                  onClick={() => onPickupItem(item.uid)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#1b222d] hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/50 text-left transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{item.name}</div>
                    <div className="text-[11px] text-slate-400 capitalize">{item.category}</div>
                  </div>
                  <span className="text-xs font-mono-tabular text-amber-400 font-semibold">
                    {item.quantity > 1 ? `x${item.quantity}` : 'Take'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center: Equipped Gear & Weapons */}
        <div className="flex flex-col border border-white/10 rounded bg-[#131820] p-3">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
            <h3 className="font-display text-sm font-bold tracking-wider text-slate-100">
              LOADOUT & ARMOR
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Close (Tab)
            </button>
          </div>

          {/* Armor Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-2.5 rounded bg-[#1a2029] border border-white/10">
              <div className="text-[11px] text-slate-400">Helmet</div>
              <div className="text-sm font-display font-bold text-slate-100">
                {inventory.helmetLevel > 0 ? `Level ${inventory.helmetLevel}` : 'None'}
              </div>
              <div className="text-[11px] font-mono-tabular text-amber-400">
                {inventory.helmetLevel > 0 ? `${Math.round(inventory.helmetDurability)} HP` : '—'}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#1a2029] border border-white/10">
              <div className="text-[11px] text-slate-400">Armor Vest</div>
              <div className="text-sm font-display font-bold text-slate-100">
                {inventory.vestLevel > 0 ? `Level ${inventory.vestLevel}` : 'None'}
              </div>
              <div className="text-[11px] font-mono-tabular text-amber-400">
                {inventory.vestLevel > 0 ? `${Math.round(inventory.vestDurability)} HP` : '—'}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#1a2029] border border-white/10">
              <div className="text-[11px] text-slate-400">Backpack</div>
              <div className="text-sm font-display font-bold text-slate-100">
                {inventory.backpackLevel > 0 ? `Level ${inventory.backpackLevel}` : 'Standard'}
              </div>
              <div className="text-[11px] text-slate-400">Tactical</div>
            </div>
          </div>

          {/* Weapons */}
          <div className="space-y-2 flex-1">
            {[0, 1, 2].map((slotIdx) => {
              const w = inventory.weapons[slotIdx as 0 | 1 | 2];
              const spec = w ? WEAPON_SPECS[w.id] : null;
              const isActive = inventory.activeSlot === slotIdx;
              return (
                <button
                  key={slotIdx}
                  type="button"
                  disabled={!w}
                  onClick={() => onSelectSlot(slotIdx as 0 | 1 | 2)}
                  className={`w-full p-2.5 rounded border text-left transition-colors ${
                    isActive
                      ? 'bg-amber-500/15 border-amber-400'
                      : 'bg-[#1a2029] border-white/10 hover:border-white/25'
                  } ${!w ? 'opacity-50 cursor-default' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      [{slotIdx + 1}] {spec ? spec.name : slotIdx === 2 ? 'Sidearm Empty' : 'Primary Empty'}
                    </span>
                    {spec && w && (
                      <span className="text-xs font-mono-tabular text-amber-400">
                        {w.ammoInMag} / {inventory.ammo[spec.ammoType] || 0}
                      </span>
                    )}
                  </div>
                  {spec && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {spec.category} · {spec.ammoType} · {spec.damage} DMG
                    </div>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              disabled={inventory.weapons[3] <= 0}
              onClick={() => onSelectSlot(3)}
              className={`w-full p-2.5 rounded border text-left transition-colors ${
                inventory.activeSlot === 3
                  ? 'bg-amber-500/15 border-amber-400'
                  : 'bg-[#1a2029] border-white/10 hover:border-white/25'
              } ${inventory.weapons[3] <= 0 ? 'opacity-50 cursor-default' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">[4] Frag Grenade</span>
                <span className="text-xs font-mono-tabular text-amber-400">x{inventory.weapons[3]}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Right: Medical Supplies & Ammunition */}
        <div className="flex flex-col border border-white/10 rounded bg-[#131820] p-3">
          <h3 className="font-display text-sm font-bold tracking-wider text-slate-100 pb-2 mb-2 border-b border-white/10">
            MEDICAL & AMMO
          </h3>

          <div className="space-y-1.5 mb-4">
            <button
              type="button"
              disabled={inventory.medkits <= 0}
              onClick={() => onUseConsumable('medkit')}
              className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#1b222d] hover:bg-emerald-500/20 border border-white/10 disabled:opacity-40"
            >
              <span className="text-xs text-slate-100 font-medium">[7] Med Kit (Full 100 HP)</span>
              <span className="text-xs font-mono-tabular text-emerald-400">x{inventory.medkits}</span>
            </button>
            <button
              type="button"
              disabled={inventory.firstAids <= 0}
              onClick={() => onUseConsumable('firstaid')}
              className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#1b222d] hover:bg-emerald-500/20 border border-white/10 disabled:opacity-40"
            >
              <span className="text-xs text-slate-100 font-medium">[8] First Aid Kit (To 75 HP)</span>
              <span className="text-xs font-mono-tabular text-emerald-400">x{inventory.firstAids}</span>
            </button>
            <button
              type="button"
              disabled={inventory.bandages <= 0}
              onClick={() => onUseConsumable('bandage')}
              className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#1b222d] hover:bg-emerald-500/20 border border-white/10 disabled:opacity-40"
            >
              <span className="text-xs text-slate-100 font-medium">[9] Bandage (+15 HP)</span>
              <span className="text-xs font-mono-tabular text-emerald-400">x{inventory.bandages}</span>
            </button>
            <button
              type="button"
              disabled={inventory.energyDrinks <= 0}
              onClick={() => onUseConsumable('energy')}
              className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#1b222d] hover:bg-sky-500/20 border border-white/10 disabled:opacity-40"
            >
              <span className="text-xs text-slate-100 font-medium">[0] Energy Drink (+Boost)</span>
              <span className="text-xs font-mono-tabular text-sky-400">x{inventory.energyDrinks}</span>
            </button>
          </div>

          <h4 className="text-xs font-semibold text-slate-400 mb-2">Ammunition Reserve</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {ammoEntries
              .filter(([t]) => t !== 'Grenade')
              .map(([ammoType, count]) => (
                <div
                  key={ammoType}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#1a2029] border border-white/5 text-xs"
                >
                  <span className="text-slate-300">{ammoType}</span>
                  <span className="font-mono-tabular text-amber-400 font-semibold">{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
