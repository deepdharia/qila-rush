# Planner 1 — Gameplay & Addiction Loops: Qila Rush × Top Lords formula

**Role:** Planner 1 of 3 (Gameplay & Addiction). **Date:** 27 Nov 2026.
**Branch:** `doomfall/engagement-loops` (local HEAD `f494f15`; remote `14e870bd`).
**Status:** PLAN ONLY — no code changed, nothing built, nothing pushed.
**Reference:** Instagram post `Dd1DXu0sybp` — "Top Lords" (GAME SPARK PTE. LTD., 4.7★, 106K reviews, 5M+ downloads). The clip shows its Mob Control-style minigame, **not** its core strategy game.

## 0. Design thesis (one paragraph)

The clip's magic is not the fortress, the boss, or the art — it is **one thumb, one number, one decision**. Drag to aim a cannon, watch a stream of soldiers grow 10 → 58 → 228 → 297 through a ×99 gate, and slam the crowd into the enemy. Qila Rush already owns the hard parts of that formula — Torana multiplier gates, 1:1 crowd clashes, a boss with a health bar, a war-bonus draft, Endless Siege — but it hides them behind the wrong input: the player steers a marching blob and walks through each gate once. This plan grafts the Mob Control **cannon-stream** onto Qila Rush's fortress war, keeps the Indian identity and every system that already works, and rebuilds difficulty so the game is hard but never feels rigged. The clip ends in defeat and viewers call it "rage bait" — that is an advertisement, not a design document. Copying its difficulty would kill day-1 retention. We copy its **feeling**, not its failure rate.

## 1. The reference formula, decoded

Verified from Mob Control documentation and gameplay sources (Voodoo, Apr 2021, 302M+ installs):

| Ingredient | What it is | Why it addicts |
|---|---|---|
| **Cannon-stream** | Bottom cannon auto-fires a continuous stream of soldiers up a lane; drag left/right to aim | One-thumb input, zero learning curve, constant action |
| **Multiplier gates** | Blue `+N`, purple `×2/×3/×4`, red `−N/÷2`. Gates apply **per soldier passing through** — a thick stream through ×3 beats a thin one | The number going up IS the dopamine; timing + aim = skill |
| **1:1 crowd cancel** | Blue and red soldiers cancel each other on contact; survivors push on | Every fight is readable as arithmetic — "my 228 beats their 150" |
| **Enemy towers / base HP** | Red towers pour out waves; bases have numbered HP (e.g. 10.0K, 20.0K) | A visible wall to break; progress is a shrinking number |
| **Gold meter → Champion** | Meter charges as you fight; a giant champion launches when full | A comeback button you earn, not buy |
| **Boss levels** | Boss with HP bar (e.g. 50, 150, 1000); "Great Normie" style introductions | A wall at the end of the lane; the reason to upgrade |
| **Meta layer** | Cards, booster packs, cannon/mob/champion upgrades, base building, seasons, leagues | Sessions stretch past the arcade minute — the reason to return tomorrow |
| **Moving gates, speed pads, barricades** | Gates drift side to side; pads accelerate troops; numbered barricades absorb soldiers | Variety inside one input; mastery = hitting a moving ×3 twice |

The Top Lords clip specifically shows: winding lane, ×99 gate, count 10 → 58 → 228 → 297, golden cannon "128", blue multi-barrel cannon, "Level UP" flash, huge red horde led by an armoured boss (HP 50), ending in **"Defeat in Battle"**. Comments call it rage bait and note nobody wins. **Design consequence: the clip's difficulty is a deliberate ad hook. Qila Rush must not copy it.**

## 2. Gap analysis — what Qila Rush already has vs what is missing

Grounded in the code at `~/workspace/qila-rush/src` (branch `doomfall/engagement-loops`).

| Reference ingredient | Qila Rush today | Gap |
|---|---|---|
| Cannon-stream producer | **Missing.** `PlayerArmy` marches at 7.5/s and auto-shoots arrows; warriors come from start army + gates. A "Topkhana cannon" exists only as a button ability (`Game.triggerCannonAbility`, 3 cannonballs, 160 dmg, 10s cooldown) | **Core change:** the cannon must become the continuous soldier producer |
| Multiplier gates | **Present, skeleton form.** `Gates.ts` has Torana gates with `add`/`mult`/`sub`, gold ×2/×3, red hazards, canvas textures | Gates trigger **once**, when the marching warband's single point crosses them (`checkPlayerCollision` on playerX/playerZ). No stream passes through them; no moving gates; no golden ×5+ spectacle gates |
| 1:1 crowd cancel | **Present.** `EnemyArmy.ts:409` — "Clash! Enemy dies, player army takes casualties"; elephant tramples; graze pays 2 coins | Clash math is hidden. No live "my number vs their number" readout; no clash counter |
| Enemy towers / base HP | **Partial.** Waves spawn from `spawnWave` (patterns: line/v-shape/cluster/flank); barriers have HP (50–220+) and pay rewards; no numbered base HP | No enemy cannon/tower that visibly produces the red stream; no base-HP number to grind down |
| Gold meter → Champion | **Partial.** Commander ability (`triggerCommanderAbility`) and `cannon_reload` exist; no charge meter | No visible meter that fills during a run and launches a champion |
| Boss | **Present.** Commander Sher Khan, slam attack (6 casualties), HP bar in HUD, boss every 5th level, HP 450 + 125/tier (L30: 1075) | Single-phase boss; no enrage; HP tuned by formula, never validated against a median player's army |
| Draft (pick 1 of 3) | **Present.** `WarBonus.ts`: 10 bonuses, stacks in-run, opens after wave/barrier clear, `draft` state pauses the run | Draft has no cannon-stream bonuses (stream rate, stream width, gate luck) |
| 30-level map | **Present.** `Levels.ts`: seeded generator, 30 forts, gates/barriers/waves/boss, stars (1 win / 2 saved 12+ or 70% kills / 3 saved 25+ and 85% kills) | Level length 360–510z, ~50–70s march — good, keep. Gate layouts must be re-tuned for a stream, not a march |
| Endless Siege | **Present.** `Endless.ts`: 70z segments (~9s/wave), boss every 5th wave, scaling +10% count / +6% HP / +3% speed, ends only on defeat | Endless is the natural home of the stream formula — it becomes the "endless lane" mode with minimal changes |
| Dailies / missions / streak | **Present.** `Daily.ts`: 3 seeded missions/day, 7-day reward cycle, streak, daily challenge (seeded level) | No streak protection, no first-win bonus, no timed events |
| Economy / shop / upgrades | **Present.** `Economy.ts`: 5 tracks × 5 levels (War Party, Swift Bows, Sharp Arrows, Topkhana Drill, Iron Armour), boosters, chest (20+2n coins, 35% booster), revive 30+10n, lives 5 max / 1 per 5 min | No cannon-stream upgrade track; no soldier tiers; no fort meta |
| Fortify / war-gear | **Present.** `Fortifications.ts`, `WarGear.ts` (piercing/volley arrows, commander ability) | Fortify is pre-level only; no persistent fort progression |
| Mobile fit | **Present.** Viewport locked (`maximum-scale=1.0, user-scalable=no, viewport-fit=cover`), `touch-action: none`, drag-to-steer (`InputManager`, sensitivity 1.35), `AutoQuality` scaler (3 levels, down <45fps sustained 3s, up >57fps sustained 5s, DPR caps 2/1.5/1) | No per-frame perf budget for 200–300 soldiers; soldier cap is 120 (enemy pool 90) — **Planner 3 decides the real cap** |
| Share / FTUE | **Present.** `ShareCard.ts`, FTUE notifications ("DRAG TO STEER — AIM FOR THE BLUE GATES!") | FTUE teaches steering, not aiming a cannon — must be rewritten for the stream |

**Bottom line:** roughly 70% of the reference formula already exists in Qila Rush in skeleton form. The plan is a **graft, not a rewrite**: one new core input (the stream), gate rework, difficulty system, and addiction-layer additions — on top of systems that already work.

## 3. Phase 0 — Measure first (no gameplay change)

**Why first:** difficulty tuning without data is guessing. The current balance (boss HP 450 + 125/tier, wave growth 7%/level, barrier HP +10%/level) was set by formula and comment, never validated against a real player's army. Every later phase depends on these numbers.

1. **Telemetry (local only, no backend).** New file `src/systems/Telemetry.ts` — a tiny local event log (localStorage): per level — attempts, wins, warriors at boss, boss HP remaining on defeat, draft picks taken, session length, runs per session, day-2 return flag. Plus a hidden debug export (share the log as text). Hooks in `Game.ts` at win/defeat/draft/session boundaries. **Effort: 1 day.**
2. **Difficulty audit.** Play L1–10 on a real phone, record win rate and "army at boss" per level. Build a one-page balance sheet: for each boss level, median army arriving at the boss vs boss HP. This sheet becomes the tuning source for Phase 2. **Effort: 0.5 day.**
3. **Baseline targets (locked before Phase 1):** L1 win 100% (already guaranteed), L2–3 ≥90%, L4–9 70–85%, boss levels (5/10/15…) 55–65% first attempt. Session 3–5 runs. **Gate to Phase 1: baseline sheet exists and is filed in `planning/`.**

**Files:** new `src/systems/Telemetry.ts`; `src/systems/SaveManager.ts` (telemetry fields); `Game.ts` (hook points only); `src/ui/UIManager.ts` (debug export, hidden).

## 4. Phase 1 — The Topkhana Stream (core loop redesign)

**The one big decision, stated plainly: the cannon-stream REPLACES the marching blob as the core input. One input, not two.** The warband still marches, clashes, and shoots arrows — but warriors now come from the cannon, and the player aims the cannon instead of steering the blob. Everything else (gates, draft, boss, fortify, endless) keeps working around it.

### 4.1 What the player does (second-by-second)

1. Run starts: the Topkhana (royal cannon) sits at the fort gate at the bottom of the causeway. It **auto-fires a stream of warriors** up the lane at a base rate (start: ~6 warriors/sec, upgradeable).
2. The player **drags left/right to aim the stream** — same drag input as today (`InputManager`), now moving the cannon's aim point instead of the warband's `targetX`. One thumb, no buttons, no learning curve.
3. The stream passes through **Torana gates**. Each soldier through a gate is processed: `+N` adds soldiers to the stream, `×N` multiplies the passing stream, red `−N/÷2` shrinks it. The multiplied soldiers join the warband at the front; the warband auto-marches and clashes as today.
4. The warband auto-shoots arrows at the nearest enemy (unchanged from `PlayerArmy.handleAutoShooting`). The player never taps to attack.
5. Waves, barriers, boss, finish line — unchanged in shape, re-tuned in numbers.

### 4.2 What changes in code

| Change | Files | Notes |
|---|---|---|
| Cannon stream spawner: fire rate, aim point, stream soldier spawn (reuse the soldier pool, not the arrow pool) | `Game.ts` (new `spawnStream` in the update loop), `PlayerArmy.ts` (stream feeds `setSquadCount`/`addWarriors`), `Constants.ts` (stream rate, stream cap) | Stream soldiers are the same procedural soldiers — cheap, no skeleton. **Do not use KayKit rigged characters for the stream** (see §9, cross-planner decision) |
| Gates process a stream, not a point | `Gates.ts` (`checkPlayerCollision` → `processStream(x, z, count)`; gates stay live until the stream stops passing, not one-shot `collected`) | Keep the Torana look (pillars, kalasa finials, canvas texture). Add **moving gates** (drift side-to-side, L6+) and **golden gates** (×5, max one per level, telegraphed with a gold flash + sound) |
| Big live army counter | `UIManager.ts` (HUD), `Game.ts` | The 10 → 58 → 228 number IS the juice: huge, centre-top, pops/scales on every multiply, gold flash on ×3+. Add a "vs" readout in clashes (my count vs their count) |
| Cannon heat / volley | `Game.ts`, `UIManager.ts` | Auto-fire always in Phase 1. Skill = aim + gate choice + draft. **Hold-to-fire burst variant is a Phase 2 experiment only if playtests show no skill expression** — do not build it now |
| Soldier cap | `Constants.ts` (`MAX_SOLDIER_COUNT` 120 → 200; enemy pool 90 stays) | 200 is a planning number. **Planner 3 (mobile/perf) sets the real cap** after measuring a mid Android phone. If perf fails, cap the *rendered* soldiers and keep the *count* honest in the HUD — never fake the number |
| Gate layouts re-tuned for a stream | `Levels.ts` (gate z-positions and values), `Endless.ts` (`armEndlessSegment`) | Stream means gates are hit many times per run: lower per-gate values, more gate pairs, never both sides bad (rule already exists — keep it). Golden gate placement: exactly one per level, never before the first wave |
| FTUE rewrite | `Game.ts` (first-play notifications), `UIManager.ts` | New copy: "DRAG TO AIM THE CANNON", "STREAM THROUGH THE GOLD GATES!", "YOUR ARMY FIGHTS ON ITS OWN". First win must land within 90 seconds of install |
| Draft gains stream bonuses | `WarBonus.ts` (add 3: `stream_rate` +20% fire rate, `stream_width` +1 stream lane, `gate_luck` next gate is always good) | Draft stays pick-1-of-3 after wave/barrier clear. Existing 10 bonuses stay |

### 4.3 What is kept, changed, cut

- **Keep:** 30-level map + fort names, war-bonus draft, Endless Siege, shop/upgrades, dailies, chest, revive + failure-pays, fortify, war-gear, share card, lives, boss every 5th level.
- **Change:** input meaning (steer → aim), gate trigger (point → stream), soldier source (start army + gates → cannon stream + gates), soldier cap (120 → 200), FTUE copy, draft catalogue (+3 stream bonuses).
- **Cut:** the old "march through gate" single trigger (replaced by stream processing). Nothing else is cut in Phase 1.

### 4.4 Playtest gate before Phase 2 (real phone, not emulator)

- 10 runs on a mid Android phone: stream feels good, gates are readable at a glance, FPS ≥30 in the biggest clash, first win <90s from install, zero crashes.
- If FPS fails, Planner 3's cap ruling applies before any Phase 2 work.

**Effort: 5–8 focused days.**

## 5. Phase 2 — Fair difficulty (the anti-rage-bait system)

**Target: the median player wins 65–75% of first attempts on normal levels, 55–65% on boss levels.** This is the 60–80% success rule from casual design research: below 60% the game feels unfair and the player blames the game; above 80% it feels like a chore. The Top Lords clip's ~0% win rate is the opposite of the target.

### 5.1 Difficulty curve (locked numbers, from the Phase 0 balance sheet)

- L1: guaranteed win (already). L2–3: ≥90% (teach gates). L4–9: 70–85%. Boss levels (5/10/15/20/25/30): 55–65% first attempt, rising to ~85% after one upgrade purchase — **the boss must be beatable with a median army, not a maxed one**.
- Wave growth stays ~7%/level, barrier HP ~10%/level (current formulas are fine); the tuning lever is **boss HP and gate values**, not wave counts.

### 5.2 Dynamic difficulty (DDA) — invisible, honest, bounded

New file `src/systems/Difficulty.ts` (pure functions) + fields in `SaveManager.ts`. Rules, taken from the tested DDA blueprint:

- Track the last **6 results** per level band (L1–5, L6–10, …). Target win rate **0.70**, dead band **0.50–0.90** (do nothing inside it).
- After 6 results: win rate <0.50 → ease **one step** (enemy count −10%, enemy HP −10%); win rate >0.90 → toughen **one step** (+10%). Max **3 ease / 2 toughen** steps. One step per judgement, then wait for 6 fresh results.
- Apply at **level load only, never mid-run**. Wipe recent results when the player returns after a break (fresh watch). Count **fair losses only** — exclude quits and runs ended by the app being backgrounded.
- **Never show DDA in the UI.** No "easy mode" badge, no message. The player must always believe the win was theirs.

### 5.3 Boss-fight rules (Sher Khan)

- **HP is a promise, not a wall.** Boss HP per level is set from the Phase 0 sheet: `boss HP ≈ median army at boss × arrow DPS × pass-by window × 0.85` — i.e. a median player kills it with ~15% army to spare. Recompute the current formula (450 + 125/tier) against the sheet; expect L1 ~450 to stay and mid tiers to come down.
- **Two phases + telegraphs.** Phase 1 (100–50% HP): march + slam every ~4s (6 casualties, telegraphed 0.8s with a red ground ring + sound). Phase 2 (<50% HP, "ENRAGED"): slam every ~2.5s, summons 4 runners once, arena edges glow red. No third phase — two is enough to read.
- **Boss rewards:** 2× coins, guaranteed chest, "Boss Slayer" badge on the level map. Boss HP bar always visible with a % label.
- **Endless boss:** every 5th wave, same two phases, HP 450 + 250 per boss appearance (current `endlessBossHp` — validate against the sheet).

### 5.4 Near-miss design (the "one more try" pull)

- **Defeat screen shows exactly how close you were:** "Boss at 12% HP", "3 warriors short of the ×3 gate", "You cleared 4 of 5 waves". Never a bare "Defeat".
- **One-tap retry** (same level, no menu round-trip) + revive (coins, current 30+10n formula) + **failure-pays breakdown** (already exists — extend it with a "boss damage dealt" line so every run funds the next one).
- **Mercy rule:** after 3 consecutive losses on the same level, the next attempt starts with **one free draft pick** (visible, honest, no hidden rigging). After 5 consecutive losses, offer a **no-life-cost practice attempt**. Both are shown plainly, never silent.
- **"What would have won" tip:** one line, computed from the run (e.g. "The ×3 gate was on the left — aim there next time"). This is the single cheapest retention mechanic in the plan.

### 5.5 Playtest gate before Phase 3

- Win rates in the 60–80% band on L1–10 across 5+ real players (or 50 simulated runs); boss defeats all show near-miss data; zero "unfair" complaints in playtest notes; DDA steps visible in telemetry but invisible in the UI.

**Effort: 3–5 focused days.** Files: new `src/systems/Difficulty.ts`; `Levels.ts` (boss HP table); `BossEnemy.ts` (phases); `Game.ts` (defeat data, DDA application, mercy rule); `UIManager.ts` (near-miss defeat screen); `Economy.ts` (failure-pays extension); `SaveManager.ts` (DDA fields).

## 6. Phase 3 — Addiction systems (session, daily, progression)

### 6.1 Session targets

| Metric | Target | Why |
|---|---|---|
| Run length | 45–75s (current 50–70s — keep) | One thumb, one run, one minute |
| Runs per session | 3–5 | Enough for a chest + a draft + an upgrade decision |
| Session length | 4–7 min | Hybrid-casual bar; publisher range is 15–30 min/day across sessions |
| Sessions per day | 3–4 (morning / lunch / evening / night) | Daily loop must give a reason at each slot |
| D1 / D7 / D30 retention | ≥35% / ≥12% / ≥5% | 2026 hybrid-casual realistic baselines (GameAnalytics median D1 ~22%, D7 ~4%; top-quartile D1 ~30%, D7 6–7%; leaders D1 ~40%, D7 ~16%, D30 ~6%) |

### 6.2 Daily loop (keep + add)

**Keep:** 3 seeded missions/day, 7-day reward cycle, streak, daily challenge (seeded level) — all already in `Daily.ts`/`SaveManager.ts`.

**Add:**
- **First Win of the Day:** +50% coins on the first win each day (visible banner on the menu — the cheapest "open the game" reason there is).
- **Streak freeze:** miss one day per week without losing the streak (one freeze token, refills weekly). Streaks are the #1 churn point when they break unfairly.
- **War Horn (timed event):** 2× coins for 1 hour, twice a day (e.g. 12:00 and 19:00 local). Announced on the menu with a countdown. No backend needed — device clock, same as the daily system.
- **Daily chest:** first win of the day always opens a chest (the existing instant chest, not a timer).

**Explicitly NOT adding: chest timers.** The current chests open instantly and that is a differentiator — timers are a dark pattern that punishes the player for playing. If Deep wants timers later, that is a separate decision, not part of this plan.

### 6.3 Progression (keep + add)

**Keep:** 5 upgrade tracks × 5 levels, boosters, war-gear loadout, fortify.

**Add:**
- **Cannon track split:** `Topkhana Drill` splits into stream rate (warriors/sec) and cannon damage (bombardment) — the stream is now the core, so it needs its own upgrade identity. Costs follow the existing 80–650 curve.
- **Soldier tiers (unlock by level milestone):** Spear (L1) → Sword (L5) → Elite Guard (L10) → Royal Guard (L20). Visual + stat change (more HP/damage per soldier). Ties progression to the map, not just coins.
- **Fort Level (meta):** upgrade the home fort with coins → passive bonuses (e.g. +1 start warrior per fort level, +5% coins). Gives coins a sink beyond upgrades and a reason to return after the map is done. Small scope: 5 levels, one screen, reuse the fortify UI.
- **Milestone chests:** L5/10/15/20/25/30 grant a permanent unlock (soldier tier / fort piece / cannon skin) + a celebration screen. Every 3rd win grants a **War Chest** (2× coins + guaranteed booster).

### 6.4 Reward cadence (the loop, end to end)

Every run ends in a reward moment: win → chest; loss → spoils breakdown. Every 3rd win → War Chest. Every day → missions + first-win bonus + daily chest. Every week → streak milestone + War Horn events. Every milestone → permanent unlock. **No run may end with nothing.** A run that pays nothing teaches the player that playing is pointless.

### 6.5 Keep / change / cut — the full table

| System | Verdict | Note |
|---|---|---|
| 30-level map | KEEP | Re-tune gate layouts for the stream (Phase 1) |
| War-bonus draft | KEEP + CHANGE | Add 3 stream bonuses; keep pick-1-of-3, keep stacks |
| Endless Siege | KEEP | Becomes the "endless lane" mode; stream fits it natively |
| Shop / 5 upgrade tracks | KEEP + CHANGE | Split Topkhana into stream rate + cannon damage |
| Boosters | KEEP | +10 warriors / shield / extra cannon |
| Dailies / missions / streak | KEEP + CHANGE | Add streak freeze, first-win bonus, War Horn, daily chest |
| Victory chest | KEEP | Instant, no timers (deliberate) |
| Revive + failure-pays | KEEP + CHANGE | Add boss-damage line to the breakdown; add mercy rule |
| Fortify | KEEP + CHANGE | Add Fort Level meta (5 levels, passive bonuses) |
| War-gear loadout | KEEP | Add soldier tiers as the visual progression |
| Share card | KEEP | Add "army count" to the card (the big number is the shareable moment) |
| Lives (5 max, 1 per 5 min) | KEEP — FLAG | See §9: lives are a retention lever and a churn risk; Deep decides |
| Graze coins | KEEP | Near-miss pays 2 coins — good juice, keep |
| Old march-through-gate trigger | CUT | Replaced by stream processing (Phase 1) |
| Chest timers | CUT (do not add) | Deliberate anti-dark-pattern call |

### 6.6 Playtest gate before Phase 4

- 3-day retention check with 5+ testers: daily loop completes in <5 min, first-win bonus is noticed, streak freeze is understood, no tester reports "nothing to do".

**Effort: 3–5 focused days.** Files: `Daily.ts` (freeze, first-win, War Horn); `Economy.ts` (milestone/War Chest); `SaveManager.ts` (fort level, freeze token); `WarGear.ts` (soldier tiers); `Fortifications.ts` (fort level); `UIManager.ts` (daily hub, milestone screens); `Game.ts` (wiring).

## 7. Phase 4 — Monetization hooks (hooks only, no implementation)

No SDK is wired in this phase. No store listing, no ad network, no purchase flow. Only placement definitions and economy guardrails, so the build stays shippable without them.

### 7.1 Ads

- **Interstitial:** after every **3rd completed run**, never after a defeat, never before the first win of a session, skippable after 5s, cap 6/day. The defeat screen is sacred — a player who just lost and then gets an ad does not come back.
- **Rewarded video (player-chosen, never forced):** free revive; 2× chest; +1 life when empty; 2× coins on the next run; instant War Chest. Cooldown 10 min between the *same* reward; no daily cap otherwise.
- **FTUE:** first 3 runs are ad-free, always. The first session must end in a win and a chest, not an ad.
- **Offline:** ads need network; the game must remain fully playable offline (the existing offline-first design stays — no online gate on the core loop).

### 7.2 Pro ("Qila Royal", one-time — Deep's call on price)

- Suggested: **~₹199 / $2.99 one-time** (Deep's established pattern is one-time purchases, e.g. Glaral $6.99; Udhar Pro one-time). Price is Deep's decision.
- Includes: no interstitials; +1 max life (6); 2× daily reward; exclusive Royal Guard skin + fort banner.
- **Never gates the core loop.** Pro is convenience + cosmetics, not power. A free player must be able to beat every level.

### 7.3 Economy guardrails

- A free player earns a mid-tier upgrade roughly every **2 days** of normal play (3–4 sessions/day). If the economy is slower than that, progression feels paywalled; if faster, upgrades feel free.
- Ad/Pro revenue must never be the reason a level is hard. Difficulty is tuned by Phase 2, not by monetization.

**Effort: 2–3 focused days** (hooks + flags only). Files: new `src/systems/Ads.ts` (placement definitions, caps, cooldowns — no SDK); `UIManager.ts` (rewarded prompts); `Economy.ts` (Pro effects); `SaveManager.ts` (Pro flag, ad caps). **SDK wiring, store listing, and pricing are separate work for Deep to schedule.**

## 8. Phase 5 — Feel & spectacle (handoff to Planners 2 & 3)

This phase is listed here so the leader can see the seams; the detailed plans belong to Planner 2 (visuals) and Planner 3 (mobile/perf).

- **Juice:** army-count pop/scale on every multiply; gold flash + dhol beat on ×3+ gates; screen shake on boss slam (exists) and on golden-gate hits; slow-mo on boss kill (exists, 2.8s — keep); confetti on War Chest.
- **Sound:** dhol loop (exists, procedural) + real battle-loop MP3 (exists, hook ready); war horn on boss; distinct gate sounds (already: `playGatePass` positive/negative).
- **Haptics:** vibrate on multiply, slam, boss kill (exists in `Game.vibrate` — extend to gates).
- **KayKit characters:** Phase 3 research (5 rigged heroes + 150+ animations, CC0). **Recommendation to the leader: procedural soldiers for the stream, KayKit heroes for the champion/boss/elites only.** The stream needs cheap soldiers by the hundred; rigged characters are for the few that matter.
- **Fortress props:** Avramania CC0 GLB (walls/towers/gate) — dressing for the causeway, not gameplay.

**Effort: 3–5 focused days** (shared with Planners 2/3 — do not double-count).

## 9. Risks & open decisions for Deep

### Risks

1. **Perf vs spectacle.** 200–300 soldiers on a mid Android is the single biggest technical risk. Mitigation: Planner 3 sets the cap; Phase 1's playtest gate blocks Phase 2 if FPS fails.
2. **The rage-bait trap.** The reference clip is an ad engineered to make you feel weak. Copying its difficulty literally would crater D1 retention (median D1 is ~22%; the target is ≥35%). Mitigation: Phase 2's 65–75% win-rate band + DDA.
3. **The stream refactor is the biggest single change.** It touches the core loop, gates, input, HUD, and FTUE. Mitigation: Phase 0 telemetry first; keep the old march code behind a flag for one build so a rollback is a toggle, not a rewrite.
4. **DDA can feel rigged if it leaks.** Mitigation: invisible by design, never mentioned in UI, bounded steps, fair-losses-only.
5. **Lives (5 max, 1 per 5 min).** A retention lever that can also be the reason a player never returns — an empty-lives screen at 11pm is a churn moment. Flag, not a recommendation.
6. **No backend.** No server events, leaderboards, or remote config — all tuning ships in code. DDA is local-only. Live-ops (seasons, events) would need a backend decision later.
7. **IP.** Mob Control's *mechanics* are genre conventions (gates, crowds, cannons) — safe to adapt. Its art, names, and the Top Lords brand are not. Qila Rush keeps its own Indian fortress identity, Torana gates, and Sher Khan.
8. **Merge.** All work lands on `doomfall/engagement-loops`; main is still the original v1. The merge call (draft PR #1 vs a fresh PR) is Deep's, after the phone playtest.

### Open decisions (only Deep can make these)

1. **Cannon-stream replaces the march — yes or no?** Recommendation: yes, replace. One input, not two.
2. **DDA on or off?** Recommendation: on, invisible, bounded as specified.
3. **Lives: keep 5 lives / 5-min regen, or remove lives entirely** for a pure arcade loop with no waiting? (Affects retention design and monetization.)
4. **Ads:** interstitials yes/no, and the 1-in-3 frequency; Pro price (~₹199 suggested, his call).
5. **Chest timers:** keep instant (recommendation) or add timers later?
6. **Soldier visuals:** procedural stream + KayKit heroes only (recommendation), or KayKit for all soldiers?
7. **Session target:** 3–5 runs / 4–7 min per session — acceptable?
8. **Target audience / age rating:** affects ad policy and difficulty (kids vs teens vs adults).

## 10. Targets & measurement (what "addictive" means, in numbers)

| Metric | Baseline (industry, 2026) | Qila Rush target |
|---|---|---|
| D1 retention | Median ~22%; top quartile ~30%; leaders ~40% | **≥35%** |
| D7 retention | Median ~4%; top quartile 6–7%; leaders ~16% | **≥12%** |
| D30 retention | Median ~0.7%; top quartile 1.6–1.8%; leaders ~6% | **≥5%** |
| Session length | Hybrid-casual leaders 15–30 min/day | **4–7 min/session, 3–4 sessions/day** |
| Run length | — | **45–75s** |
| Win rate (normal levels) | 60–80% rule | **65–75% first attempt** |
| Win rate (boss levels) | — | **55–65% first attempt** |
| First win | — | **<90s from install** |
| FPS (mid Android) | — | **≥30 in the biggest clash** |
| Free-player upgrade pace | — | **1 mid upgrade per ~2 days** |

Sources: GameAnalytics 2026 Mobile & PC Gaming Benchmarks (16,262 games); Adjust Gaming App Insights 2026; Sensor Tower State of Mobile 2026; publisher bars (hyper-casual D1 >40%, CPI <$0.30–0.50). All figures are public benchmarks, not promises — Qila Rush has no analytics backend yet, so early measurement is local telemetry (Phase 0) + playtester cohorts.

## 11. Phase order & playtest gates (dependency chain)

```
Phase 0  Measure (telemetry + balance sheet)        1–2 days
   └─ GATE: baseline sheet filed
Phase 1  Topkhana Stream (core loop)                5–8 days
   └─ GATE: phone playtest — feel, readability, FPS ≥30, first win <90s
Phase 2  Fair difficulty (curve + DDA + boss)       3–5 days
   └─ GATE: win rates in band, near-miss data on every defeat
Phase 3  Addiction systems (daily + progression)    3–5 days
   └─ GATE: 3-day retention check with testers
Phase 4  Monetization hooks                         2–3 days
   └─ GATE: no ad before first win; rewarded flows work; offline play intact
Phase 5  Feel & spectacle (with Planners 2 & 3)     3–5 days
   └─ GATE: full phone playtest of the whole loop, L1–10 + Endless
```

**Total: ~17–28 focused days of build, phased, each phase gated by a real-phone playtest.** No phase starts until the previous phase's gate passes. The phone playtest is the gate for everything — no FPS numbers and no screenshots substitute for it.

## 12. Handoff notes for the leader (Planner merge)

- **Planner 2 (visuals) owns:** Torana gate readability at a glance (colour + symbol + size), cannon design, boss telegraphs (red ring, enrage glow), army-count HUD, KayKit integration scope, fortress dressing.
- **Planner 3 (mobile/perf) owns:** the real soldier cap, DPR/shadow budget, draw-call budget, input latency, battery/heat, offline-first behaviour, Capacitor packaging.
- **This planner owns:** the loop, the numbers, the difficulty system, the daily/progression design, the monetization hooks, and the targets.
- **Shared decisions (need all three + Deep):** soldier cap (perf vs spectacle), KayKit scope (stream vs heroes), lives (retention vs churn).

## Sources

- Mob Control mechanics: nayanui.com/games/mob-control; mobcontrolonline.com/how-to-play-mob-control; mistplay.com/blog/how-to-play-mob-control; taptap.io/app/33693804 (Voodoo; 302M+ installs; Apr 2021 launch).
- Top Lords clip: Instagram post `Dd1DXu0sybp`; Facebook reel 1137656248905929 (×99 gate, boss HP 50, "Defeat in Battle").
- Difficulty: 60–80% success rule (infinitynextplay.com); DDA blueprint — target 0.7, tolerance 0.2, min 6 results, ±10% steps, max 3 ease / 2 toughen (spielerando.com); fairness/no-unfair-death rules (chickenroadgame.co.in).
- Retention benchmarks 2026: GameAnalytics 2026 Benchmarks (16,262 games; median D1 ~22%, D7 ~4%, D30 ~0.7%); Adjust Gaming App Insights 2026 (D1 ~27% all-genre; hyper/hybrid-casual leaders D1 ~38–40%, D7 ~13–16%, D30 ~5–6%); Sensor Tower State of Mobile 2026; publisher bars via gametactics.io.
- Qila Rush code (all paths under `~/workspace/qila-rush/src`): `Gates.ts`, `Levels.ts`, `WarBonus.ts`, `Endless.ts`, `PlayerArmy.ts`, `EnemyArmy.ts`, `BossEnemy.ts`, `Economy.ts`, `Daily.ts`, `SaveManager.ts`, `AutoQuality.ts`, `InputManager.ts`, `Constants.ts`, `Game.ts`, `UIManager.ts`, `WarGear.ts`, `Fortifications.ts`.
