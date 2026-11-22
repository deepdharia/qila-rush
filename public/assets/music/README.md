# Battle music — drop-in slot

The game ships with a procedural dhol/nagada battle loop (zero files).
Drop a real track here and it takes over automatically — no code change.

## The file

Save the track as **`battle-loop.mp3`** in this folder
(`public/assets/music/battle-loop.mp3`). It loops during play.

## Recommended track (verified 2026-11-23)

**"Crusade" — Kevin MacLeod, 3:19, 320 kbps MP3, 7.6 MB**

Download: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Crusade.mp3
(verified live 2026-11-23: HTTP 200, 7,951,802 bytes, ffprobe 198.7 s)

## Licence — read this before shipping

"Crusade" is **CC-BY 4.0 — credit is required**. The game already shows
the credit line on the menu ("Battle music: 'Crusade' by Kevin MacLeod
(incompetech.com) — CC-BY 4.0") automatically once the track is playing.
Keep that line visible in any build that includes the file.

## How the hook works (`src/audio/SoundManager.ts`)

- On start, the game tries to load `assets/music/battle-loop.mp3`.
- File present + playback allowed → the real track loops and the
  procedural dhol layer goes quiet (the boss war-drone still fires).
- File missing (404) or autoplay blocked → the procedural loop keeps
  playing, exactly as before. Mute toggle covers both.
- No track = no behaviour change. The game never breaks without it.

## Alternatives (same slot, same credit rule)

- Incompetech: "Industrial Revolution", "Exotic Battle", "Clash Defiant",
  "Action" — all CC-BY 4.0, credit Kevin MacLeod the same way.
- FreePD "Epic and Dramatic" — CC0, no credit needed.
- Pixabay Music — Pixabay Content License, no credit needed, but keep
  the track URL + licence certificate (some tracks are Content ID'd).

## Why the MP3 is not in the repo

Binary files can't be pushed by the build bot — the track is a manual
upload (github.com → this folder). The full asset shortlist, with
licences, lives in `ATTRIBUTIONS.md` at the repo root.
