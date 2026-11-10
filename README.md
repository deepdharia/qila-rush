# 🏰 QILA RUSH (किला रश)
> **Epic 3D Indian Medieval Fortress-War Crowd Shooter**  
> *Built with TypeScript, Three.js, and Vite.*

---

## ⚔️ Game Overview

**QILA RUSH** is an original, AAA-inspired 3D mobile crowd-shooter set in a majestic medieval Indian Rajput/Mughal fortress. Inspired by the addictive forward-advancing crowd mechanics of viral mobile advertisements, players command a loyal Blue Indian Defender Army charging down the sandstone causeway of a grand fort.

Defeat incoming waves of the red invading army, make strategic choices through **Multiplier Gates**, obliterate **Destructible Fort Barricades** with arrow volleys to unlock legendary weapon upgrades, call in devastating **Topkhana (Royal Cannon) Bombardments**, and face off in an epic duel against **Commander Sher Khan** at the royal courtyard!

---

## 🎮 Core Features & Mechanics

1. **Squad Crowd Simulation & Dynamic Formations**:
   - Start with an elite squad of 8 Indian warriors.
   - Dynamic phyllotaxis crowd spacing algorithm keeps the army tightly grouped, organic, and visually readable up to 120+ units.
   - Real-time squad recalculation upon gate passes or combat casualties.

2. **Multiplier & Recruitment Gates**:
   - Carved Indian sandstone *Torana* archways with shimmering energy portals.
   - Strategic split choices: `+5` vs `+10`, `×2` vs `+15`, `×3` vs `+25`, etc.
   - Instant visual and audio reinforcement with floating banners and particle chimes.

3. **Breakable Fort Barriers & Gate Portcullises**:
   - Heavy iron-studded timber barricades with visible floating 3D HP counters (`HP: 50`, `HP: 90`, `HP: 160`).
   - Projectile damage counts down barrier HP in real time.
   - Shattering barriers unlocks game-changing upgrades:
     - **🔥 Flaming Arrows**: Bonus damage + fiery splash radius.
     - **🏹 Double Volley**: Double arrow output for massive crowd control.
     - **💣 Topkhana Cannon Ready**: Instant reload of the royal cannon artillery!

4. **Topkhana Special Ability**:
   - Royal bronze siege cannon bombardment button on the mobile HUD with a circular cooldown meter.
   - Fires 3 high-explosive cannonballs into dense enemy formations or the boss arena.

5. **Multi-Phase Boss Encounter (Commander Sher Khan)**:
   - Imposing 3.5x scale warlord clad in golden Mughal-Rajput plate armor and crowned spiked helmet, wielding dual flaming scimitars.
   - Phase 1: Sweeping blade cleaves.
   - Phase 2: Ground Slam shockwave attack with dynamic red telegraph warning circle.
   - Phase 3: Enrage mode with rapid charges and reinforcement summons.

6. **Procedural Indian 3D Art & Architecture**:
   - Sandstone causeway bridge over a deep rocky canyon.
   - Traditional *Chhatri* pavilions (domed pillared canopies with gold *Kalasa* finials), massive bastion watchtowers, and *Darwaza* gateways.
   - Fluttering *Kesariya* (saffron) and royal blue battle pennants waving in the desert wind.
   - Atmospheric warm golden-hour lighting, shadows, and desert dust particles.

7. **Zero-Latency Procedural Indian Battle Audio**:
   - High-fidelity Web Audio API procedural synthesis with zero external audio asset dependencies.
   - Authentic Indian battle percussion: *Dhol* (deep membrane thuds), *Nagada* & *Tasha* rolls, and dynamic tempo acceleration during boss combat.
   - Arrow releases, impacts, wood splintering, cannon explosions, boss roars, and triumphant *Raag Bhoopali* fanfares.

---

## 🕹️ Controls

| Platform | Control | Action |
| :--- | :--- | :--- |
| **Mobile** | **Touch Drag** (Left / Right) | Steer Blue Army laterally along the causeway |
| **Mobile** | **Tap TOPKHANA Button** | Launch Royal Cannon Bombardment |
| **Desktop** | **Mouse Drag** (Left / Right) | Steer Blue Army |
| **Desktop** | **A / D** or **Arrow Left / Right** | Steer Blue Army with Keyboard |
| **Desktop** | **Click TOPKHANA Button** | Launch Royal Cannon Bombardment |
| **Both** | **Pause (⏸️)** / **Sound (🔊)** / **Quality (⚡)** | Toggle game state, audio, and performance modes |

---

## 🛠️ Architecture & Tech Stack

```
qila-rush/
├── index.html               # Responsive Mobile & Desktop HUD, Canvas & Modals
├── package.json             # NPM package scripts & dependencies
├── tsconfig.json            # Strict TypeScript configuration
├── vite.config.ts           # Bundler config with relative base path
└── src/
    ├── main.ts              # Entry point bootstrap
    ├── utils/
    │   └── Constants.ts     # Game tuning parameters, speeds, road dimensions & colors
    ├── audio/
    │   └── SoundManager.ts  # Web Audio API procedural Indian percussion & SFX engine
    ├── entities/
    │   ├── SoldierModel.ts  # Stylized 3D Indian soldier procedural generator & animations
    │   ├── PlayerArmy.ts    # Squad manager, formation math, auto-targeting & firing
    │   ├── EnemyArmy.ts     # Enemy formations (v-shape, flank, line, cluster) & combat
    │   ├── BossEnemy.ts     # Commander Sher Khan boss model, AI, and ground slam attacks
    │   ├── Gates.ts         # Torana multiplier gates with dynamic canvas textures
    │   ├── Barriers.ts      # Breakable fort barriers with 3D real-time HP badges
    │   ├── Projectiles.ts   # Object-pooled ballistic arrows, fire arrows, and cannonballs
    │   └── ParticleSystem.ts# Pooled sparks, splinters, fireballs, and saffron flower petals
    ├── environment/
    │   └── FortressEnvironment.ts # Sandstone causeway, bastions, chhatris, gates & hills
    ├── game/
    │   ├── Game.ts          # Core conductor loop, state machine, wave spawner & collisions
    │   ├── CameraManager.ts # Elevated isometric camera with screen shake & boss framing
    │   └── InputManager.ts  # Responsive touch, mouse, and keyboard input handler
    └── ui/
        └── UIManager.ts     # HUD bindings, progress bar, boss HP, floating notifications
```

---

## 🚀 Running & Building

### 1. Development Server
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in any browser (or on your mobile device on the same local network).

### 2. Production Build
```bash
npm run build
```
Generates an optimized, tree-shaken static bundle in `dist/` ready for web deployment or packaging into Android WebView / Capacitor / Cordova.

### 3. Preview Production Build
```bash
npm run preview
```

---

## 📱 Mobile Optimization & Android Readiness

- **Fixed Timestep Simulation**: Physics and collision handling are locked with clamped delta time to prevent stutter or tunneling on low-end devices.
- **Resource Pooling**: Zero GC spikes during gameplay—projectiles, particles, and enemies are reused from pre-allocated memory pools.
- **Instanced Geometry Sharing**: Soldiers, armor pieces, weapons, and architectural pillars share cached Three.js geometries and materials.
- **Quality Fallback**: Toggle button (`⚡` / `🔋`) switches between soft directional shadows with high DPI and battery-saving standard resolution.
- **Orientation Adaptive**: Automatically adapts FOV and layout for both Portrait (68° FOV) and Landscape (55° FOV) mobile orientations.

---

## 📜 Credits & License

- **Game Design & Code**: Developed with Google Antigravity.
- **Visuals**: Original procedural Three.js geometry assets and canvas shaders. No third-party copyrighted assets.
- **Audio**: Original procedural Web Audio API synthesized Indian war percussion (Dhol, Nagada, Shehnai scales).
- **License**: MIT
