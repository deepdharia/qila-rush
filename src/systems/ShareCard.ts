// Phase 3 — Share card: render a score card (level, stars, score, coins
// earned) to a canvas and offer it via navigator.share with a download
// fallback. No external services, no uploads.

export interface ShareCardData {
  levelName: string;
  levelId: number;
  stars: number;
  score: number;
  coinsEarned: number;
  kills: number;
  bestScore: number;
  winStreak: number;
}

export function renderShareCard(d: ShareCardData): HTMLCanvasElement {
  const W = 900;
  const H = 1125;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background: dusk gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1c0f05');
  bg.addColorStop(0.55, '#3a1c07');
  bg.addColorStop(1, '#120a05');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Gold frame
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 10;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.textAlign = 'center';

  // Title
  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 96px Cinzel, serif';
  ctx.fillText('QILA RUSH', W / 2, 170);
  ctx.fillStyle = '#fef3c7';
  ctx.font = '700 34px Rajdhani, sans-serif';
  ctx.fillText('🏰 FORTRESS CONQUERED 🏰', W / 2, 225);

  // Level
  ctx.fillStyle = '#fde68a';
  ctx.font = '800 44px Rajdhani, sans-serif';
  ctx.fillText(`LEVEL ${d.levelId} — ${d.levelName.toUpperCase()}`, W / 2, 320);

  // Stars (real, earned)
  ctx.font = '96px serif';
  const stars = '★'.repeat(d.stars) + '☆'.repeat(Math.max(0, 3 - d.stars));
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(stars, W / 2, 440);

  // Stats
  const rows: [string, string][] = [
    ['SCORE', d.score.toLocaleString('en-IN')],
    ['ENEMIES SLAIN', String(d.kills)],
    ['COINS EARNED', `🪙 ${d.coinsEarned}`],
    ['BEST SCORE', d.bestScore.toLocaleString('en-IN')],
    ['WIN STREAK', `🔥 ${d.winStreak}`]
  ];
  let y = 560;
  for (const [label, value] of rows) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '700 30px Rajdhani, sans-serif';
    ctx.fillText(label, W / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 56px Cinzel, serif';
    ctx.fillText(value, W / 2, y + 62);
    y += 128;
  }

  // Footer
  ctx.fillStyle = '#f59e0b';
  ctx.font = '700 32px Rajdhani, sans-serif';
  ctx.fillText('Can you beat my score?', W / 2, H - 110);

  return canvas;
}

function canvasToFile(canvas: HTMLCanvasElement): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new File([blob], 'qila-rush-score.png', { type: 'image/png' }));
    }, 'image/png');
  });
}

/**
 * Share the card. Returns 'shared' when the native share sheet took it,
 * 'downloaded' when we fell back to a file download, 'failed' otherwise.
 */
export async function shareScoreCard(
  canvas: HTMLCanvasElement
): Promise<'shared' | 'downloaded' | 'failed'> {
  const file = await canvasToFile(canvas);
  if (!file) return 'failed';

  try {
    if (
      typeof navigator !== 'undefined' &&
      'share' in navigator &&
      'canShare' in navigator &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: 'Qila Rush — Fortress Conquered!',
        text: 'I conquered the fort in Qila Rush. Can you beat my score?'
      });
      return 'shared';
    }
  } catch {
    // User dismissed the sheet, or share failed — fall through to download.
  }

  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qila-rush-score.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
