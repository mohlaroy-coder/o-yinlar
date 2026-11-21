# BATTLE ROYALE: SURVIVAL ZONE

A playable 3D Battle Royale tactical survival shooter built with **Three.js**, **React**, **TypeScript**, and **Web Audio API**.

## Features
- **Open-World 3D Island**: 1200m x 1200m island featuring Sosnovka Military Base, Pochinki City, Zharki Airport, Georgopol Harbor, Mylta Industrial Zone, Severny & Yasna Villages, Pine Forests, Stalber Peak, rivers, lakes, roads, and steel truss bridges.
- **Enterable Buildings**: Walk through doorways, explore interiors, look through windows, and loot weapons, ammo, armor, helmets, backpacks, and medical supplies.
- **FPP & TPP Camera Modes**: Switch seamlessly during gameplay with `V` or the HUD camera button, complete with dedicated 3D viewmodel arms/weapon in First-Person and smooth collision-aware orbit camera in Third-Person.
- **10 Realistic Weapons**: AKM, M416, SCAR-L, AWM, Kar98k, Micro UZI, UMP45, S1897 Shotgun, P92 Pistol, and Frag Grenades with recoil, spread, ADS sniper scope, reloading, and distinct synthesized audio.
- **5 Drivable Vehicles**: Off-road Jeep, Dacia Sedan, Tactical Motorcycle, Dune Buggy, and Pickup Truck with steering, acceleration, braking, and modulated engine audio.
- **100-Player Match Simulation**: Cargo airplane flyover, skydiving & parachute landing, Solo/Duo/Squad modes, intelligent AI combatants, shrinking Blue Zone across 6 phases, and full Match Statistics.
- **Dynamic Weather & Day/Night Cycle**: Clear, Sunset, Overcast, Rain (with 3D rain particles), and Night lighting modes plus Low/Medium/High/Ultra graphics presets.

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Build for production**:
   ```bash
   npm run build
   ```

## PC Controls
- `W, A, S, D` — Move / Steer Vehicle
- `Mouse` — Look / Aim
- `Left Click` — Shoot / Throw Grenade
- `Right Click` — Aim Down Sights (ADS / Scope)
- `Space` — Jump / Eject from Plane
- `Shift` — Sprint
- `C` — Crouch
- `R` — Reload
- `F` — Jump from Plane / Deploy Parachute / Enter & Exit Vehicle
- `E` — Pick Up Nearest Item
- `1, 2, 3, 4` — Switch Weapons & Grenades
- `V` — Switch FPP / TPP Camera
- `Tab` — Open Inventory & Vicinity Loot
- `M` — Full-Screen Tactical Map
- `7, 8, 9, 0` — Use Med Kit, First Aid, Bandage, Energy Drink

*(On-screen Mobile Touch Controls can also be enabled in Settings -> Controls.)*
