# Qila Rush — Planner 2: Mobile Fit & Smooth Performance

**Role:** Planner 2 of 3 — mobile fit & smooth performance. **PLAN ONLY. No code changed.**
**Date:** 2026-11-27. **Branch:** `doomfall/engagement-loops` (local HEAD `f494f15`).
**Stack:** three.js 0.174.0 + TypeScript 5.8.2 + Vite 6.2.0. **Target:** mobile web first, Capacitor Play Store wrap second. Android-first, mid-range Android phones.

**Reference:** Top Lords (GAME SPARK PTE. LTD., Google Play 4.7★, 106K reviews, 5M+ downloads) — Mob Control-style clip: vertical portrait 3D lane, cannon firing a stream of tiny soldiers, "x99" multiplier gate, upgraded cannons, huge enemy crowd led by an armoured boss. Bold, chunky, readable at a glance, smooth motion, hundreds of tiny soldiers on screen.

**Deep's bar:** "everything bold, fit in mobile, works smoothly."

---

## 0. What is true today (verified in the code — read, not guessed)

### 0.1 The #1 problem: the crowd is draw-call bound, not triangle bound

Counted from `src/entities/SoldierModel.ts`: **one soldier is ~20 individual `THREE.Mesh` objects** (torso, sash, chest sash, waist cloth, 2 shoulder pads, head, turban group of 5 meshes, quiver, left arm + 3-piece shield, right arm + bow/spear, 2 legs × 2 meshes). Enemy soldiers add 4 more (marker sprite, ground ring, HP bar bg + fg).

| Crowd | Soldiers | Meshes ≈ | Draw calls ≈ |
|---|---|---|---|
| Player army (max) | 120 (`MAX_SOLDIER_COUNT`) | ~2,400 | ~2,400 |
| Enemy pool | 90 (fixed pool, Phase 1 fix) | ~2,160 | ~2,160 |
| Projectiles pool | 200 × 3 meshes (mostly invisible) | 600 | ~0–60 active |
| Particles pool | 350 individual meshes | 350 | 0–350 active |
| Environment (built once) | — | ~58 | ~58 |
| Gates / barriers / fortifications / boss | — | ~70 | ~70 |
| **Worst-case combat total** | **~210 soldiers** | **~5,600** | **~4,500+** |

Published mobile budgets (three.js perf guides): **<100 draw calls on mobile, <500 on desktop**; triangles <200k low-end mobile, ~1M desktop fine. Qila Rush's triangles are tiny (low-poly 6–12 segment geometry) — the GPU is idle while the CPU drowns in draw calls. **This is the single biggest performance fact in the project.** Nothing else matters until the crowd is instanced.

Good news already in place: geometries and materials are **shared statics** in `SoldierModelFactory` (one geometry/material per part, reused by every soldier) — so the instancing conversion reuses the same assets; only the per-soldier mesh objects must go.

### 0.2 Per-frame allocations in the hot loop (the sibling project's lesson)

The NCR Drive fix (hoist per-frame allocations to scratch fields) applies here verbatim. Allocations found, every frame, during combat:

- `PlayerArmy.handleAutoShooting` (`PlayerArmy.ts`): `new THREE.Vector3()` per shooter per volley, plus `aimPos.clone()` twice per arrow (volley + double-volley + volley-extra paths).
- `Projectiles.update` (`Projectiles.ts`): `p.mesh.position.clone().add(p.velocity)` **per active projectile per frame**, plus `p.mesh.position.clone()` in `deactivate()` for cannon impacts.
- `EnemyArmy` (`EnemyArmy.ts`): `.clone()` in `applyDamage`, `killEnemy`, `spawnDustBurst` / `spawnFloatingText` call sites, plus `new THREE.Vector3(0, 2.6, 0)` inline.
- `getActiveTargets()` and `getActiveProjectiles()` allocate a fresh array (and the target list is rebuilt every frame for the shooting scan).

On a mid-range Android this is GC churn → frame hitches exactly when the screen is busiest.

### 0.3 Renderer defaults are desktop defaults

`Game.ts` constructor (lines ~296–304): `antialias: true`, `setPixelRatio(min(dpr, 2))`, `shadowMap.enabled = true`, `PCFSoftShadowMap`, sun shadow map **2048×2048** (`FortressEnvironment.ts:84–85`), one directional light (intensity 2.6) + one hemisphere light (0.9). `AutoQualityScaler` exists and is good (3 tiers: DPR 2/1.5/1, shadows on/off; steps down after 3 s sustained <45 fps, up after 5 s >57 fps; manual ⚡ toggle wins) — **but it starts at level 0 (high) on every phone and only reacts after the player has already suffered 3 seconds of stutter.** Starting tier must be device-aware.

### 0.4 Particles are 350 individual meshes

`ParticleSystem.ts`: pool of 350 `THREE.Mesh` + 24 floating-text sprites (each with its own canvas + texture). Every active particle is a draw call. A 100-spark burst is ~100 draw calls. There is no cap on simultaneous active particles other than the pool size.

### 0.5 Layout: no responsive rules, no safe areas, one undersized button

`index.html` (43 KB, all UI inline):

- **Zero `@media` queries. Zero `env(safe-area-inset-*)`.** Nothing adapts to screen width; nothing clears the notch, status bar, or home-indicator/gesture bar.
- `viewport-fit=cover` and `user-scalable=no` **are** present — the meta tag is right, the CSS never uses it.
- Fixed-width centered containers (`max-width: 320/420/480/560px`) — survivable on a 360 px phone, untested on 320 px and on tall 19.5:9+ screens.
- `.icon-btn` (sound / quality / pause) is **42×42 px — below the 48 dp Android / 44 pt Apple minimum.** The cannon `.ability-btn` is 78×78 px (good, keep).
- `.hud-bottom` padding is `16px 20px 24px` — fixed, no safe-area bottom, so the cannon button can sit under the gesture bar on edge-to-edge Android.
- `#boss-hud` is absolutely positioned at `top: 104px` — on a notched phone it can collide with the status bar.
- `UIManager.ts`: a single delegated `document` click listener on `[data-action]` — tap works, but there is no `:active`-state audit across all buttons and no `pointerdown` fast-path; `touch-action: none` is set on the canvas.
- `CameraManager.onResize` already adapts FOV: **portrait 68, landscape 55** — the 3D side is ahead of the DOM side.

### 0.6 Input: drag-to-steer only, no fire button (by design)

`InputManager.ts`: pointer drag (mouse + touch) maps X-delta to `currentTargetX`; keyboard arrows as fallback. Shooting is automatic. That is the right Mob Control shape (one input: steer), but it has phone-specific gaps: only `touches[0]` is tracked, the `touchmove` handler never calls `preventDefault()` (it relies on `touch-action: none` in CSS — correct, but fragile if that rule is ever lost), and there is no multi-touch story (steer-drag + cannon-tap at the same time). Haptics exist and are guarded correctly (`Game.ts:1360` — gameplay only, muted = silent, desktop = no-op, `navigator.vibrate`).

### 0.7 No measurement exists anywhere

No `renderer.info` read, no FPS overlay, no frame-time logging, no heap tracking. The playtest gate has never had a number attached to it.

### 0.8 Load & offline: small but not offline

`dist/` is **684 KB total** (JS bundle ~650 KB — three.js dominates). `vite.config.ts` already sets `base: './'` (Capacitor-ready) and `assetsInlineLimit: 4096`. **No service worker, no manifest, no offline behaviour.** Google Fonts (Cinzel, Rajdhani, Yatra One) are render-blocking external requests. No `visibilitychange` handler — backgrounding the tab/app does not pause the game.

---

## 1. Portrait mobile-first layout — exact rules

Baseline test sizes: **360×800** (the floor), **390×844**, **412×915**. All rules are written for these; desktop is the exception, not the rule.

### 1.1 The three zones (portrait)

| Zone | Content | Rule |
|---|---|---|
| **Top (read-only)** | Status bar clearance, army count, level progress, sound / quality / pause | `padding-top: max(8px, env(safe-area-inset-top))`. Top bar height ≤ 56 px. Nothing interactive here is pressed under time pressure. |
| **Middle (the game)** | Full-bleed 3D canvas only | No DOM overlays in the central 60% of the screen except transient banners (floating `+10 WARRIORS!`, combo popups) that auto-dismiss. The 3D camera already widens to FOV 68 in portrait (`CameraManager.onResize`) — keep, and verify the road edges stay inside the frame at 360 px wide. |
| **Bottom (thumb zone)** | Cannon button, commander button, buff tray | `padding-bottom: max(24px, env(safe-area-inset-bottom) + 12px)`. All gameplay actions live in the **bottom 40%** of the screen. |

### 1.2 What changes, file by file

- `index.html` CSS — add a `:root` safe-area contract and apply it everywhere a bar touches a screen edge:
  ```css
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
    --sar: env(safe-area-inset-right, 0px);
  }
  ```
  Top bar: `padding-top: calc(var(--sat) + 8px)`. Bottom HUD: `padding-bottom: calc(var(--sab) + 16px)`. Modals: `padding-bottom: calc(var(--sab) + 20px)`. (Capacitor 8's SystemBars injects `--safe-area-inset-*` variables on Android; the `var(--x, env(...))` fallback pattern keeps this working on both Capacitor 8 and 9 — see §5.)
- `index.html` CSS — first real responsive layer (there is none today): one breakpoint at `max-width: 480px` (phone) and one at `max-height: 700px` (short phones). Phone rules: shrink modal padding, reduce title fonts ~15%, stack the victory/defeat stat grids to 2 columns, make the level-map a vertical scrolling list of ≥64 px tall cards (today it is a fixed grid — verify on 360 px; if cards overflow, they stack).
- `.icon-btn` **42 px → 48 px** (hit area; the visible circle may stay 42 px with an invisible 3 px margin — Material minimum is 48 dp, Apple is 44 pt; 48 px satisfies both).
- `#boss-hud` — replace fixed `top: 104px` with `top: calc(var(--sat) + 108px)` so it never collides with the notch.
- Modals become **bottom sheets on phones**: slide up from the bottom, thumb-close button at the bottom, max-height 86 vh with internal scroll — not centered dialogs that a thumb cannot dismiss. (Start screen, shop, daily, pause, victory, defeat, chest — all in `index.html` + `UIManager.ts` `showScreen`.)
- Text floor: body ≥ 12 px, numbers that matter (army count, coins, multiplier) ≥ 28 px bold. The Top Lords readability rule: **the army count and the gate multiplier must be readable at arm's length in one glance.** Gate numbers today are 3D-world text — verify legibility at 360 px; if they blur, enlarge the gate canvas textures (`CanvasTextures.ts`) or move the multiplier into a DOM chip above the gate.

### 1.3 What breaks today on a narrow screen (checklist for Phase 1)

1. Top bar can sit under the notch/status bar (no safe-area).
2. Cannon button can sit under the Android gesture bar (fixed 24 px bottom padding).
3. Icon buttons are 42 px (below minimum tap target).
4. Level map / shop / daily modals are fixed-width centered dialogs — on a 320–360 px phone they can overflow horizontally or crowd the close action out of thumb reach.
5. Boss HUD fixed at 104 px from top.
6. No landscape handling at all: rotating the phone keeps portrait FOV logic only if `onResize` fires — it does, but the DOM layout was never designed for landscape. **Recommendation: lock portrait** (see §6, decision D2).

---

## 2. Touch controls — one thumb, no precision

### 2.1 The control map (final)

| Action | Control | Where | Size |
|---|---|---|---|
| Steer army | Drag anywhere on the 3D canvas (left/right) | Whole canvas | Full-width drag; a full-screen swipe crosses the road exactly once (see 2.2) |
| Fire cannon (Topkhana) | Big round DOM button | Bottom-right, thumb zone | 78 px (keep) + cooldown radial overlay (exists) + haptic tick on ready and on fire |
| Commander ability (war horn / rally) | Second round DOM button | Bottom-right, left of cannon | 64 px, appears only when equipped (already `display:none` until then — keep) |
| Pause | Icon button | Top-right | 48 px hit area (up from 42) |
| Sound / quality | Icon buttons | Top bar | 48 px hit area |
| Everything else (shop, map, daily, chest) | Full-width buttons in bottom-sheet modals | Bottom sheet | ≥ 48 px tall, full width |

### 2.2 Steering tuning for phones

- **Sensitivity by screen width:** today `applyDelta` maps `deltaPx / screenWidth × ROAD_WIDTH × 1.35`. On a 360 px phone that is correct in spirit; verify on device that one full-width swipe moves the army edge-to-edge exactly once — if it overshoots, lower the 1.35 factor on narrow screens.
- **Dead zone:** ignore drags under ~6 px so a resting thumb does not jitter the army.
- **Release behaviour:** keep current behaviour (army holds its X on release — no auto-centre). Mob Control holds position too; auto-centre would fight the player.
- **Multi-touch:** unify mouse + touch into **Pointer Events** (`pointerdown` / `pointermove` / `pointerup` with `pointerId` tracking) in `InputManager.ts`, replacing the separate mouse/touch handlers. The steering pointer is the one that started on the canvas; the cannon tap is a separate DOM pointer — they must not cancel each other. Today only `touches[0]` is tracked, so a second finger can hijack steering.
- **No hover anywhere:** audit every `:hover` rule in `index.html` and give it an `:active` twin. Buttons must give instant visual + haptic feedback on `pointerdown`, not on `click` (click can lag a frame on some Android WebViews).

### 2.3 Accidental-input guards (all cheap, all in `index.html` / `Game.ts`)

- `overscroll-behavior: none` on `html, body` (kill pull-to-refresh).
- `-webkit-touch-callout: none; user-select: none` on the game container (kill long-press menus / text selection).
- `contextmenu` prevention on the canvas.
- `touch-action: none` already on the canvas — keep, and add it to the ability buttons so a cannon tap never scrolls.
- **No double-tap zoom:** already covered by `user-scalable=no` + `touch-action: none`; verify on device.

---

## 3. Performance budget — the numbers, and how to hit them

### 3.1 Targets

| Metric | Desktop target | Mid-range Android target | Floor (must never breach) |
|---|---|---|---|
| Frame rate | 60 fps | 60 fps where possible, **30 fps sustained floor** | No sustained dip below 28 fps in a full-crowd fight |
| Frame time p95 | ≤ 16.7 ms | ≤ 33 ms | p95 ≤ 40 ms |
| Jank (frames > 50 ms) | < 0.5% of gameplay frames | < 1% | < 2% |
| Draw calls (combat) | ≤ 150 | **≤ 80** | ≤ 120 |
| Draw calls (menu) | ≤ 60 | ≤ 40 | ≤ 60 |
| Triangles | ≤ 1M | **≤ 250k** | ≤ 400k |
| Texture memory | ≤ 128 MB | **≤ 64 MB** | ≤ 96 MB |
| JS heap (4 GB device) | — | < 150 MB, flat over a 10-min session | No growth > 5 MB / 10 min |
| Battery | — | < 10% drain / 30 min gameplay | Measure, don't guess |

### 3.2 The techniques, in the order that pays

**P0 — Measure first (Phase 0).** Add a `?perf=1` debug overlay reading `renderer.info.render` (`calls`, `triangles`), `renderer.info.memory` (`geometries`, `textures`), FPS + frame-time avg/p95, and `performance.memory.usedJSHeapSize` (Chromium only). No gameplay change. Without this, every later phase is guesswork.

**P1 — Quick wins, no architecture change (Phase 1).**
- Start phones at quality level 1 (medium: shadows off, DPR cap 1.5), not level 0. `AutoQuality` may step up on strong phones; it must never start high on a phone. Detect phone by `matchMedia('(pointer: coarse)')` + screen width, not by user-agent sniffing.
- `antialias: false` on phones (MSAA is one of the most expensive mobile GPU features; at DPR 1.5 the jaggies are barely visible on a 6-inch screen). Keep AA on desktop.
- Shadow map 2048 PCFSoft → **1024 PCF** on phones; shadows off entirely on the low tier (already in `AutoQuality` — extend it to also shrink the map size, which it cannot do today).
- Cap active particles (e.g. 120 simultaneous) and shrink the pool from 350 meshes to a `THREE.Points` system (§3.3).
- Kill the per-frame allocations in §0.2 (scratch `Vector3`s, reuse the target list, reuse the projectile list).
- `visibilitychange` → auto-pause (see §4.3).

**P2 — Instance the crowd (Phase 2, the big one).** Target: crowd from ~4,500 draw calls → **< 60**.
- One `InstancedMesh` per soldier body part, sharing the existing geometries/materials from `SoldierModelFactory`: torso, head, turban (base + cone + plume as one merged part or three instanced meshes), 2 arms, 2 legs, shield, bow/spear, quiver. Realistic count: ~10 instanced meshes per faction → ~20 draw calls for 210 soldiers.
- Per-instance colour via `setColorAt` for faction robes, war-gear skins, and hit-flash (replaces per-mesh material swaps).
- Procedural animation stays procedural: `animateSoldier` already computes rotations per soldier — compose those into per-instance matrices instead of rotating `Group` children. The animation math does not change; only where the result is written changes.
- Enemy telegraphs (marker sprite, ground ring, HP bar) leave individual meshes: HP bars become one instanced quad set (only elites have them), rings become one instanced ring mesh, markers become a single `THREE.Points`/sprite atlas or a DOM-free canvas overlay. Budget: ≤ 6 draw calls for all telegraphs.
- Projectiles: 200 pooled groups of 3 meshes → **2 `InstancedMesh`** (arrow shaft+tip as one merged geometry, cannonball as one). Arrows are identical geometry — this is the textbook instancing case.
- Particles: 350 meshes → **one `THREE.Points`** with per-point size/colour/alpha attributes. One draw call for every spark, dust mote, and ember.
- **⚠️ Cross-planner flag (for the leader): instancing vs the KayKit character swap.** KayKit heroes are skinned, rigged GLB characters — skeletal animation cannot be naively instanced, and one shared gradient atlas breaks the per-skin recolour that `applyPlayerSkin` does today by mutating shared materials. Recommendation: **instance the procedural soldiers first (Phase 2 here); use KayKit only for the boss / commander hero, or defer the KayKit crowd swap until after instancing proves out.** If the leader chooses KayKit crowd anyway, the crowd budget must be re-planned around `BatchedMesh` + baked vertex animation or GPU skinning with a small set of shared skeletons — a different, larger job. Do not start both at once.

**P3 — Environment batching + LOD (Phase 3).**
- Merge the static fortress dressing (parapets, bastions, towers, arches, domes — `FortressEnvironment.ts`, built once already) into merged `BufferGeometry` per material, or a `BatchedMesh`. The environment is ~58 meshes today; target ≤ 8 draw calls.
- `MeshStandardMaterial` → `MeshLambertMaterial` for static geometry on phones (cheaper shader; the visual difference on flat sandstone is negligible).
- Shadow casters: only the near-field set (parapets, towers, soldiers within ~40 m of the camera) casts shadows; everything else `castShadow = false`. Today 19 meshes cast shadows with a 2048 map.
- LOD: towers/bastions get a low-poly tier beyond ~60 m; the far fortress silhouette becomes a single textured plane. Fog already exists (`FOG: 0xd9b78c`) — use it as the LOD curtain.
- Gates/barriers/fortifications are rebuilt per level — verify they dispose cleanly (no geometry leak across level loads; check `renderer.info.memory.geometries` stays flat across 5 level loads in the Phase 0 overlay).

**P4 — Load & offline (Phase 4).**
- Fonts: self-host subsetted woff2 for Cinzel / Rajdhani / Yatra One (Latin + Devanagari subsets only) instead of render-blocking Google Fonts requests.
- Lazy-load: music MP3 and any GLB behind the first user gesture; the menu must render before audio exists.
- Keep the blocking load under ~1 MB (dist is 684 KB today — already inside; the risk is growth, so add a CI-style size check: fail the build if `dist/` exceeds 1 MB).
- Service worker + manifest for offline-first (see §4).

**P5 — Capacitor wrap (Phase 5).** See §5.

### 3.3 How to measure it on a real phone (the protocol)

No measurement exists today — this protocol is the gate. It runs after **every** phase, on the floor device (§6, decision D1).

**The overlay.** `?perf=1` enables a small DOM overlay (top-left, monospace, updates 2×/s): FPS (avg + 1% low), frame-time avg / p95, `calls`, `triangles`, `geometries`, `textures`, JS heap MB (Chromium), current quality level. It must be toggleable without rebuilding (URL flag + a hidden 5-tap on the version label).

**The scenarios** (same every run, so numbers compare):

| # | Scenario | Duration | What it stresses |
|---|---|---|---|
| S1 | Menu idle (army behind menu) | 60 s | Baseline, heap flatness |
| S2 | Level 1 full run | ~50 s | Normal combat |
| S3 | Level 22+ wave overlap (max crowd: 120 player + 90 enemy) | One full level | **The worst case — the gate scenario** |
| S4 | Boss arena | One boss fight | Boss meshes + slow-mo + shake |
| S5 | Endless Siege, wave 10 | 3 min | Sustained load, thermal behaviour |
| S6 | 10-min soak (S2 looped) | 10 min | Memory leak + thermal throttle check |

**The devices.** Floor device (decision D1 — propose Redmi Note 11 / Galaxy A14 class: Snapdragon 680 / Helio G85, 4 GB RAM, Android 11+, 720p–1080p) + one better device (e.g. Pixel 7a / any Snapdragon 7-series). Record model, Android version, Chrome/WebView version every run.

**Capture.** Screenshot the perf overlay at the end of each scenario + copy the overlay's text log (a "copy stats" button writes the run to the clipboard as plain text for pasting back). Where available, also take a Chrome remote-inspect trace (`chrome://inspect` → Performance) for one S3 run per phase.

**Pass criteria (the gate).** All of: p95 frame time ≤ 33 ms on the floor device in S3; draw calls ≤ 80 in S3; no heap growth > 5 MB across S6; no sustained dip below 28 fps in any scenario; battery drain < 10% / 30 min in S5. If any criterion fails, the phase is not done — tune, don't ship.

---

## 4. Load & runtime behaviour

### 4.1 First load
- Budget: **blocking load < 1 MB, time-to-first-frame < 2 s on Wi-Fi, < 3 s on 4G.** dist is 684 KB today — inside budget; protect it with a build-size check.
- The menu must be interactive before the 3D scene finishes initialising: render the DOM menu first, initialise the renderer behind it (today `Game` constructs everything in the constructor before the menu refreshes — reorder so the menu paints first).
- Loading screen: a branded splash (किला रश wordmark + progress bar) instead of a blank canvas; it also masks the font/music fetch.

### 4.2 Offline-first (mobile web + Capacitor share the same build)
- Add a service worker caching `dist/` (app shell: HTML, JS, CSS, fonts, atlas) with a cache-first strategy for static assets and network-first for nothing (the game is fully client-side; saves are already `localStorage`).
- Add `manifest.json` (name, short name, icons, `display: fullscreen`, `orientation: portrait`, theme colour) so the web version is installable (Add to Home Screen) even before the Play Store wrap.
- Offline behaviour: full game playable offline after first load; the only online-dependent features are the share card (Web Share API — degrades to download) and any future ads/leaderboard (both out of scope for this plan; ads SDK is a later perf cost — reserve headroom, see §6).

### 4.3 Runtime behaviour on low-end phones
- **Backgrounding:** `visibilitychange` → auto-pause when `document.hidden` during `playing` (today nothing pauses; a phone call mid-level can cost the player the run). In the Capacitor build, also hook the App plugin `appStateChange` event.
- **Thermal:** sustained 60 fps on a mid-range Android throttles after ~10 min. Design for **30 fps sustained, 60 fps bursts** — `AutoQuality` already steps down, but its floor is 45 fps; add a sustained-thermal rule: if the scaler has stepped down twice in one session, stay down (don't step back up until the next session).
- **Battery:** prefer `powerPreference: 'low-power'` on phones? No — `high-performance` is correct for a game, but the low quality tier is the battery saver; expose the ⚡ toggle prominently (it exists) and let the scaler do the rest.
- **Memory:** on `low-memory` pressure there is no web API to rely on; the defence is the budgets in §3.1 (heap < 150 MB, texture ≤ 64 MB) plus disposing level-scoped geometry on level change (gates/barriers/fortifications — verify with the Phase 0 overlay across 5 level loads).
- **WebGL loss:** add a `webglcontextlost` handler that shows a "tap to reload the battle" overlay instead of a black screen (cheap, and the #1 cause of 1-star reviews for WebGL games on low-end phones is an unhandled context loss).

---

## 5. What the Capacitor Play Store wrap needs from the web build

(Researched 2026-11-27. Capacitor 8 is stable; Play requires **targetSdk 36** for new apps since 31 Aug 2026; Android 15/16 enforces edge-to-edge with **no opt-out** at SDK 36.)

**Web-side prerequisites (this plan's scope):**
1. Static build with `index.html` at the root of `dist/` — already true (`vite.config.ts`: `base: './'`, `outDir: 'dist'`).
2. Safe-area CSS from §1.2 (the `var(--safe-area-inset-*, env(...))` pattern). Capacitor 8's SystemBars injects `--safe-area-inset-*` on Android (needed because Android WebView < 140 returns wrong `env()` values); Capacitor 9 changes the default, but the fallback pattern keeps working.
3. `viewport-fit=cover` — already present.
4. No server dependency at runtime — already true (all state is `localStorage`; no API calls in the game loop).
5. `manifest.json` + icons + splash (see below) — the web manifest doubles as the Capacitor asset source.

**Native-side work (build phase, Deep-side steps in brackets):**
1. `npm i @capacitor/core @capacitor/cli && npx cap init` — app id `com.deepdharia.qilarush`, `webDir: 'dist'`. [Deep runs this on his Mac — the GitHub bot cannot create the native project.]
2. `npx cap add android` — commit the `android/` folder.
3. Icons + splash: `npx capacitor-assets generate` from a 1024×1024 icon and a 2732×2732 splash. [Deep supplies the icon art — the Yatra One किला रश wordmark is the natural source.]
4. Android back button: hook the App plugin `backButton` event — back from gameplay = pause menu, back from pause = resume, back from menu = exit prompt. Today the browser back button does nothing useful in-game.
5. Status bar / gesture insets: SystemBars handles it once the CSS from §1.2 exists; verify on a real Android 15/16 device (the emulator lies about insets).
6. Target SDK 36, minSdk 24 (Capacitor 8 defaults). Note: minSdk 24 is Android 7 — the floor device decision (D1) should be stricter than the manifest minimum.
7. Play Console: app listing, content rating, data safety (no data collected — localStorage only), then the **closed test: 12 testers / 14 days** for personal accounts created after 13 Nov 2023 (same path as Udhar). [Deep-side: testers, listing copy, screenshots, keystore.]

**Out of scope for this plan (later):** iOS wrap (needs a Mac + Apple Developer account, $99/yr — Android-first per Deep's playbook), AdMob (reserve ~10% perf headroom and a banner safe-zone at the bottom; do not integrate now), Play Games sign-in / cloud saves.

---

## 6. Risks and open decisions for Deep

### Risks (ranked)

| # | Risk | Impact | Mitigation in this plan |
|---|---|---|---|
| R1 | Instancing vs KayKit crowd swap conflict (§3.2, P2 flag) | Rework of the biggest perf win | Decide before Phase 2 starts; instance procedural soldiers first |
| R2 | Thermal throttling on mid-range Android after ~10 min | 60 fps → 22 fps mid-session, 1-star reviews | 30 fps sustained design; scaler stays down after 2 step-downs |
| R3 | 2048 PCFSoft shadows + MSAA on phones | Single biggest frame-time cost | Phase 1 quick wins (1024 PCF / off, no AA on phones) |
| R4 | Android WebView fragmentation (old WebView < 140 safe-area bug; three r174 needs modern WebGL2) | Layout breaks / black screen on old phones | SystemBars variables; `webglcontextlost` handler; floor device decision |
| R5 | Per-frame allocations → GC hitches in full-crowd fights | Stutter exactly at the most exciting moment | Phase 1 allocation sweep (§0.2) |
| R6 | No measurement culture (nothing measured to date) | Perf regressions ship silently | Phase 0 overlay + gate protocol (§3.3) |
| R7 | Capacitor edge-to-edge enforcement (SDK 36, no opt-out) | HUD hidden under system bars on Android 15/16 | Safe-area CSS (§1.2) verified on real devices |

### Open decisions (Deep's call)

| # | Decision | Recommendation | If he picks otherwise |
|---|---|---|---|
| D1 | **Lowest phone spec to support** | Snapdragon 680 / Helio G85 class, 4 GB RAM, Android 11+, 720p–1080p (Redmi Note 11 / Galaxy A14 class) | Lower floor = lower budgets across §3.1 (draw calls ≤ 60, DPR cap 1) and a longer Phase 2 |
| D2 | **Portrait-only vs landscape** | **Portrait-only lock** (`orientation: portrait` in manifest + `screenOrientation` in Capacitor). The whole game (lane, gates, HUD) is portrait-shaped; landscape is a second layout + camera rework | Landscape support adds a full layout phase and a landscape camera pass |
| D3 | **Frame-rate floor** | 30 fps sustained on the floor device, 60 fps where the hardware allows | 60 fps floor on mid-range = cut crowd size / effects, or accept throttling |
| D4 | **Shadows on phones** | Off by default on phones; AutoQuality may enable them on strong hardware | Shadows on = ~15–25% frame-time cost on Adreno 610-class GPUs; budget must absorb it |
| D5 | **KayKit crowd vs instanced procedural crowd** | Instance procedural soldiers now; KayKit for boss/commander hero only (or defer) | KayKit crowd = re-plan Phase 2 around `BatchedMesh` + baked animation; +1–2 weeks |
| D6 | **Ads in v1?** | No ads in the Play Store v1 (launch clean, add AdMob after first users — his own playbook) | Ads SDK + banner = reserve 10% perf headroom + a bottom safe-zone in the HUD |

---

## 7. Phased plan

| Phase | What | Files touched | Effort | Gate |
|---|---|---|---|---|
| **0 — Measure** | `?perf=1` overlay (FPS, p95, `renderer.info`, heap, quality level); run the §3.3 protocol on 2 devices; record the baseline (expect ~4,500 draw calls in S3) | `Game.ts` (overlay hook), `index.html` (overlay div) | ~0.5 day | Baseline numbers written down; S3 worst case captured |
| **1 — Quick wins** | Start phones at quality level 1; AA off + DPR 1.5 cap on phones; shadow map 1024 PCF on phones; particle cap; allocation sweep (§0.2); `visibilitychange` auto-pause; safe-area CSS; 48 px tap targets; bottom-sheet modals; boss-HUD reposition; `overscroll-behavior`, `touch-callout`, `contextmenu` guards; Pointer Events unification in `InputManager.ts` | `Game.ts`, `AutoQuality.ts`, `InputManager.ts`, `ParticleSystem.ts`, `PlayerArmy.ts`, `Projectiles.ts`, `EnemyArmy.ts`, `index.html` | 1–2 days | §3.3 protocol re-run: p95 and draw calls improved; zero regressions on desktop |
| **2 — Instance the crowd** | Soldiers → `InstancedMesh` per part (~20 calls for 210 soldiers); `setColorAt` for faction/skins/flash; telegraphs → instanced quads; projectiles → 2 instanced meshes; particles → `THREE.Points`; keep `animateSoldier` math, write matrices instead of rotating groups | `SoldierModel.ts`, `PlayerArmy.ts`, `EnemyArmy.ts`, `Projectiles.ts`, `ParticleSystem.ts`, `Game.ts` (quality tiers) | 3–5 days | S3 draw calls ≤ 80; S3 p95 ≤ 33 ms on floor device |
| **3 — Environment + LOD** | Merge static fortress geometry (≤ 8 calls); Lambert on phones; near-field-only shadow casters; tower/bastion LOD; fog curtain; verify no geometry leak across 5 level loads | `FortressEnvironment.ts`, `Gates.ts`, `Barriers.ts`, `Fortifications.ts`, `Game.ts` | 2–3 days | Menu calls ≤ 40; geometries flat across level loads |
| **4 — Load & offline** | Self-hosted subsetted fonts; lazy music/GLB; build-size check (< 1 MB dist); service worker + `manifest.json`; branded loading splash; `webglcontextlost` handler; menu paints before renderer init | `index.html`, `vite.config.ts`, new `public/sw.js` + `public/manifest.json`, `Game.ts`, `SoundManager.ts` | 2–3 days | Blocking load < 1 MB; TTI < 3 s on 4G; game fully playable offline after first load |
| **5 — Capacitor wrap** | `cap init` + `add android`; icons/splash; back-button handling; SystemBars verification on Android 15/16; targetSdk 36; Play Console listing + closed test | New `capacitor.config.ts`, `android/` (native), `index.html` (safe-area — already done in Phase 1), `Game.ts` (App plugin hooks) | 2–4 days + Deep-side (keystore, listing, 12 testers / 14 days) | AAB installs and plays on the floor device; HUD clear of system bars |
| **6 — Gate loop** | Re-run §3.3 after every phase; tune, don't ship, until all pass criteria hold | — (process, not code) | 0.5 day per gate run | All §3.3 pass criteria green on the floor device |

**Total build effort (Phases 0–4): ~9–14 days. Phase 5: +2–4 days plus Deep-side store steps. Phase 6 runs throughout.**

**Dependency order (do not reorder):** 0 → 1 → 2 → 3 → 4 → 5. Phase 2 (instancing) must land before the KayKit decision (D5) is executed, and Phase 1 (safe areas, tap targets) must land before any phone playtest is treated as representative — today's layout bugs would pollute every playtest reading.

---

## 8. Phone-measurement checklist (the playtest gate — copy-paste ready)

Run after **every** phase, on the floor device + one better device. Record model / Android / Chrome-WebView version every run.

- [ ] Open with `?perf=1` — overlay visible, updating, showing FPS / p95 / calls / tris / heap / quality level
- [ ] **S1** Menu idle 60 s — FPS ___, calls ___, heap start ___ MB → end ___ MB (growth ≤ 5 MB)
- [ ] **S2** Level 1 full run — FPS avg ___, p95 ___ ms, calls peak ___, jank frames (>50 ms) ___
- [ ] **S3** Level 22+ max crowd — FPS avg ___, p95 ___ ms (≤ 33 ms), calls ___ (≤ 80), tris ___ (≤ 250k)
- [ ] **S4** Boss arena — FPS avg ___, p95 ___ ms, slow-mo + shake without a hitch
- [ ] **S5** Endless wave 10, 3 min — FPS at minute 3 ___ (thermal check), battery ___% drained
- [ ] **S6** 10-min soak — heap growth ___ MB (≤ 5 MB), FPS at minute 10 ___
- [ ] 5 level loads in a row — `geometries` count flat? Y / N (leak check)
- [ ] Rotate phone / background the app 10 s / return — game auto-paused? Y / N; resumes cleanly? Y / N
- [ ] Notch / gesture-bar check — top bar, boss HUD, cannon button all clear of system bars? Y / N
- [ ] One-thumb playtest — steer + cannon + pause all reachable without re-gripping? Y / N
- [ ] 360 px wide phone — no horizontal overflow, no clipped text? Y / N
- [ ] Offline: airplane mode after first load — game fully playable? Y / N
- [ ] **Gate verdict:** PASS / FAIL — if FAIL, note the failing metric and the phase that owns the fix

---

## Sources (for the leader's verification)

- three.js perf budgets & `renderer.info`: hontran.dev/blog/three-js-performance-optimization; masterallarts.com/learn/threejs-from-zero/09-performance-instancing-lod/ (draw calls <100 mobile / <500 desktop; triangles 200k low-end mobile).
- Mobile three.js presets (DPR 1.5 cap, no AA/shadows on mobile, 1–2 lights): threejs-graphics-optimizer skill summary, affpapa.org.
- Touch targets & thumb zones (44 pt Apple / 48 dp Android; bottom third for actions; ~75% of touches are thumbs): egmatic.com/blog/mobile-game-touch-controls-design-for-thumbs.
- Mob Control reference (Voodoo, 100M+ installs, Android 8.0+, swipe-to-steer portrait): mob-control.getallapps.com; lookingapps.com.
- Capacitor 8 / edge-to-edge / safe areas (targetSdk 36 required by Play since 31 Aug 2026; Android 15/16 no opt-out; SystemBars; `var(--safe-area-inset-*, env(...))` pattern; 1024×1024 icon / 2732×2732 splash): capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/; guigui-tech.dev; otakit.app/blog/capacitor-edge-to-edge-display.

*All code facts in §0 were read from `~/workspace/qila-rush` on branch `doomfall/engagement-loops` (HEAD `f494f15`), 2026-11-27. No code was changed. No measurements exist yet — Phase 0 is the first job.*
