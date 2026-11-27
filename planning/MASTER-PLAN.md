# Qila Rush — MASTER PLAN (leader merge of 3 planner reports)

**Status:** PLAN ONLY — no code changed, nothing built, nothing pushed.
**Date:** 2026-11-27. **Branch:** `doomfall/engagement-loops` (local HEAD `f494f15`, remote `14e870bd`).
**Merged from:** `planner-1-gameplay-addiction.md` (gameplay & addiction), `planner-2-mobile-performance.md` (mobile fit & performance), `planner-3-visuals-feel.md` (visuals, feel & bold identity).
**Reference:** Instagram post `Dd1DXu0sybp` — "Top Lords" Mob Control-style minigame (cannon firing a soldier stream through an ×99 multiplier gate, upgraded cannons, boss with HP bar, ends in defeat — commenters call it rage bait).
**Rule that governs this plan:** copy the reference's **feeling**, never its failure rate. Every phase is gated by a real-phone playtest by Deep; no phase starts until the previous phase's gate passes.

---

## 0. Executive summary (10 lines)

Qila Rush becomes the Top Lords feeling with an Indian fortress soul:
one thumb aims a chunky Topkhana cannon at the bottom of the lane,
a stream of turbaned warriors pours up the causeway and multiplies
through glowing Torana gates — 10 → 58 → 228 — in big bold numbers
you can read at arm's length on a phone.
It fits a 360px phone, locks portrait, and holds 60fps on a mid
Android (30fps floor) because the crowd is instanced, not 4,500
draw calls — and every phase is proven on Deep's real phone before
the next one starts. It is addictive because every run pays, every
day gives a reason to return, and the game is hard but never rigged.

---

## 1. Resolved decisions (leader's calls — each conflict settled, with the reason)

| # | Decision | Reason (one line) |
|---|---|---|
| D1 | **Soldier cap: count cap 200 (player) / enemy pool 90 stays; skinned KayKit front rank ≤24.** | Count and rendering are separate budgets — instancing makes 200 cheap in draw calls, but skeletons don't instance, so heroes stay few. |
| D2 | **Character strategy: instance the procedural soldiers FIRST (Phase 3), then KayKit front-rank hybrid (Phase 5); fallback is KayKit for elites/boss only.** | Instancing is the proven budget win; the hybrid keeps identity without 90 skeletons; the fallback exists so a failed perf gate costs a scope cut, not a redesign. |
| D3 | **Lives: KEEP 5 max / 5-min regen, with the mercy rule and no hard wall on empty lives** (empty-lives screen always offers a free practice attempt or a rewarded ad). | Lives are a retention lever and already built; the churn risk is the dead-end screen, not the lives themselves — fix the screen, keep the lever. |
| D4 | **ONE Topkhana cannon, fixed at the fort gate (bottom of the lane)** — it is both the stream producer and the bombardment-ability source. | Matches the reference (fixed bottom cannon) and maximises the stream's travel through gates; a cannon trailing the army shortens the lane and confuses the read. |
| D5 | **Draw-call budget: ≤80 in combat, ≤40 in menu** (Planner 2's number, not Planner 3's <120). | The perf owner's stricter budget is achievable post-instancing and leaves headroom for ads later. |
| D6 | **Tap targets: primary actions ≥56px, icon buttons ≥48px hit area.** | 56 satisfies Planner 3's rule and Planner 2's 48 minimum; icons keep Planner 2's 48. |
| D7 | **Shadows: 1024 PCF on phones, off on the low tier; desktop keeps 2048.** | Planner 2's perf number; map size doesn't change the look materially. |
| D8 | **Toon materials + outlines land in Phase 5 (with KayKit), not Phase 1.** | They touch the crowd material path that instancing rebuilds in Phase 3 — do them once, together, after instancing. |
| D9 | **FTUE splits: copy change ships with the stream (Phase 2); scripted polish ships in Phase 7.** | The player must be taught the new input the moment it arrives; the glow/pulse polish can wait. |
| D10 | **Outlines (inverted hull) apply to KayKit front rank + boss + gate pillars only;** the instanced crowd gets toon shading + saturated colour, no per-soldier outlines. | Outlines on instanced meshes need a second instanced set — spend it only where the eye tracks. |
| D11 | **AutoQuality starts phones at level 1 (medium), never level 0;** outline-off becomes an extra low-tier step. | Starting high makes the player suffer 3s of stutter before the scaler reacts. |
| D12 | **Stream fallback: if Deep says NO to the stream, Phase 2 shrinks to ~2–3 days** (visible cannon + juice only), gates stay point-triggered, everything else proceeds unchanged. | The plan must survive its biggest decision going either way. |
| D13 | **Ads: hooks in Phase 9, no SDK, no ads in Play Store v1 (launch clean).** | Planner 1's hooks and Planner 2's launch-clean playbook agree; ads need headroom the perf budget must reserve first. |
| D14 | **Particle pool stays 350 max, converted to `THREE.Points` in Phase 3;** all new effects reuse the pool API. | Planner 2's conversion and Planner 3's effects agree the pool is the budget — the API must survive the conversion. |
| D15 | **Blocking load <1MB; the 7.6MB Crusade MP3, KayKit GLBs and SFX are lazy-loaded** behind the first gesture, not part of the blocking budget. | Planner 2's lazy-load rule resolves the apparent clash with the MP3 size. |
| D16 | **Soldier-tier visuals are decided in Phase 5's build** (which hero model per tier) and implemented in Phase 6. | Tiers change soldier visuals, so they must be designed after the KayKit models exist. |
| D17 | **DDA (invisible) and the mercy rule (visible) coexist:** mercy is the honest helping hand, DDA is silent numbers. | They operate on different layers — one the player sees, one they must never notice. |

---

## 2. The single phased build order

**Dependency chain:** 0 (measure) → 1 (foundation) → 2 (stream) → 3 (instance) → 4 (difficulty) → 5 (KayKit) → 6 (addiction) → 7 (audio + UI) → 8 (arena + env) → 9 (monetization hooks) → 10 (load/offline + Capacitor) → 11 (gate loop, throughout).
**Total: ~28–47 focused build days** (sum of phase ranges below), plus Deep-side uploads, playtests and store steps (calendar time on top). The two big unknowns are the stream refactor (Phase 2) and instancing (Phase 3).

### Phase 0 — Measure first (no gameplay change)
- **Goal:** numbers before changes — a gameplay baseline and a perf baseline, so no later phase is guesswork.
- **Concrete changes:** new `src/systems/Telemetry.ts` (local-only localStorage event log: attempts, wins, warriors at boss, boss HP remaining on defeat, draft picks, session length, runs/session, day-2 return flag; hooks in `Game.ts` at win/defeat/draft/session boundaries; hidden debug export in `UIManager.ts`); `?perf=1` overlay (`renderer.info` calls/tris, FPS + frame-time avg/p95, JS heap, quality level) in `Game.ts` + `index.html`; difficulty audit (play L1–10 on a real phone, record win rate and "army at boss" per level) → one-page balance sheet filed in `planning/`; run the S1–S6 measurement protocol (§5) on the floor device + one better device and record the baseline (expect ~4,500 draw calls in S3).
- **Exit criteria:** baseline sheet filed; overlay working and toggleable; S3 worst case captured in numbers.
- **Phone-playtest gate:** Deep runs the S1–S6 checklist once and confirms the numbers are real (not emulator).
- **Effort:** 1–2 days.

### Phase 1 — Mobile foundation (layout, readability, quick wins)
- **Goal:** the game fits a phone and reads bold *before* any playtest is trusted — today's layout bugs would pollute every later reading.
- **Concrete changes:** safe-area CSS (`:root` `--sat/--sab/--sal/--sar` vars; top bar `calc(var(--sat) + 8px)`; bottom HUD `calc(var(--sab) + 16px)`; `#boss-hud` → `top: calc(var(--sat) + 108px)`); first responsive layer (`max-width: 480px`, `max-height: 700px`; modals become bottom sheets on phones, max-height 86vh; level map becomes a vertical scrolling list of ≥64px cards); `.icon-btn` 42→48px; primary actions ≥56px; `overscroll-behavior: none`, `-webkit-touch-callout: none`, `user-select: none`, `contextmenu` prevention; `InputManager.ts` unified to Pointer Events (`pointerId` tracking, ~6px dead zone, steering pointer never cancelled by a cannon tap); quick wins — phones start at quality level 1, AA off + DPR 1.5 cap on phones, shadow map 1024 PCF, particle cap 120, allocation sweep (scratch `Vector3`s, reuse target/projectile lists), `visibilitychange` auto-pause; bold baseline — saturate colours (player blue `#2563EB`, enemy red `#DC2626`, road darkened to `#8A5A33`, fog 0.006→0.0035 `#E8C39A`), sky gradient deepened (`#1E40AF` → `#FDBA74`), hemisphere 0.9→1.1; typography — army count 24→44px Rajdhani 900 with saffron chip + scale-pop, progress bar 2× thicker, HUD text floor 13px; gate values 1.5× on × gates, pulsing gold ring on ×, ☠ on − gates; boss numbers 2.2×, saffron "+N" gate text.
- **Exit criteria:** §1.3 checklist passes on a 360px phone; S1–S3 re-run shows improved p95/draw calls; zero desktop regressions.
- **Phone-playtest gate:** Deep's phone — no notch/gesture-bar overlap, all buttons reachable one-thumb, numbers readable at arm's length.
- **Effort:** 2–3 days.

### Phase 2 — The Topkhana Stream (core loop redesign)
- **Goal:** the cannon-stream is the core input; the game plays like the reference and the cannon feels like a toy.
- **Concrete changes:** `Game.ts` `spawnStream` (auto-fire ~6 warriors/sec base, upgradeable; drag aims the cannon's aim point instead of steering the blob); `Gates.ts` `processStream` (gates stay live while the stream passes, not one-shot; moving gates L6+; exactly one golden ×5 gate per level, never before the first wave); big live army counter in `UIManager.ts` (pops/scales on every multiply, gold flash on ×3+) + clash "vs" readout; soldier cap **stays 120 in this phase** (raise waits for Phase 3); `Levels.ts`/`Endless.ts` gate layouts re-tuned for a stream (lower per-gate values, more gate pairs, never both sides bad); `WarBonus.ts` +3 stream bonuses (`stream_rate`, `stream_width`, `gate_luck`); FTUE copy rewrite ("DRAG TO AIM THE CANNON", "STREAM THROUGH THE GOLD GATES!", "YOUR ARMY FIGHTS ON ITS OWN"); new `src/entities/Topkhana.ts` — visible brass cannon **fixed at the fort gate** (D4), recoil + muzzle flash + shake on bombardment (existing ability, now with a body); juice J1 squash & stretch, J2 hit-stop 45ms, J3 gate flash + number burst, J4 crowd ripple, J6 boss hit-flash, J9 gate/barrier haptics; old march-through-gate trigger cut, kept behind a flag for one build so rollback is a toggle.
- **Exit criteria:** 10 runs on a mid Android phone — stream feels good, gates readable at a glance, first win <90s from install, zero crashes.
- **Phone-playtest gate:** Deep's phone — FPS ≥30 in the biggest clash; if FPS fails, Phase 3's cap ruling applies before any Phase 4 work.
- **Effort:** 6–9 days. **Blocked by Deep's stream yes/no decision (Q1).**

### Phase 3 — Instance the crowd (the big perf win)
- **Goal:** the crowd goes from ~4,500 draw calls to <60, so the cap raise becomes possible.
- **Concrete changes:** `SoldierModel.ts` → one `InstancedMesh` per soldier body part (~10 per faction, ~20 draw calls for 210 soldiers), `setColorAt` for faction robes/skins/hit-flash; `animateSoldier` math unchanged, writes per-instance matrices instead of rotating groups; telegraphs → instanced quads/rings (≤6 calls; HP bars for elites only); `Projectiles.ts` → 2 instanced meshes (arrow, cannonball); `ParticleSystem.ts` 350 meshes → one `THREE.Points` (pool API preserved, D14); then cap raise `MAX_SOLDIER_COUNT` 120→200 in `Constants.ts` (enemy pool 90 stays) + S3 re-run at 200+90 — if it fails, the cap stays 120 (or the rendered count is capped with an honest HUD number, never a faked one).
- **Exit criteria:** S3 draw calls ≤80, S3 p95 ≤33ms on the floor device at 200+90.
- **Phone-playtest gate:** Deep's phone — S3 protocol green; the biggest clash holds ≥30fps.
- **Effort:** 3–5 days.

### Phase 4 — Fair difficulty (the anti-rage-bait system)
- **Goal:** hard but never rigged — median player wins 65–75% of normal levels, 55–65% of boss levels, first attempt.
- **Concrete changes:** new `src/systems/Difficulty.ts` (DDA: last 6 results per level band, target win rate 0.70, dead band 0.50–0.90, ±10% steps, max 3 ease / 2 toughen, applied at level load only, fair losses only, never shown in UI); `Levels.ts` boss HP table from the Phase 0 sheet (boss HP ≈ median army at boss × arrow DPS × pass-by window × 0.85 — expect mid tiers to come down from 450 + 125/tier); `BossEnemy.ts` two phases (100–50%: slam ~4s, telegraphed 0.8s with red ground ring + sound; <50% "ENRAGED": slam ~2.5s, summons 4 runners once, arena edges glow red; boss HP bar always visible with % label); `UIManager.ts` near-miss defeat screen ("Boss at 12% HP", "3 warriors short of the ×3 gate", "You cleared 4 of 5 waves"); `Game.ts` mercy rule (free draft pick after 3 straight losses on the same level; no-life-cost practice attempt after 5) + one-tap retry + "what would have won" tip; `Economy.ts` failure-pays breakdown + boss-damage line.
- **Exit criteria:** win rates in the 60–80% band on L1–10 across 5+ real players (or 50 simulated runs); every defeat shows near-miss data; zero "unfair" complaints in playtest notes.
- **Phone-playtest gate:** Deep's phone + tester notes — boss defeats feel close, never cheap.
- **Effort:** 3–5 days. **DDA on/off is Deep's decision (Q3); if off, fixed curve only.**

### Phase 5 — KayKit front rank (the B-hybrid) + bold materials
- **Goal:** the front rank walks, runs, attacks and dies like real soldiers — and still reads Indian.
- **Concrete changes:** Deep-side first — download KayKit Adventurers + Animations (free, itch.io, may ask for an email) and upload GLBs via github.com to `public/assets/characters/`; `SoldierModel.ts` `KayKitFrontRank` path (GLTFLoader; player = Knight, enemy = Barbarian, elites = Rogue/Hooded Rogue; turban + sash + dhal attachments reused from the existing procedural geometry; two tinted atlas materials, blue/red multiply; `applyPlayerSkin` narrowed to turban/sash recolour, robe tint fixed per faction); animations run/walk/attack/bow/hit/death from the KayKit pack, 150ms crossfades, death = 400ms fall + squash-pop; new `src/utils/BoldMaterials.ts` (shared 3-step toon gradient map; soldiers/boss/gates → `MeshToonMaterial`, Lambert stays on road/walls); inverted-hull outlines on front rank + boss + gate pillars only (D10); soldier scale ×1.15, thicker limbs, bigger turban/shield; camera lowered 1.5 / closer 2 at army <30; front-rank cap 24 — perf gate on Deep's phone (60fps → raise to 36; <50fps → drop to 16; if the hybrid fails, fallback is KayKit for elites/boss only); tier-model table decided here (which hero model per soldier tier — needed by Phase 6).
- **Exit criteria:** front rank visibly walks/runs/attacks/dies; back rank indistinguishable at crowd distance; Indian identity intact in a screenshot (turban + sash + dhal visible).
- **Phone-playtest gate:** Deep's phone — FPS gate at 24; screenshot test.
- **Effort:** 2–4 days. **Blocked by Deep's A/B/C decision (Q2) + GLB uploads.**

### Phase 6 — Addiction systems (session, daily, progression)
- **Goal:** every run pays, every day gives a reason to return.
- **Concrete changes:** `Daily.ts` — First Win of the Day (+50% coins, visible menu banner), streak freeze (one missed day per week, token refills weekly), War Horn timed event (2× coins for 1 hour, twice a day, e.g. 12:00 and 19:00 local, menu countdown), daily chest on first win; `Economy.ts` — `Topkhana Drill` splits into stream rate + cannon damage (existing 80–650 cost curve), milestone chests at L5/10/15/20/25/30 (permanent unlock + celebration screen), War Chest every 3rd win (2× coins + guaranteed booster); `WarGear.ts` soldier tiers Spear (L1) → Sword (L5) → Elite Guard (L10) → Royal Guard (L20) (visual + stat, uses Phase 5's tier-model table); `Fortifications.ts` Fort Level meta (5 levels, passive bonuses, reuse the fortify UI); `UIManager.ts` daily hub + milestone screens; `SaveManager.ts` fort level + freeze token.
- **Exit criteria:** 3-day retention check with 5+ testers — daily loop completes in <5 min, first-win bonus noticed, streak freeze understood, no tester reports "nothing to do".
- **Phone-playtest gate:** Deep + testers — 3-day check.
- **Effort:** 3–5 days.

### Phase 7 — Audio (real SFX layer) + UI bold pass + FTUE
- **Goal:** every tap/hit/gate/chest has a real sound; every screen is bold and thumb-friendly; a new player learns by doing, not by reading.
- **Concrete changes:** Deep-side — download the SFX (SFXMint sword slashes, Hazard Pay wooshes, Pixabay crowd/coin/click, Fantasy Forge chest — all CC0/royalty-free, no Freesound CC-BY-NC, no Quaternius) and upload MP3s to `public/assets/sfx/`; `SoundManager.ts` — `playMeleeHit`, `playWaveClear`, `playUiTap`, chest coin/chime, crowd cheer on victory, footstep loop (0.08 volume, army >20), `visibilitychange` pause/resume guard (never auto-resume without a gesture); verify the Crusade MP3 hook swaps the bed on the preview (Deep-side MP3 upload); UI pass — menu wordmark +30% with pulsing "⚔️ MARCH" primary button, cannon button pulses gold + scales 1.1× when ready, boss bar 2× thicker + cracked-shield icon at 50% HP, level map marching-ant border + "NEXT: <name>" banner, pre-level fortify collapsed to one row, chest count-up 0→N over 600ms + coin fountain, victory star-by-star reveal + किला रश stamp, defeat cracked-shield hero + revive button greys out when unaffordable, shop/daily rows sized to 56px buttons; FTUE scripted — drag hint until the first gate, first gate pair glows (+10 blue wider than −5 red), cannon pulses at 22s, no on-screen text longer than 4 words.
- **Exit criteria:** every interaction has a distinct real sound; mute kills everything; no sound before the first gesture; a new player reaches the first ×2 gate without reading anything longer than 4 words; every button ≥56px (icons ≥48px); no notch overlap.
- **Phone-playtest gate:** Deep's phone — sound check + FTUE watch (10-second recording).
- **Effort:** 2–4 days.

### Phase 8 — Arena props + environment batching + stings
- **Goal:** the boss arena reads as a fortress gate, not an empty road; the environment costs ≤8 draw calls.
- **Concrete changes:** Deep-side — Avramania Castle & Siege GLBs → `public/assets/props/`; new `src/environment/ArenaProps.ts` (2 round towers + gatehouse with portcullis + braziers at the boss arena, ≤8 GLBs, ≤40k tris total; braziers reuse the torch glow sprite); `FortressEnvironment.ts` — merge static fortress geometry per material (≤8 calls), Lambert on phones, near-field-only shadow casters, tower/bastion LOD beyond ~60m, fog as the LOD curtain, geometry-leak check (counts flat across 5 level loads); J7 victory coin fountain + 0.5× slow-mo 600ms, defeat desaturation + cracked shield; J10 kill-streak slow-mo ("RAMPAGE" banner on 10 kills within 3s).
- **Exit criteria:** menu draw calls ≤40; geometries flat across level loads; arena reads as a fortress gate in a screenshot.
- **Phone-playtest gate:** Deep's phone — arena screenshot + S1/S3 re-run.
- **Effort:** 2–4 days.

### Phase 9 — Monetization hooks (hooks only, no implementation)
- **Goal:** ad/Pro placements defined and guarded — the build stays shippable without them.
- **Concrete changes:** new `src/systems/Ads.ts` (placement definitions, caps, cooldowns — **no SDK**): interstitial after every 3rd completed run (never after a defeat, never before the first win of a session, skippable after 5s, cap 6/day); rewarded video, player-chosen only (free revive, 2× chest, +1 life when empty, 2× coins on next run, instant War Chest; 10-min cooldown per reward); first 3 runs ad-free, always; `UIManager.ts` rewarded prompts; `Economy.ts` Pro effects ("Qila Royal", one-time — no interstitials, +1 max life, 2× daily reward, Royal Guard skin + fort banner; never gates the core loop); `SaveManager.ts` Pro flag + ad caps; reserve 10% perf headroom + a bottom banner safe-zone for a future AdMob.
- **Exit criteria:** no ad before the first win; rewarded flows work end-to-end (mocked); offline play fully intact.
- **Phone-playtest gate:** Deep's phone — first session ends in a win and a chest, never an ad.
- **Effort:** 2–3 days. **SDK wiring, store listing and pricing are separate work for Deep to schedule.**

### Phase 10 — Load & offline + Capacitor wrap
- **Goal:** sub-1MB blocking load, fully playable offline, an installable AAB on the floor device.
- **Concrete changes:** self-hosted subsetted woff2 fonts (Cinzel/Rajdhani/Yatra One, Latin + Devanagari only) instead of render-blocking Google Fonts; lazy music/GLB behind the first user gesture; build-size check (fail the build if `dist/` exceeds 1MB); service worker (cache-first for static assets) + `manifest.json` (fullscreen, portrait, theme colour) so the web version is installable; branded loading splash (किला रश wordmark + progress bar); `webglcontextlost` handler ("tap to reload the battle"); menu paints before the renderer initialises; Capacitor — `cap init` (`com.deepdharia.qilarush`, `webDir: 'dist'`), `add android`, icons/splash from Deep's art (1024×1024 icon, 2732×2732 splash), back-button handling (gameplay = pause, pause = resume, menu = exit prompt), SystemBars verification on a real Android 15/16 device, targetSdk 36, minSdk 24; Play Console listing + closed test (Deep-side: keystore, listing copy, screenshots, 12 testers / 14 days).
- **Exit criteria:** blocking load <1MB, time-to-first-frame <2s Wi-Fi / <3s 4G, fully playable offline after first load; AAB installs and plays on the floor device, HUD clear of system bars.
- **Phone-playtest gate:** Deep's phone — airplane-mode test + AAB install test.
- **Effort:** 2–4 days + Deep-side store steps.

### Phase 11 — Gate loop / hardening (runs throughout)
- **Goal:** no phase ships without numbers.
- **Concrete changes:** re-run the §5 protocol (S1–S6) after **every** phase; tune, don't ship, until all pass criteria hold.
- **Exit criteria:** all §5 pass criteria green on the floor device.
- **Phone-playtest gate:** the protocol itself.
- **Effort:** 0.5 day per gate run, throughout.

---

## 3. Open decisions ONLY Deep can make (one-line questions + leader recommendation)

| # | Question | Recommendation |
|---|---|---|
| Q1 | Does the cannon-stream **replace** the marching blob as the core input (one input, not two)? | **Yes, replace.** The stream is the reference's whole magic; two inputs would fight each other. If no, see fallback D12. |
| Q2 | KayKit look — **A** accept the fantasy look, **B** KayKit bodies + Indian dressing (turban/sash/dhal), or **C** skip the swap for fortress props + SFX? | **B (hybrid).** A loses the identity, C alone doesn't fix puppet movement; B keeps both. |
| Q3 | Dynamic difficulty (DDA) — **on or off?** (Invisible, bounded: target 0.70, ±10% steps, max 3 ease / 2 toughen.) | **On.** It is the only way the 65–75% win band holds across real players; it never shows in the UI. |
| Q4 | Lives — **keep 5 lives / 5-min regen, change them, or remove lives entirely** for a pure arcade loop with no waiting? | **Keep, with the mercy rule and no hard wall** (D3). Removing lives is a valid simpler game, but lives are already built and monetisation hooks use them. |
| Q5 | **Portrait-only lock** — lock the game to portrait, or support landscape too? | **Lock portrait.** The lane, gates and HUD are portrait-shaped; landscape is a second layout + camera rework. |
| Q6 | **Lowest phone to support** — which floor device? | **Snapdragon 680 / Helio G85 class, 4GB RAM, Android 11+** (Redmi Note 11 / Galaxy A14 class). A lower floor means lower budgets everywhere and a longer Phase 3. |
| Q7 | **Frame-rate floor: 30fps sustained** on the floor device, 60fps where the hardware allows? | **Yes.** 60fps floor on mid-range means cutting the crowd or accepting thermal throttling. |
| Q8 | **Shadows off by default on phones?** | **Yes.** ~15–25% frame-time cost on Adreno 610-class GPUs; AutoQuality may enable them on strong hardware. |
| Q9 | **Chest timers** — keep chests instant, or add timers later? | **Keep instant.** Timers punish the player for playing; instant chests are a differentiator. |
| Q10 | **Ads in v1, and Pro price?** (Interstitials yes/no, frequency; "Qila Royal" one-time price.) | **No ads in Play Store v1** (launch clean, add AdMob after first users); **Pro ~₹199 / $2.99 one-time** (his established pattern). |
| Q11 | **Session target: 3–5 runs / 4–7 min per session** — acceptable? | **Yes.** It is the hybrid-casual bar; the daily loop is built around it. |
| Q12 | **Target audience / age rating?** (Affects ad policy and difficulty.) | **12+ (Teen-equivalent).** Cartoon war violence, no gore; keeps ad options open. |
| Q13 | **Merge: draft PR #1 (maniac) or a fresh PR for the doomfall branch?** (Main is still original v1.) | **Fresh PR for `doomfall/engagement-loops`** after the phone playtest — it contains everything (maniac + engagement loops + Phases 1+2). |
| Q14 | **Golden cannon skin as a war-gear reward?** (Recolour + bigger muzzle flash, no new geometry.) | **Yes.** Cheap, and it is the reference's most recognisable upgrade. |

---

## 4. Deep-side dependencies (what blocks what)

| Dependency | Blocks | Notes |
|---|---|---|
| **Stream yes/no (Q1)** | Phase 2 | The whole core-loop phase. Decide before any Phase 2 work. |
| **KayKit A/B/C (Q2)** | Phase 5 | B is the plan's recommendation; A shrinks Phase 5 to ~1 day, C replaces it with props + audio. |
| **DDA on/off (Q3)** | Phase 4 | If off, fixed curve only — Phase 4 still works. |
| **Lives call (Q4)** | Phase 6 details | Keep/change/remove affects the daily loop and monetisation hooks. |
| **Floor device (Q6) + portrait lock (Q5)** | Phase 0 protocol, Phase 1 layout | The measurement protocol and the layout are built for a named device and orientation. |
| **Phone playtest after EVERY phase** | The next phase | No phase starts until the previous gate passes. This is the critical path. |
| **Crusade MP3 upload** → `public/assets/music/battle-loop.mp3` | Phase 7 audio verification only | Procedural dhol loop plays without it; nothing breaks. (Verified 3:19, 7.6MB, CC-BY; credit line already in the game.) |
| **KayKit GLB download + upload** → `public/assets/characters/` | Phase 5 | Bot cannot push binaries. itch.io free download may ask for an email. |
| **Avramania GLBs** → `public/assets/props/` | Phase 8 arena props | Same binary limit. |
| **SFX MP3s** → `public/assets/sfx/` | Phase 7 audio | Same binary limit. Total SFX budget ≤1.5MB. |
| **Icon art (1024×1024) + splash (2732×2732)** | Phase 10 Capacitor | Yatra One किला रश wordmark is the natural source. |
| **Play Console: keystore, listing, screenshots, 12 testers / 14-day closed test** | Phase 10 store launch | Same path as Udhar (personal account created after 13 Nov 2023). |
| **Merge call (Q13)** | Main branch only | Nothing on the branch is blocked by it; main stays original v1 until Deep says so. |

---

## 5. Targets — what "bold, mobile-fit, smooth, addictive" means in numbers

| Metric | Target | Source / note |
|---|---|---|
| D1 retention | **≥35%** | GameAnalytics 2026 median ~22%, top quartile ~30%, leaders ~40% |
| D7 retention | **≥12%** | Median ~4%, top quartile 6–7%, leaders ~16% |
| D30 retention | **≥5%** | Median ~0.7%, top quartile ~1.7%, leaders ~6% |
| Session length | **4–7 min, 3–4 sessions/day** | Hybrid-casual bar |
| Runs per session | **3–5** | Enough for a chest + a draft + an upgrade decision |
| Run length | **45–75s** | Current 50–70s — keep |
| First win | **<90s from install** | FTUE must land the first win fast |
| Win rate, normal levels | **65–75% first attempt** | 60–80% success rule; below 60% feels unfair, above 80% feels like a chore |
| Win rate, boss levels | **55–65% first attempt** | Rising to ~85% after one upgrade purchase |
| FPS (mid Android) | **60 target, 30 sustained floor** | No sustained dip below 28fps in a full-crowd fight |
| Frame time p95 | **≤33ms** | Floor device, worst-case scenario S3 |
| Jank (frames >50ms) | **<1% of gameplay frames** | <2% hard floor |
| Draw calls | **≤80 combat, ≤40 menu** | D5 (Planner 2's budget) |
| Triangles | **≤250k (mid Android)** | ≤400k hard floor |
| Texture memory | **≤64MB** | ≤96MB hard floor |
| JS heap | **<150MB, flat over 10 min** | No growth >5MB / 10 min |
| Battery | **<10% drain / 30 min** | Measure, don't guess |
| Free-player upgrade pace | **~1 mid upgrade per 2 days** | 3–4 sessions/day; slower feels paywalled, faster feels free |

### Measurement protocol (runs after every phase, on the floor device + one better device)

| # | Scenario | Duration | What it stresses |
|---|---|---|---|
| S1 | Menu idle | 60s | Baseline, heap flatness |
| S2 | Level 1 full run | ~50s | Normal combat |
| S3 | Level 22+ wave overlap (max crowd) | One full level | **The worst case — the gate scenario** |
| S4 | Boss arena | One boss fight | Boss meshes + slow-mo + shake |
| S5 | Endless Siege, wave 10 | 3 min | Sustained load, thermal behaviour |
| S6 | 10-min soak (S2 looped) | 10 min | Memory leak + thermal throttle check |

**Pass criteria (all must hold):** p95 ≤33ms in S3; draw calls ≤80 in S3; no heap growth >5MB across S6; no sustained dip below 28fps in any scenario; battery <10% / 30 min in S5. Plus the per-phase playtest checklist in Planner 2 §8 (notch/gesture-bar clearance, one-thumb reach, 360px overflow, offline airplane-mode test, background/resume, 5 level loads with flat geometry counts). `?perf=1` overlay + a "copy stats" button make every run pasteable back as text.

---

## 6. What is explicitly NOT in the plan (cut list)

| Cut | Why |
|---|---|
| Chest timers | Dark pattern — punishes the player for playing; instant chests are a differentiator. |
| Bloom / OutlinePass / any post-processing chain | A full-screen pass on a phone GPU; outlines via inverted hull instead. |
| Ragdoll physics | Pooled squash + sparks read better and cost nothing. |
| Per-soldier shadows | Shadows stay on the sun map; AutoQuality kills shadows first. |
| Screen shake on every kill | Fatigue; hides the numbers. Shake is for cannon/boss/barrier only. |
| Particle count above the 350 pool / a second pool | The pool is the budget; new effects reuse it. |
| Audio ducking / side-chaining | Over-engineering for a phone web game; one music layer + one SFX layer. |
| KayKit for the whole crowd (90 skeletons) | Won't fit a phone; front rank only (≤24). |
| KayKit $7.95 extra tier (3 alt textures per character) | Not now; tint + turban route is free and sufficient. |
| Freesound CC-BY-NC audio; Quaternius anything | CC-BY-NC can't go in an ad-monetised game; Quaternius licence changed Aug 2026. |
| iOS wrap | Android-first per Deep's playbook (Mac + $99/yr later, only after proof). |
| AdMob SDK in this plan | Hooks only; SDK wiring is separate work after first users. |
| Backend / leaderboards / server events / remote config | Local-only DDA + telemetry; live-ops would need a backend decision later. |
| Landscape layout | Portrait lock (Q5). |
| Old march-through-gate single trigger | Replaced by stream processing (Phase 2). |
| KayKit magic/emote clips in combat | Break the war read; run/walk/attack/bow/hit/death only. |
| Draft auto-pick timer | Never auto-pick; the choice is the player's. |
| Hold-to-fire burst variant | Only if playtests show no skill expression — not in this plan. |
| "5 free credits"-style menu hook | Later idea, not now. |
| Third boss phase | Two phases read cleanly; a third adds noise. |
| Per-skin robe colours on KayKit | Shared atlas can't do it; fixed faction tint + turban/sash recolour instead. |
| The reference's ~0% win rate ("rage bait") | An advertisement, not a design document — copying it would crater D1 retention. |

---

## 7. Risks (carried from the three plans, merged)

1. **Perf vs spectacle** — 200–300 soldiers on a mid Android is the single biggest technical risk. Mitigation: instancing (Phase 3) + the S3 gate before any cap raise.
2. **The rage-bait trap** — the reference clip is engineered to make you feel weak. Mitigation: Phase 4's 65–75% win band + DDA + near-miss design.
3. **The stream refactor is the biggest single change** — touches core loop, gates, input, HUD, FTUE. Mitigation: Phase 0 telemetry first; old march code behind a flag for one build so rollback is a toggle.
4. **DDA can feel rigged if it leaks.** Mitigation: invisible by design, never in the UI, bounded steps, fair-losses-only.
5. **Lives churn risk** — an empty-lives screen at 11pm is a churn moment. Mitigation: D3 (mercy rule + no hard wall).
6. **Thermal throttling after ~10 min** on mid-range Android. Mitigation: 30fps sustained design; scaler stays down after 2 step-downs in a session.
7. **Android WebView fragmentation** (old WebView safe-area bug; three r174 needs modern WebGL2). Mitigation: SystemBars variables, `webglcontextlost` handler, named floor device.
8. **Deep-side uploads are the critical path** — MP3, KayKit GLBs, Avramania GLBs, SFX, icon art; none can be pushed by the bot.
9. **IP** — Mob Control's mechanics are genre conventions (gates, crowds, cannons), safe to adapt; its art, names and the Top Lords brand are not. Qila Rush keeps its Indian fortress identity, Torana gates and Sher Khan.

---

## 8. Sources (planners' sources, kept for verification)

- Mob Control mechanics: nayanui.com, mobcontrolonline.com, mistplay.com (Voodoo, 302M+ installs, Apr 2021).
- Top Lords clip: Instagram post `Dd1DXu0sybp`; Facebook reel 1137656248905929 (×99 gate, boss HP 50, "Defeat in Battle").
- Difficulty: 60–80% success rule (infinitynextplay.com); DDA blueprint — target 0.7, tolerance 0.2, min 6 results, ±10% steps, max 3 ease / 2 toughen (spielerando.com).
- Retention benchmarks 2026: GameAnalytics 2026 Benchmarks (16,262 games); Adjust Gaming App Insights 2026; Sensor Tower State of Mobile 2026.
- three.js perf budgets & `renderer.info`: hontran.dev; masterallarts.com (draw calls <100 mobile / <500 desktop; triangles 200k low-end mobile).
- Touch targets & thumb zones (44pt Apple / 48dp Android; bottom third for actions): egmatic.com.
- Capacitor 8 / edge-to-edge / safe areas (targetSdk 36 required by Play since 31 Aug 2026; SystemBars; `var(--safe-area-inset-*, env(...))`): capawesome.io; guigui-tech.dev; otakit.app.
- Qila Rush code (all paths under `~/workspace/qila-rush/src`, branch `doomfall/engagement-loops`, HEAD `f494f15`): `Gates.ts`, `Levels.ts`, `WarBonus.ts`, `Endless.ts`, `PlayerArmy.ts`, `EnemyArmy.ts`, `BossEnemy.ts`, `Economy.ts`, `Daily.ts`, `SaveManager.ts`, `AutoQuality.ts`, `InputManager.ts`, `Constants.ts`, `Game.ts`, `UIManager.ts`, `WarGear.ts`, `Fortifications.ts`, `SoldierModel.ts`, `FortressEnvironment.ts`, `CanvasTextures.ts`, `ParticleSystem.ts`, `CameraManager.ts`, `SoundManager.ts`.
