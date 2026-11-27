# Qila Rush — Planner 3: Visuals, Feel & Bold Identity

**Role:** Planner 3 of 3 — visuals, feel & bold identity (PLAN ONLY, no code)
**Date:** 2026-11-27 · **Branch:** `doomfall/engagement-loops` (local HEAD `f494f15`)
**Reference:** "Top Lords" (GAME SPARK PTE. LTD., 4.7★, 106K reviews, 5M+ downloads) —
its clip is a Mob Control-style minigame: vertical portrait 3D lane, saturated
blue-vs-red crowds, chunky blue cannon firing tiny soldiers, glowing "×99"
multiplier gate, golden upgraded cannon, huge armoured boss with a health bar,
big readable numbers (128, 297, 300), "Defeat in Battle" end screen with a
cracked shield.
**Deep's bar:** "everything bold" — bold, chunky, readable on a phone, smooth,
addictive. **PLAN ONLY — do not build from this file without a go.**

## 0. What exists today (grounding — read, not assumed)

| System | Current state | File |
|---|---|---|
| Soldiers | Procedural low-poly, shared geometries/materials, MeshLambert. Turban (pagri + sarpech jewel + kalgi plume + tail), angrakha torso, kamarband sash, dhal shield, dhanush bow (player) / spear (enemy). Sine-wave run (leg/arm swing, torso bob, plume sway), idle breathing. No walk/run/attack/death animation. | `src/entities/SoldierModel.ts` (373) |
| Faction colours | Player robe `0x1d4ed8` blue, turban **saffron** `0xf59e0b`; enemy robe `0xb91c1c` red, turban dark crimson `0x3f1212`; gold `0xf59e0b` | `src/utils/Constants.ts` |
| Environment | Golden-hour: hemi `0xffdf9e/0x7a4a26`, sun `0xffb347` 2.6, 2048 shadow map, FogExp2 `0xe2a468` 0.006, canvas sky dome + sun disc/halos, torana gateways (z 0/140/boss−10), bastions every 55z, chhatris, saffron/blue banners + pennant strings, torches (fake flicker, no point lights), dust motes, birds, distant hills | `src/environment/FortressEnvironment.ts` (686) |
| Gates | Torana pillars + kalasa finials, canvas-texture portal (Cinzel 900, 130px, "×N / +N / −N" + subtitle), shimmer; positive = blue/gold, hazard = red | `src/entities/Gates.ts` (297) |
| Boss | "Commander Sher Khan", 3.2× scale, red/gold plate, dual shamshir blades, spiked helm, telegraph slam ring, 600 HP, collapse-on-death | `src/entities/BossEnemy.ts` (293) |
| Juice (already built) | Camera shake, gate-pass FOV kick (+8, fast decay), boss push-in (FOV −6), handheld sway, portrait FOV 68; pooled particles (sparks, wood, explosion, victory petals, dust) + floating damage numbers (Rajdhani 900, outlined, 24 pooled sprites); guarded `navigator.vibrate` (Android only) on cannon, boss slam, victory, defeat | `src/game/CameraManager.ts`, `src/entities/ParticleSystem.ts`, `src/game/Game.ts:363,1294,1361,1462–2323,2616` |
| Perf | AutoQuality scaler: 3 levels (shadows on/off, DPR cap 2 → 1.5 → 1), steps down <45fps, up >57fps; manual override wins | `src/systems/AutoQuality.ts` |
| UI | DOM HUD: army count, progress bar, score + 🔥 combo badge, run coins, boss bar, buff pills, cannon cooldown, wallet; screens: menu / map (30 levels) / shop / daily / pre-level / chest / draft (1-of-3, 56px cards) / victory / defeat (itemised coin breakdown) | `src/ui/UIManager.ts` (918), `index.html` (~1400) |
| Fonts | Cinzel 600/800/900 (titles), Rajdhani 600/700 (HUD/body), Yatra One (किला रश wordmark) — Google Fonts | `index.html:8` |
| Audio | Procedural Web Audio: dhol bass/rim, nagada roll, arrow fire/hit, gate pass, barrier hit/break, cannon fire/impact, gate chime, combo-up, graze, boss roar/slam, victory/defeat stingers; boss war-drone. Real-music hook: `assets/music/battle-loop.mp3` (Crusade, CC-BY) takes over when present; 404/blocked autoplay → procedural loop unchanged | `src/audio/SoundManager.ts` (654), `public/assets/music/README.md` |
| Free assets | Avramania CC0 castle sets, Kenney kits, KayKit Adventurers (5 heroes) + 150+ animations (CC0), Sonniss/Pixabay SFX, SFXMint slashes, Hazard Pay wooshes | `ATTRIBUTIONS.md` |
| Input | Drag anywhere to steer (mouse/touch, sensitivity 1.35), keyboard arrows; `touch-action: none`, viewport-fit cover, no-zoom | `src/game/InputManager.ts`, `index.html:5` |

**The honest diagnosis.** Qila Rush already has the Indian fortress identity,
the juice infrastructure, and the blue-vs-red faction split. What it does NOT
have is the reference's **boldness**: the golden-hour wash (warm fog
`0xe2a468`, Lambert materials, soft haze) makes everything read dusty and
low-contrast on a phone; soldiers are small, thin-limbed and samey at crowd
distance; numbers are small (army count 24px, progress text 11px); and the
cannon — the reference's hero object — exists only as a HUD button
(`btn-topkhana`), not as a visible chunky thing in the world. The plan below
fixes readability first, then feel, then identity — without rebuilding the
game into Mob Control (Qila Rush is a runner: march, steer, gates, barriers,
boss — that loop stays).

## Design principles (the 5 rules every phase must pass)

1. **Readable at arm's length.** Any number or icon a player must act on is
   ≥28px on a 360px-wide phone, with a dark outline or a solid chip behind it.
2. **Three colours on screen, max.** Saffron, royal blue, crimson — plus
   sandstone and black. A fourth colour must earn its place.
3. **Numbers are the reward.** Army count, gate values, damage, coins and
   combo are the dopamine; they must pop, grow and flash, never sit quietly.
4. **One thumb, zero reading.** Every action is a drag or a ≥56px tap. No
   paragraph of instructions during play; the first 30 seconds teach by doing.
5. **Juice is budgeted, not free.** Every effect has a perf cost and a kill
   switch in AutoQuality. If it drops a mid phone below 45fps, it goes.

---

## 1. The bold look

### 1.1 Colour system — keep blue-vs-red, fix the wash

**Decision: keep blue (player) vs red (enemy).** It matches the reference,
it is already in the code, and it is instantly readable. Do NOT switch the
player to saffron — saffron is the third colour and works hardest as the
"good/hero/reward" signal (multiplier gates, gold, turbans, banners). The
failing part is not the split, it is the **golden-hour wash dulling it**.

| Role | Today | Target (bold) | Where |
|---|---|---|---|
| Player blue | `0x1d4ed8` robe, `0x38bdf8` accent | **Saturated royal blue `#2563EB`** robe, sky `#38BDF8` trim | `Constants.COLORS.BLUE_ROBE/BLUE_ACCENT`, `SoldierModel.ts` |
| Enemy red | `0xb91c1c` robe | **Pure signal red `#DC2626`**, dark maroon `#7F1D1D` for elites | `Constants.COLORS.RED_ROBE`, `EnemyTypes.ts` |
| Saffron (hero/reward) | `0xf59e0b` turban + gold | **Keep `#F59E0B`** — multiplier gates, coins, turban, crown, chest | gates, `Constants.COLORS.GOLD/TURBAN_BLUE` |
| Sandstone | `0xd4a373` + fog `0xe2a468` | **Lighten to `#E8C39A`**, desaturate the haze | `FortressEnvironment.ts` |
| Ground/road | sandstone texture, roughness .85 | **Darken road to `#8A5A33`** so blue/red crowds pop against it | `buildCausewayRoad()` |
| Sky | blue→gold gradient dome | **Deeper blue top `#1E40AF` → warm horizon `#FDBA74`** (more contrast, same warmth) | `CanvasTextures.getSkyTexture()` |
| Fog | FogExp2 `0xe2a468`, 0.006 | **0.0035, colour `#E8C39A`** — gates must stay readable 60 units out | `buildSkyAndFog()` |
| Text/numbers | white on transparent | **White with 4px black outline** (canvas) / dark chip (DOM) everywhere | `Gates.ts`, `ParticleSystem.ts`, `index.html` |

**Files:** `src/utils/Constants.ts` (one place — every faction colour flows
from here), `src/environment/FortressEnvironment.ts`,
`src/utils/CanvasTextures.ts`, `src/entities/Gates.ts`.

### 1.2 Materials & lighting — from dusty to chunky

1. **Toon-ify the crowd.** Switch soldier/boss/gate materials from
   `MeshLambertMaterial` to `MeshToonMaterial` with a shared 3-step
   gradient map (`THREE.DataTexture`, 3 greys) — flat cel bands read as
   "chunky" at crowd distance where Lambert goes muddy. Keep Lambert only
   on the road/walls (they want soft shading). New file:
   `src/utils/BoldMaterials.ts` (gradient map + shared toon materials).
2. **Outlines (inverted hull).** Add a cheap dark outline to the three
   things the eye must track: soldiers (front rank only — see §1.4),
   boss, and gate pillars. Technique: clone mesh with
   `side: THREE.BackSide`, black material, `scale 1.06`. No post-processing
   (no OutlinePass — too expensive on mobile).
3. **Light: keep the sun, kill the haze.** Sun stays low golden
   (`0xffb347`, 2.6) for long readable shadows; raise hemisphere to
   `1.1` so shadowed faces don't go black; the fog cut (above) does the
   rest. **Do NOT add bloom** — it was already skipped for perf in the
   graphics brief, and it would fog the numbers.
4. **Bigger silhouettes.** Scale soldiers ×1.15 and widen torso
   (`torsoGeo` 0.24→0.28 top radius), thicken limbs (0.08→0.10 radius),
   enlarge turban (+15%) and shield (+20%). Chunky beats realistic at
   90-soldier distance. `SoldierModel.ts` geometry block only.

### 1.3 Typography — numbers are the product

- **Army count:** 24px → **44px Rajdhani 900** with a saffron chip
  behind it and a scale-pop (1.0→1.25→1.0, 120ms) on every change.
- **Gate values:** Cinzel 900 at 130px on the canvas is good — add a
  **pulsing gold ring** on × gates and make the × value 1.5× the + value
  size. Negative gates keep red but add a skull (☠) so colour-blind
  players read them too.
- **Floating numbers:** already Rajdhani 900 outlined — bump boss numbers
  to 2.2× scale, add a **"+N" army-gain number in saffron** when a gate
  multiplies (today only sparks show).
- **HUD text floor:** nothing below 13px except legal/credit lines.
  Progress text 11px → 13px minimum, section name in caps.
- **Devanagari:** Yatra One stays on the menu wordmark; add a small
  "किला रश" stamp on the victory screen and the share card (same font,
  already loaded — zero new cost).

### 1.4 What the player sees (camera & framing)

- Camera is already portrait-aware (FOV 68 portrait). Keep the framing,
  but **lower the camera 1.5 units and pull it 2 units closer** at army
  counts <30 so the front rank reads big in the first seconds; the
  existing crowd-scale lift (`CameraManager.update`) already handles big
  armies — just start it lower.
- **Front-rank rule:** only the nearest ~24 soldiers get outlines +
  toon shading + full animation; the rest of the crowd uses the existing
  cheap Lambert path. This is the perf key to §3's hybrid plan.
- **Boss intro:** on arena entry, 0.8s slow push-in (existing
  `setBossMode` FOV −6) + a **giant "👑 SHER KHAN" banner** + health bar
  that is 2× thicker with a cracked-shield icon at 50% HP. The reference's
  boss reads because the bar is huge — copy that, not the boss model.

### 1.5 The cannon — make the reference's hero object exist

Qila Rush has a Topkhana cannon **ability** (10s cooldown, 160 dmg, 5.5
splash) but no cannon in the world — only a HUD button. The reference's
most memorable object is the chunky cannon. Plan:

- **Phase 1:** a visible **Topkhana cannon** (procedural: fat brass
  barrel + wooden carriage + wheels, built from primitives in a new
  `src/entities/Topkhana.ts`) trails 3 units behind the army's front
  rank. Firing it (button or auto when ready) plays recoil (barrel
  kicks back 0.6u, 120ms), muzzle flash (additive sprite + 12 sparks),
  screen shake 0.6, and the existing explosion + damage numbers at the
  impact point. This is the single highest-value "bold" addition: it
  gives the player a toy to look at and a reason to tap.
- **Phase 2 (optional, Deep's call):** golden cannon skin as a war-gear
  reward (the reference's golden upgraded cannon) — recolour + bigger
  muzzle flash, no new geometry.

---

## 2. Game feel / juice — what exists, what to add, what NOT to add

### 2.1 Already built — do not rebuild, only tune

Camera shake, FOV kick, boss push-in, sway, pooled particles, floating
numbers, guarded vibration. These are good. The tune-ups: shake
**decays faster** (0.9→0.5s on cannon) so it punches instead of wobbling;
FOV kick already good; vibration patterns already guarded (menu = silent,
muted = silent, desktop = no-op).

### 2.2 To add, in order (highest feel-per-cost first)

| # | Juice | Trigger | Cost | File |
|---|---|---|---|---|
| J1 | **Squash & stretch on spawn/death.** Soldier scales y 1.25→0.9→1.0 over 140ms on spawn from a gate; on death, squashes flat (y 0.15) then pops into 4 sparks. The single cheapest "alive" signal. | gate pass, kill | ~0 (scale only) | `EnemyArmy.ts`, `PlayerArmy.ts` |
| J2 | **Hit-stop (30–60ms freeze).** On boss slam and cannon impact, freeze `dt` to 0 for 45ms. Reads as power; costs nothing. | boss slam, cannon | ~0 | `Game.ts` loop |
| J3 | **Gate flash + number burst.** On × gate: white flash ring (additive sprite, 200ms) + big saffron "+N" floating text + `playGateChime`. Today: sparks only. | gate collect | 1 sprite | `Gates.ts`, `ParticleSystem.ts` |
| J4 | **Crowd flow wave.** When the army count jumps (gate/barrier), a ripple runs front-to-back through the crowd: each soldier bobs with a 40ms stagger. Reads as a living wave, not a spreadsheet. | count change | ~0 (existing anim) | `PlayerArmy.ts` |
| J5 | **Cannon recoil + muzzle flash.** See §1.5. | cannon fire | 1 sprite + shake | new `Topkhana.ts` |
| J6 | **Boss hit flash.** Boss material emissive flashes white 80ms on every hit (today: 6 gold sparks only). Add a red vignette pulse on player damage. | boss damage / player damage | ~0 | `BossEnemy.ts`, `index.html` |
| J7 | **Victory/defeat stings (visual).** Victory: 40 petals (exists) + **coin fountain** (gold sparks arcing from chest, 1s) + slow-mo 0.5× for 600ms. Defeat: **cracked-shield overlay** (the reference's end screen) + desaturate the scene (fog colour shift, 300ms) + shake 1.0. | victory / defeat | low | `Game.ts`, `UIManager.ts`, CSS |
| J8 | **Combo milestone pops.** At combo ×3/×5/×10: the combo badge scales 1.4× with a gold flash and `playComboUp` pitch rises (exists — wire the visual). | combo tier | ~0 | `UIManager.ts` |
| J9 | **Haptics (Android only).** Already wired for cannon/boss/victory/defeat. Add: 15ms tick on gate pass, 25ms on barrier break. **iOS Safari has no Vibration API — never promise haptics there; the visual must carry it.** | gate/barrier | ~0 | `Game.ts:1361` |
| J10 | **Kill streak slow-mo.** On 10 kills within 3s: 300ms at 0.6× time + "RAMPAGE" banner. Cheap, very addictive. | kill streak | low | `Game.ts` |

### 2.3 What NOT to add (perf / taste)

- **No bloom, no OutlinePass, no post-processing chain** — each costs a
  full-screen pass on a phone GPU; outlines via inverted hull instead.
- **No ragdoll physics** — pooled squash + sparks read better and cost
  nothing; Matter.js-style bodies would sink the 90-enemy pool.
- **No per-soldier shadows** — shadows stay on the sun's 2048 map with
  the existing frustum; AutoQuality already kills shadows first.
- **No screen shake on every kill** — shake is for cannon/boss/barrier
  only; constant shake causes fatigue and hides the numbers.
- **No particle count above the 350 pool** — `ParticleSystem` pool is the
  budget; new effects reuse it (sparks/petals/dust), never a second pool.
- **No audio ducking tricks** — mute toggle + one music layer + one SFX
  layer; side-chaining is over-engineering for a phone web game.

### 2.4 Perf budget (the gate every phase must pass)

- **Target:** 60fps on a mid Android (Snapdragon 7-series), 30fps floor
  on low-end; draw calls <120 in combat; tris <350k.
- **Crowd rule:** 90-enemy pool + 120 max player army is the ceiling.
  Any new visual must state its draw-call and tri cost in its phase
  notes; AutoQuality's 3 levels remain the safety valve (shadows →
  DPR → crowd outline off).
- **Measure on Deep's phone, not the desktop.** Same gate as every
  other phase: FPS + a 10-second screen recording before/after.

---

## 3. Indian identity — resolving the KayKit A/B/C

### Recommendation: **B — KayKit bodies + Indian dressing (hybrid)**

**Do NOT take A** (fantasy look). The turban, angrakha, dhal and torana
are the entire reason this game is not a Mob Control clone — losing them
loses the product. **Do NOT take C as the whole Phase 3** — fortress props
and SFX are needed (§§1.5, 4) but they don't fix the core complaint that
the soldiers move like puppets; real walk/run/attack/death animation is
the biggest feel upgrade available. **B, done as a hybrid:**

**The hybrid (the actual plan):**

1. **KayKit heroes are the front rank, not the whole crowd.** The nearest
   ~24 soldiers (the ones the camera actually shows) become KayKit
   rigged characters; the remaining ~66–96 crowd soldiers stay
   procedural (today's factory, toon-ified per §1.2). Front rank gets
   real walk/run/attack/death; the back rank keeps sine-wave. The eye
   cannot tell at crowd distance, and the skeleton count stays at ~24
   instead of 90. Perf gate: if 24 skinned meshes hold 60fps on Deep's
   phone, raise the cap to 36; if not, drop to 16.
2. **Which KayKit hero is which unit (verified 2026-11-27):** the free
   pack is 5 heroes — **Mage, Knight, Barbarian, Rogue, Hooded Rogue**
   (~5.3k tris, 41 bones each, one 1024px gradient atlas). Mapping:
   player front rank = **Knight** (shield + sword reads as a foot
   soldier; give him the dhal + bow accessories from the pack's 25+
   props); enemy front rank = **Barbarian** (bigger silhouette, reads as
   the invader); elites = **Rogue/Hooded Rogue** (distinct silhouette =
   readable elite); boss stays the existing procedural Sher Khan (3.2×,
   already the best-looking model in the game — do not replace him).
   Mage is unused in the crowd (save for a future commander ability).
3. **Indian dressing — the turban prop is the whole trick.** KayKit
   heroes have no turbans. Reuse the existing procedural turban group
   (`SoldierModel.ts`: torus roll + cone + sarpech jewel + kalgi plume +
   tail) as an **attachment parented to the KayKit head bone**, scaled
   ×1.1. Same for the kamarband sash (torus, parented to the spine) and
   the dhal shield (replace the Knight's heater shield with the existing
   dhal geometry). The dressing is 6 shared meshes — near-zero cost —
   and it is what makes a KayKit knight read as a Qila Rush warrior.
   The chest sash (angrakha cross-strap) becomes a thin box on the torso.
4. **Faction colours on a shared atlas.** KayKit's one gradient atlas
   cannot be recoloured per-soldier. Solution: **two materials, one
   atlas** — clone the atlas material per faction and tint
   `material.color` (player `#2563EB` multiply, enemy `#DC2626`
   multiply). The atlas is mostly greyscale gradients, so a colour
   multiply reads cleanly. The **skin system survives**: `applyPlayerSkin`
   keeps recolouring the *turban prop + sash* (still shared procedural
   materials), while the robe tint becomes a fixed faction tint. Net
   change to `Game.ts:346/853/1256`: turban/sash recolour only, robe
   tint fixed. (Note: the EXTRA $7.95 tier's 3 alt textures per
   character would give true per-skin robes — **do not buy it now**; the
   tint + turban route is free and sufficient.)
5. **Animations to use (KayKit Character Animations, 150+ clips, CC0):**
   run (crowd march), walk (menu idle army), sword attack (front rank
   melee), bow shoot (player shooters), hit-react, death (fall + fade).
   Blend: run ↔ attack on a 150ms crossfade; death = 400ms fall, then
   squash-pop into sparks (J1). **Do not use** magic/emote clips in
   combat — they break the war read.

**What the player sees that says "Indian fortress war" in 3 seconds:**
torana gateway framing the road at z=0 (already there) + saffron/blue
pennants + the **किला रश** wordmark + a front rank of turbaned,
sash-wearing soldiers with dhal shields marching to a dhol beat + the
sandstone fort with chhatris behind. Every one of those exists except the
dhol-on-menu (see §4) — the plan is to make them **bigger, more saturated
and closer to the camera**, not to invent new ones.

**Fortress props (the C-part, done alongside, not instead):**
Avramania Free Low-Poly Medieval Collection (203 models, CC0, one shared
palette texture) + Castle & Siege (14) for the **boss arena**: replace the
procedural bastion row near z=300 with 2 Avramania round towers + a
gatehouse with portcullis, and add Avramania braziers (flame = reuse the
torch glow sprite) + banners at the arena mouth. Kenney Castle Kit as
backup if an Avramania GLB is too heavy. **Budget:** arena props only
(≤8 GLBs, ≤40k tris total); the causeway keeps procedural walls (they
are already good and free). Files: new `src/environment/ArenaProps.ts`,
`public/assets/props/` (Deep uploads GLBs via github.com — bot cannot
push binaries, same as the MP3).

---

## 4. Audio

### 4.1 SFX — real one-shots on top of the procedural bed

The procedural dhol/nagada bed is culturally specific and **stays** —
no CC0 library has a dhol loop this good, and replacing it would make the
game sound generic. What changes: real **one-shot** SFX layered on top
for the moments the procedural synth can't sell (metal, wood, crowd).

| Sound | Moment | Source (free, CC0 only) | Replaces / adds to |
|---|---|---|---|
| Sword slash / clash | front-rank melee hit, barrier break | **SFXMint Sword Slash** (24 sounds, CC0) | adds to `playBarrierBreak` / new `playMeleeHit` |
| Woosh | cannon fire, gate pass, boss slam wind-up | **Hazard Pay 16 FREE Woosh SFX** (royalty-free) | adds to `playCannonFire`, `playGatePass` |
| Crowd war-cry / cheer | victory, wave clear, ×5 gate | **Pixabay SFX** (Content Licence, no attribution) — search "crowd cheer", "war cry" | adds to `playVictory`, new `playWaveClear` |
| Coin chime | chest open, coin bank, shop buy | **Pixabay SFX** "coin" | adds to `revealChest`, shop |
| Chest creak + sparkle | chest open | **Fantasy Forge starter pack** (CC0, 8 sounds) | `revealChest` |
| UI tap / button | every menu tap | **Pixabay SFX** "click" (short, soft) | new `playUiTap` |
| Arrow volley | massed shooter fire | keep procedural `playArrowFire` (it is fine) | — |
| Dhol / nagada | battle bed, boss drone | **keep procedural** — do not replace | `startBattleRhythm`, `playBossDrone` |
| Footstep march | crowd marching (subtle, low volume) | **Sonniss GDC 2026 Bundle** (royalty-free) — pick 1 loop, low-pass | new, volume 0.08, only when army >20 |

**Rules:** every new SFX is an MP3 ≤150KB in `public/assets/sfx/`
(Deep uploads via github.com); each gets a `SoundManager.playX()`
method next to the procedural ones; **no SFX may exceed 0.5s except
the cheer**; total SFX budget ≤1.5MB. **Never use Freesound
CC-BY-NC** files (non-commercial can't go in an ad-monetised game);
**never use Quaternius audio** (licence changed Aug 2026).

### 4.2 Music — the Crusade hook, and mobile autoplay

- The hook works: `tryExternalMusic()` loads `assets/music/battle-loop.mp3`,
  real track loops, procedural dhol goes quiet, boss drone still fires,
  mute covers both. **Nothing to change in the hook.**
- **Still Deep-side:** upload Crusade MP3 to
  `public/assets/music/battle-loop.mp3` (verified 3:19, 7.6MB, CC-BY;
  credit line already shows on the menu). Without it, the procedural
  loop plays — nothing breaks.
- **Mobile autoplay (the part that bites):** `AudioContext` and the
  `<audio>` element both require a user gesture on iOS Safari and
  Chrome Android. Today `soundManager.init()` is called from start
  button taps (`Game.ts:418/425/973/1051`) — correct pattern, keep it.
  Add: on `visibilitychange` → hidden, pause the music element (iOS
  kills background audio anyway; resume on return *only* if it was
  playing and the player taps — never auto-resume without a gesture).
  First-gesture rule: the **menu's first tap starts the music** (menu
  button, not the canvas) so the dhol is already playing when the
  battle starts — this is the "3-second Indian" test in §3.
- **Mute:** one toggle, covers music + SFX + procedural; persist in
  `SaveManager` (already the pattern for other settings — check before
  adding a new key).

---

## 5. UI/UX — bold, thumb-friendly, readable at a glance

### 5.1 Global UI rules

- **Min tap target 56px** (draft cards already comply; audit every
  `.primary-btn`, `.buy-btn`, `.level-btn`, shop rows — several are
  ~40px today; raise padding, not font size).
- **Safe areas:** viewport-fit=cover is set but the CSS never uses
  `env(safe-area-inset-*)` — add `padding-top:
  max(16px, env(safe-area-inset-top))` to the HUD and
  `padding-bottom: max(16px, env(safe-area-inset-bottom))` to bottom
  buttons, or the notch/Dynamic Island eats the wallet bar.
- **Numbers ≥28px** for anything acted on (§1.3); body text floor 13px.
- **One primary action per screen**, full-width, saffron, Cinzel 900.
  Secondary actions are ghost buttons. No screen gets two competing
  coloured buttons.
- **All screens share one visual language:** dark `#120a05` panels,
  saffron headers, gold 2px borders, 20px radii — today the modals
  already do this; the audit is to remove the three screens that drift
  (check pre-level + draft + daily for inconsistent radii/padding).

### 5.2 Screen-by-screen

| Screen | Keep | Change (bold pass) |
|---|---|---|
| **Menu** | किला रश wordmark, army behind menu, wallet bar, menu stats | Wordmark +30% size; **army behind menu marches** (already visible — make the front rank KayKit, §3); add a pulsing **"⚔️ MARCH"** primary button; move quality/mute into one ⚙️ row; add "5 free credits"-style hook later — not now |
| **HUD** | army count, progress, score/combo, boss bar, cannon button | Army count 44px + pop (§1.3); progress bar 2× thicker with the section name above it, not inside; cannon button **pulses gold + scales 1.1×** when ready (today: only a class change); boss bar 2× thicker + cracked shield at 50% |
| **Level map** | 30 nodes, stars, boss crowns, daily card | Nodes 56px, boss nodes saffron-ringed; **current level has a marching-ant border**; add a "NEXT: <name>" banner at top so the goal is always visible |
| **Pre-level** | stars, best, enemy/gate/barrier counts, boosters, fortify | Collapse fortify into one row ("FORTIFY: 2/3 picked — 🪙 120") with an expand tap — today 3 slots × 4 buttons drown the START button; START is full-width saffron |
| **Draft (1-of-3)** | 56px cards, stack badges | Add a 3-second auto-pick timer? **No — never auto-pick.** Instead: the recommended card gets a subtle gold border (most-picked by the player historically). Keep the choice the player's. |
| **Chest** | closed→tap→reveal, coins + booster | Bigger chest emoji (72px), **coin fountain** on reveal (J7), reward number counts up 0→N over 600ms (count-up reads as "won", static text reads as "shown") |
| **Victory** | stars, army/kills/score/coins/best | Add **किला रश stamp** (§1.3), star-by-star reveal (each star pops 150ms apart with a chime), "NEXT LEVEL" as the only coloured button |
| **Defeat** | itemised breakdown, war-chest balance, revive | **Cracked-shield hero image** (CSS/SVG, not a new asset) + "FORT HAS FALLEN" in Cinzel 900 42px; breakdown rows already good; revive button shows the *cost in coins the player actually has* (grey out if unaffordable — today it shows the cost only) |
| **Shop / Daily** | rows, pips, 7-day track | Shop rows: icon 44px, BUY button 56px tall; daily track: today is saffron-filled, not just outlined |

### 5.3 FTUE — the first 30 seconds (what the player learns, in order)

| Time | What happens | What it teaches | How |
|---|---|---|---|
| 0–3s | Menu: wordmark, marching army, dhol starts on first tap | "Indian fortress war" | §3, §4.2 |
| 3–8s | Level 1 starts; **"DRAG TO STEER"** hint + arrow pulses (exists, 4s — extend to first gate) | steering | `ui-drag-hint` |
| 8–15s | First gate pair: **+10 (blue) vs −5 (red)** — the + gate is wider and glows; passing it fires J3 flash + "+10" burst | gates multiply, red hurts | `Gates.ts`, J3 |
| 15–22s | First barrier (20 HP): archers auto-fire, wood splinters, barrier breaks → **draft card appears (1-of-3)** | combat + choice | existing |
| 22–30s | Cannon button pulses gold; tapping it fires the Topkhana (J5) and clears the next wave | the cannon is the toy | §1.5, J5 |
| 30s+ | First "×2" gate appears; combo badge pops at ×2 | the addiction loop | J8 |

**Rule:** no tutorial text longer than 4 words on screen at once.
If a mechanic needs a paragraph, it is a design failure — fix the
mechanic, not the text.

---

## 6. Phased plan

**Order matters:** readability → cannon → front-rank KayKit → audio →
UI polish → arena props. Each phase ends with a Vercel preview +
Deep's phone playtest (FPS + 10s recording) before the next starts.
Effort in **build sessions** (1 session ≈ one focused subagent run).

### Phase 0 — Bold baseline (readability, no new assets) — ~1 session

- `Constants.ts`: saturate faction colours (blue `#2563EB`, red
  `#DC2626`); road darken; fog 0.006→0.0035, colour `#E8C39A`.
- `FortressEnvironment.ts`: sky gradient deepen; hemi 0.9→1.1.
- `index.html` CSS: army count 44px + pop animation; progress bar
  2× thicker; HUD text floor 13px; safe-area padding; tap targets
  ≥56px audit.
- `Gates.ts`: × values 1.5× size, pulsing gold ring on × gates, ☠ on
  − gates; `ParticleSystem.ts`: boss numbers 2.2×, saffron "+N" gate
  text.
- **Acceptance:** screenshot at arm's length — army count, gate values
  and boss bar readable without squinting; FPS unchanged.

### Phase 1 — The Topkhana cannon + core juice — ~1–2 sessions

- New `src/entities/Topkhana.ts`: procedural brass cannon trailing the
  front rank; recoil + muzzle flash + shake on fire (J5); wire to the
  existing cooldown/button (`btn-topkhana`, `Game.ts` cannon path).
- J1 squash & stretch (spawn/death), J2 hit-stop (45ms), J3 gate flash
  + number burst, J4 crowd ripple, J6 boss hit-flash, J9 haptics on
  gate/barrier.
- **Acceptance:** cannon feels like a toy (tap → boom → shake);
  gate pass feels like a win (flash + number); FPS ≥55 on Deep's phone.

### Phase 2 — KayKit front rank (the B-hybrid) — ~2 sessions

- Deep-side first: download KayKit Adventurers + Animations (free,
  itch.io — may ask for an email) and upload GLBs via github.com to
  `public/assets/characters/` (bot cannot push binaries).
- `SoldierModel.ts`: new `KayKitFrontRank` path — GLTFLoader, Knight
  (player) / Barbarian (enemy) / Rogue (elites); turban + sash + dhal
  attachments from the existing procedural geometry; two tinted atlas
  materials (blue/red multiply); `applyPlayerSkin` narrowed to
  turban/sash.
- Animations: run/walk/attack/bow/hit/death from the KayKit pack;
  150ms crossfades; death = 400ms fall + squash-pop (J1).
- Cap: 24 skinned front-rank soldiers; rest stay procedural.
  Perf gate on Deep's phone (60fps → raise to 36; <50fps → drop to 16).
- **Acceptance:** front rank visibly walks/runs/attacks/dies; back rank
  indistinguishable at distance; FPS gate passed; Indian identity
  intact in a screenshot (turban + sash + dhal visible).

### Phase 3 — Audio (real SFX layer) — ~1 session

- Deep-side: download the §4.1 sounds (SFXMint, Hazard Pay, Pixabay,
  Fantasy Forge — all CC0/royalty-free, no account except Pixabay none)
  and upload MP3s to `public/assets/sfx/`.
- `SoundManager.ts`: `playMeleeHit`, `playWaveClear`, `playUiTap`,
  chest coin/chime, crowd cheer on victory; footstep loop (0.08 vol,
  army >20); `visibilitychange` pause/resume guard.
- Crusade MP3 upload (Deep-side, still open) — verify the hook swaps
  the bed on the preview.
- **Acceptance:** every tap/hit/gate/chest has a distinct real sound;
  mute kills everything; no sound plays before the first gesture.

### Phase 4 — UI bold pass + FTUE — ~1 session

- §5.2 screen-by-screen: menu wordmark +30%, cannon ready-pulse,
  boss bar 2× + cracked shield, map marching-ant border, pre-level
  fortify collapse, chest count-up + coin fountain (J7), victory
  star-by-star reveal, defeat cracked-shield hero + affordability
  grey-out, shop/daily sizing.
- FTUE §5.3: drag hint to first gate, first-gate glow, cannon pulse
  at 22s.
- **Acceptance:** a new player reaches the first ×2 gate without
  reading anything longer than 4 words; every button ≥56px; no notch
  overlap on Deep's phone.

### Phase 5 — Arena props + victory/defeat stings — ~1 session

- Deep-side: Avramania Castle & Siege GLBs → `public/assets/props/`.
- New `src/environment/ArenaProps.ts`: 2 round towers + gatehouse +
  braziers at the boss arena (≤8 GLBs, ≤40k tris); reuse torch glow.
- J7: victory coin fountain + 0.5× slow-mo; defeat desaturation +
  cracked shield.
- J10 kill-streak slow-mo ("RAMPAGE").
- **Acceptance:** boss arena reads as a fortress gate, not an empty
  road; victory feels like a celebration, defeat like a loss worth
  avenging (not a dead end — the breakdown still shows the banked
  coins).

**Total: ~6–8 sessions + Deep's uploads (MP3, KayKit GLBs, Avramania
GLBs, SFX) and a phone playtest after every phase.**

---

## 7. Risks & open decisions for Deep

1. **A/B/C — RECOMMEND B (hybrid), Deep to confirm.** A loses the
   identity; C alone doesn't fix puppet movement; B costs the most
   sessions but keeps both. If Deep picks A, Phase 2 shrinks to ~1
   session (no turban/sash attachment work). If C, Phase 2 is replaced
   by Phase 5's props + §4 audio.
2. **90 skeletons won't fit a phone.** The hybrid cap (24) is the
   mitigation; the perf gate is Deep's phone, not the desktop. If 24
   fails, the fallback is KayKit for elites/boss only + procedural
   crowd — the game still looks bold because the front rank is what
   the camera shows.
3. **Golden-hour mood vs bold contrast.** The current warm haze *is*
   the game's mood; saturating it changes the feel. Mitigation: Phase 0
   is one session and reversible — if Deep hates it on the preview,
   revert the fog/colour values and keep only the typography + outlines.
4. **Deep-side uploads are the critical path.** MP3 (2 min), KayKit
   GLBs, Avramania GLBs, SFX MP3s — none can be pushed by the bot.
   Phase 2 cannot start until the KayKit GLBs land in
   `public/assets/characters/`.
5. **itch.io free downloads may ask for an email** — not verified;
   Deep downloads them, not the bot.
6. **Licences to re-check at ship time:** KayKit CC0 (confirmed
   2026-11-23/27), Avramania CC0 via itch.io (NOT OpenGameArt — files
   unavailable there), SFXMint/Hazard Pay/Fantasy Forge CC0, Pixabay
   Content Licence (keep track URLs), Crusade CC-BY (credit line must
   stay visible). **Never Quaternius** (licence changed Aug 2026),
   **never Freesound CC-BY-NC**.
7. **iOS has no web haptics.** Anything that *depends* on vibration
   for its feel will be mute on iPhone — every haptic moment needs a
   visual twin (flash/shake/number).
8. **Scope guard:** this plan does not change the core loop (march /
   steer / gates / barriers / boss), the 30-level map, the economy, or
   monetisation. The reference's cannon is borrowed as a *visual* and a
   *toy*, not as a new game mode. If Deep wants the Mob Control lane-push
   mode itself, that is a separate game, not a phase of this plan.
9. **Main branch is still v1.** All of this lands on
   `doomfall/engagement-loops` as draft work; merge is Deep's call after
   the phone playtests.
