# Qila Rush — Phase 0 balance sheet (computed, NOT playtested)

**Date:** 2026-11-27. **Branch:** `doomfall/engagement-loops`.
**Method:** `generateLevel()` is deterministic (seeded), so every level's real
config was generated with an esbuild harness (`/tmp/balance-sim.ts`) and the
bounds below were computed from the code — no combat was simulated, no
numbers were guessed. **Real win rates, real army-at-boss and real boss-HP-left
come from Telemetry (Phase 0) after real play; this sheet is the baseline the
telemetry numbers will be judged against.**

## The combat model (all from the code)

- Shooters = `min(12, max(2, ceil(army × 0.35)))`; one volley per `1/3.2`s;
  arrow damage 10 → **DPS = shooters × 32**. At 120 army: 12 shooters, 384 DPS.
  At 25 army: 9 shooters, 288 DPS. (PlayerArmy.ts)
- Enemy base HP 25 (regular); champion ×5, elephant ×15. (EnemyArmy.ts,
  EnemyTypes.ts)
- Clash is 1:1 — a surviving enemy kills one player soldier and dies.
- Boss pass-by window ≈ 2.4s (Levels.ts level-1 comment). Boss HP:
  `450 + 125 × floor((n−1)/5)` → L1 450, L10 575, L20 825, L25 950, L30 1075.
- Army cap 120 (MAX_SOLDIER_COUNT). All figures below use **base stats only**
  — no upgrades, no draft bonuses, no gear, no cannon (160 dmg), no
  fortifications, no fire arrows. Those only help; the sheet is the floor.

## Bounds per level (best gate side every pair + every barrier broken)

- **MAX army at boss:** zero wave losses (arrows kill everything before
  contact). The ceiling.
- **FLOOR army at boss:** same gates/rewards, then subtract every wave enemy
  1:1 with **zero arrow kills**. The absolute worst case — it never happens
  (arrows are the whole game), so the floor is only useful where it stays
  above zero.

| Lvl | Boss | Boss HP | Start | Waves (enemies) | MAX army | FLOOR army | Boss dmg in 2.4s @MAX | Killable @MAX | Killable @25 army |
|-----|------|---------|-------|-----------------|----------|------------|----------------------|---------------|-------------------|
| 1 | Y | 450 | 8 | 4 (51) | 120 | 69 | 922 | YES | YES |
| 2 | – | – | 8 | 4 (54) | 97 | 43 | – | – | – |
| 3 | – | – | 8 | 4 (59) | 93 | 34 | – | – | – |
| 4 | – | – | 8 | 4 (62) | 117 | 55 | – | – | – |
| 5 | Y | 450 | 9 | 4 (65) | 114 | 49 | 922 | YES | YES |
| 6 | – | – | 9 | 5 (68) | 120 | 52 | – | – | – |
| 7 | – | – | 9 | 5 (73) | 120 | 47 | – | – | – |
| 8 | – | – | 9 | 5 (76) | 120 | 44 | – | – | – |
| 9 | – | – | 10 | 5 (80) | 120 | 40 | – | – | – |
| 10 | Y | 575 | 10 | 5 (83) | 120 | 37 | 922 | YES | YES |
| 11–14 | – | – | 10–11 | 5 (87–139) | 120 | 33→0 | – | – | – |
| 15 | Y | 700 | 11 | 6 (146) | 120 | 0 | 922 | YES | **NO** |
| 16–19 | – | – | 11–12 | 6 (150–166) | 120 | 0 | – | – | – |
| 20 | Y | 825 | 12 | 6 (170) | 120 | 0 | 922 | YES | **NO** |
| 21–24 | – | – | 13 | 6 (176–208) | 120 | 0 | – | – | – |
| 25 | Y | 950 | 14 | 6 (215) | 120 | 0 | 922 | **NO** | **NO** |
| 26–29 | – | – | 14–15 | 6 (221–237) | 120 | 0 | – | – | – |
| 30 | Y | 1075 | 15 | 6 (242) | 120 | 0 | 922 | **NO** | **NO** |

## Findings (what Phase 4 must deal with)

1. **The cap, not the gates, limits the army.** With the best gate side every
   time, the army hits the 120 cap as early as level 1. Gates decide *how
   fast* you cap, not *how big* you get. Real army-at-boss is set by wave
   losses — which only telemetry can measure.
2. **L1–L10 bosses are killable by arrows alone with just 25 warriors**
   (691 dmg vs 450–575 HP in the 2.4s window). **L15 and L20 need a big
   army:** at 25 warriors they fall short (691 vs 700 / 825 HP) and only a
   near-cap army (922 dmg) kills them. L25/L30 fail even at cap — see #3.
3. **L25 and L30 bosses are NOT killable by arrows alone in a 2.4s window,
   even at the full 120 cap** (922 dmg vs 950 / 1075 HP). The player MUST
   bring the cannon (160), fortifications, fire arrows or draft damage — or
   the real boss-fight window must be longer than 2.4s. Phase 4 must verify
   the real window and the real total damage on L25/L30 before touching boss
   HP. Do not nerf the boss on this sheet alone.
4. **The FLOOR bound dies at L12** (wave enemies 129 > cap 120). Past L11 the
   floor says "wiped" — which only proves arrow DPS is load-bearing, not that
   the levels are unwinnable. Ignore the floor past L11; watch telemetry's
   real army-at-boss instead.
5. **3 stars (25+ warriors saved) is possible on every level in the MAX
   bound** — again, only if wave losses stay low. Real 3-star rates come from
   telemetry.
6. **The squeeze is real and grows with level:** wave enemies grow ~7%/level
   while the army caps at 120. By L22+ the wave total (197+) is ~1.6× the cap.
   This is why the S3 scenario (L22+ wave overlap) is the perf AND the
   balance worst case.

## Desktop baseline (S1–S6 protocol — desktop leg)

- Build green (`tsc && vite build`, 2026-11-27). `dist/` = **692K total**
  (JS 656K, gzip 170K; `dist/index.html` 44K, gzip 9.4K) — inside the <1MB
  blocking-load budget. No new dependencies added in Phase 0.
- **Draw calls / FPS were NOT measured on desktop** — there is no browser in
  this build environment, and inventing numbers would be fake proof. The
  measurement happens on Deep's phone with the `?perf=1` overlay (Phase 0)
  and the playtest sheet.
- **S3 expectation, grounded in code:** ~23–24 meshes per soldier
  (SoldierModel.createSoldier: torso, sash, chest sash, waist cloth, 2
  shoulder pads, head, turban roll/cone/jewel/tail/plume, quiver, 2 arms,
  shield plate/rim/boss, bow or spear (+tip), 2 legs, 2 boots). Worst case
  210 soldiers alive (120 player + 90 enemy pool) → **~4,800–5,000 soldier
  draw calls + environment/boss/projectiles**, i.e. the ~4,500 figure the
  plan expected. Phase 3 (instancing) is what fixes this; Phase 0 only
  measures it.

## What telemetry will fill in (Phase 4 inputs)

- Real win rate per level (target band 65–75% normal, 55–65% boss).
- Real army-at-boss (median per level) — the number the boss-HP formula
  (`boss HP ≈ median army × DPS × window × 0.85`) needs.
- Real boss HP remaining on defeat (how close were the losses?).
- Draft picks taken (which bonuses players actually choose).
- Session length, runs/session, day-2 return flag.
