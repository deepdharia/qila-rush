# Qila Rush — Deploy (Vercel)

1. Deep's tap: Vercel dashboard → Add New → Project → import
   `deepdharia/qila-rush` (do NOT create the project via API/CLI).
2. Framework preset: **Vite**. Build command `npm run build`,
   output directory `dist` (both already set in `vercel.json`).
3. Branch to deploy: `maniac/addiction-overhaul` (or `main` after merge).
4. No env vars, no server, no backend — static site only.
   Save data lives in the player's browser (`localStorage`).
5. After import, verify in one line — open the live URL on your
   phone and confirm: menu loads, Level 1 starts, army marches,
   and the victory chest opens after the boss falls.
6. If the deploy 404s: check the Vercel project root is the repo
   root (where `package.json` lives), not a subfolder.
