import type { LevelConfig } from '../systems/Levels';
import type { UpgradeDef } from '../systems/Economy';
import { BOOSTERS } from '../systems/Economy';
import type { MissionState } from '../systems/SaveManager';
import type { DailyReward, BoosterId } from '../systems/Daily';
import { dailyRewardForDay } from '../systems/Daily';
import type { ChestReward } from '../systems/Economy';

// Data shapes UIManager renders (Game owns the logic, this file owns the DOM).
export interface MapLevelRow {
  id: number;
  name: string;
  stars: number;
  unlocked: boolean;
  boss: boolean;
}

export interface ShopRow {
  def: UpgradeDef;
  owned: number;
  cost: number | null;
  affordable: boolean;
}

export interface PreLevelBoosterRow {
  id: BoosterId;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  owned: number;
  selected: boolean;
}

export class UIManager {
  // DOM Elements
  private uiArmyCount: HTMLElement;
  private uiProgressFill: HTMLElement;
  private uiProgressText: HTMLElement;
  private bossHud: HTMLElement;
  private uiBossHealthFill: HTMLElement;
  private floatingBanner: HTMLElement;
  private uiDragHint: HTMLElement;
  private uiBuffTray: HTMLElement;
  private btnTopkhana: HTMLElement;
  private uiCannonCd: HTMLElement;

  // Phase 3: score / combo HUD
  private uiScoreValue: HTMLElement;
  private uiComboBadge: HTMLElement;
  private uiRunCoins: HTMLElement;

  // Phase 3: wallet (menu + screens)
  private walletCoins: HTMLElement;
  private walletLives: HTMLElement;
  private walletLivesTimer: HTMLElement;
  private menuStats: HTMLElement;

  // Modals
  private startScreen: HTMLElement;
  private pauseScreen: HTMLElement;
  private victoryScreen: HTMLElement;
  private defeatScreen: HTMLElement;
  private mapScreen: HTMLElement;
  private shopScreen: HTMLElement;
  private dailyScreen: HTMLElement;
  private prelevelScreen: HTMLElement;
  private chestScreen: HTMLElement;

  // Stat texts
  private statVictoryArmy: HTMLElement;
  private statVictoryKills: HTMLElement;
  private statDefeatDist: HTMLElement;
  private statDefeatKills: HTMLElement;

  // Phase 3: victory / defeat extras
  private victoryStars: HTMLElement;
  private statVictoryScore: HTMLElement;
  private statVictoryCoins: HTMLElement;
  private statVictoryBest: HTMLElement;
  private statDefeatScore: HTMLElement;
  private btnRevive: HTMLElement;
  private reviveCostLabel: HTMLElement;

  // Phase 3: dynamic screens
  private levelGrid: HTMLElement;
  private mapCoins: HTMLElement;
  private dailyChallengeCard: HTMLElement;
  private shopList: HTMLElement;
  private shopCoins: HTMLElement;
  private dailyTrack: HTMLElement;
  private missionsList: HTMLElement;
  private btnClaimDaily: HTMLElement;
  private prelevelTitle: HTMLElement;
  private prelevelInfo: HTMLElement;
  private boosterList: HTMLElement;
  private prelevelCoins: HTMLElement;
  private chestReward: HTMLElement;
  private chestEmojiBtn: HTMLElement;
  private chestTitle: HTMLElement;

  private bannerTimeout: number | null = null;
  private dragHintTimer: number = 4.0;

  /**
   * Action callback for dynamically rendered buttons (level grid, shop rows,
   * booster rows, mission claims). Game sets this; UIManager only dispatches.
   */
  public onAction: ((action: string, data: DOMStringMap) => void) | null = null;

  constructor() {
    this.uiArmyCount = document.getElementById('ui-army-count')!;
    this.uiProgressFill = document.getElementById('ui-progress-fill')!;
    this.uiProgressText = document.getElementById('ui-progress-text')!;
    this.bossHud = document.getElementById('boss-hud')!;
    this.uiBossHealthFill = document.getElementById('ui-boss-health-fill')!;
    this.floatingBanner = document.getElementById('floating-banner')!;
    this.uiDragHint = document.getElementById('ui-drag-hint')!;
    this.uiBuffTray = document.getElementById('ui-buff-tray')!;
    this.btnTopkhana = document.getElementById('btn-topkhana')!;
    this.uiCannonCd = document.getElementById('ui-cannon-cd')!;

    this.uiScoreValue = document.getElementById('ui-score-value')!;
    this.uiComboBadge = document.getElementById('ui-combo-badge')!;
    this.uiRunCoins = document.getElementById('ui-run-coins')!;

    this.walletCoins = document.getElementById('wallet-coins')!;
    this.walletLives = document.getElementById('wallet-lives')!;
    this.walletLivesTimer = document.getElementById('wallet-lives-timer')!;
    this.menuStats = document.getElementById('menu-stats')!;

    this.startScreen = document.getElementById('start-screen')!;
    this.pauseScreen = document.getElementById('pause-screen')!;
    this.victoryScreen = document.getElementById('victory-screen')!;
    this.defeatScreen = document.getElementById('defeat-screen')!;
    this.mapScreen = document.getElementById('map-screen')!;
    this.shopScreen = document.getElementById('shop-screen')!;
    this.dailyScreen = document.getElementById('daily-screen')!;
    this.prelevelScreen = document.getElementById('prelevel-screen')!;
    this.chestScreen = document.getElementById('chest-screen')!;

    this.statVictoryArmy = document.getElementById('stat-victory-army')!;
    this.statVictoryKills = document.getElementById('stat-victory-kills')!;
    this.statDefeatDist = document.getElementById('stat-defeat-dist')!;
    this.statDefeatKills = document.getElementById('stat-defeat-kills')!;

    this.victoryStars = document.getElementById('victory-stars')!;
    this.statVictoryScore = document.getElementById('stat-victory-score')!;
    this.statVictoryCoins = document.getElementById('stat-victory-coins')!;
    this.statVictoryBest = document.getElementById('stat-victory-best')!;
    this.statDefeatScore = document.getElementById('stat-defeat-score')!;
    this.btnRevive = document.getElementById('btn-revive')!;
    this.reviveCostLabel = document.getElementById('revive-cost-label')!;

    this.levelGrid = document.getElementById('level-grid')!;
    this.mapCoins = document.getElementById('map-coins')!;
    this.dailyChallengeCard = document.getElementById('daily-challenge-card')!;
    this.shopList = document.getElementById('shop-list')!;
    this.shopCoins = document.getElementById('shop-coins')!;
    this.dailyTrack = document.getElementById('daily-track')!;
    this.missionsList = document.getElementById('missions-list')!;
    this.btnClaimDaily = document.getElementById('btn-claim-daily')!;
    this.prelevelTitle = document.getElementById('prelevel-title')!;
    this.prelevelInfo = document.getElementById('prelevel-info')!;
    this.boosterList = document.getElementById('booster-list')!;
    this.prelevelCoins = document.getElementById('prelevel-coins')!;
    this.chestReward = document.getElementById('chest-reward')!;
    this.chestEmojiBtn = document.getElementById('chest-emoji-btn')!;
    this.chestTitle = document.getElementById('chest-title')!;

    // One delegated listener for every dynamically rendered button.
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest?.('[data-action]') as HTMLElement | null;
      if (!target || !this.onAction) return;
      this.onAction(target.dataset.action ?? '', target.dataset);
    });
  }

  // ------------------------------------------------------------------ HUD

  public updateArmyCount(count: number) {
    this.uiArmyCount.textContent = count.toString();
  }

  public updateProgress(percent: number, sectionName: string = 'FORTRESS CAUSEWAY') {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this.uiProgressFill.style.width = `${clamped}%`;
    this.uiProgressText.textContent = `${sectionName} (${clamped}%)`;
  }

  /** Phase 3: live score + combo multiplier from real kills/grazes. */
  public updateScore(score: number, combo: number, multiplier: number) {
    this.uiScoreValue.textContent = score.toLocaleString('en-IN');
    if (combo >= 2) {
      this.uiComboBadge.style.display = 'inline-block';
      this.uiComboBadge.textContent = `🔥 x${multiplier} COMBO ${combo}`;
    } else {
      this.uiComboBadge.style.display = 'none';
    }
  }

  /** Coins earned so far this run (kills + grazes). */
  public updateRunCoins(coins: number) {
    this.uiRunCoins.textContent = `🪙 ${coins}`;
  }

  /** Wallet bar shown on the menu and map/shop screens. */
  public updateWallet(coins: number, lives: number, nextLifeMs: number | null) {
    this.walletCoins.textContent = `🪙 ${coins.toLocaleString('en-IN')}`;
    this.walletLives.textContent = `❤️ ${lives}/5`;
    if (nextLifeMs === null) {
      this.walletLivesTimer.textContent = 'FULL';
    } else {
      const totalSec = Math.ceil(nextLifeMs / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      this.walletLivesTimer.textContent = `+1 in ${m}:${String(s).padStart(2, '0')}`;
    }
  }

  public renderMenuStats(totalWins: number, winStreak: number, bestScore: number) {
    this.menuStats.textContent =
      `🏆 ${totalWins} wins · 🔥 ${winStreak} streak · ⭐ Best ${bestScore.toLocaleString('en-IN')}`;
  }

  public showBossHUD(show: boolean) {
    this.bossHud.style.display = show ? 'block' : 'none';
  }

  public updateBossHealth(current: number, max: number) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.uiBossHealthFill.style.width = `${pct}%`;
  }

  public showNotification(text: string, color: string = '#fef08a') {
    this.floatingBanner.textContent = text;
    this.floatingBanner.style.color = color;
    this.floatingBanner.classList.add('show');

    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      this.floatingBanner.classList.remove('show');
    }, 1600);
  }

  public updateBuffs(isFire: boolean, isDouble: boolean) {
    this.uiBuffTray.innerHTML = '';
    if (isFire) {
      const pill = document.createElement('div');
      pill.className = 'buff-pill';
      pill.innerHTML = '🔥 FLAMING ARROWS';
      this.uiBuffTray.appendChild(pill);
    }
    if (isDouble) {
      const pill = document.createElement('div');
      pill.className = 'buff-pill';
      pill.innerHTML = '🏹 DOUBLE VOLLEY';
      this.uiBuffTray.appendChild(pill);
    }
  }

  public updateCannonCooldown(ratio: number) {
    // ratio: 0 is ready, 1.0 is full cooldown
    const heightPercent = Math.max(0, Math.min(100, ratio * 100));
    this.uiCannonCd.style.height = `${heightPercent}%`;

    if (ratio <= 0.01) {
      this.btnTopkhana.classList.add('ready');
    } else {
      this.btnTopkhana.classList.remove('ready');
    }
  }

  public updateDragHint(dt: number) {
    if (this.dragHintTimer > 0) {
      this.dragHintTimer -= dt;
      if (this.dragHintTimer <= 0) {
        this.uiDragHint.style.display = 'none';
      }
    }
  }

  // ------------------------------------------------------------------ screens

  private allScreens(): HTMLElement[] {
    return [
      this.startScreen,
      this.pauseScreen,
      this.victoryScreen,
      this.defeatScreen,
      this.mapScreen,
      this.shopScreen,
      this.dailyScreen,
      this.prelevelScreen,
      this.chestScreen
    ];
  }

  public showScreen(screen: HTMLElement) {
    this.allScreens().forEach((s) => s.classList.remove('active'));
    screen.classList.add('active');
  }

  /** True while the main menu (not map/shop/daily) is the visible screen. */
  public isStartScreenActive(): boolean {
    return this.startScreen.classList.contains('active');
  }

  public showStartScreen() {
    this.showScreen(this.startScreen);
  }

  public hideStartScreen() {
    this.startScreen.classList.remove('active');
    this.uiDragHint.style.display = 'flex';
    this.dragHintTimer = 4.0;
  }

  public showPause(show: boolean) {
    if (show) {
      this.pauseScreen.classList.add('active');
    } else {
      this.pauseScreen.classList.remove('active');
    }
  }

  public showVictory(
    savedWarriors: number,
    totalKills: number,
    opts?: { stars?: number; score?: number; coins?: number; best?: number; isNewBest?: boolean }
  ) {
    this.statVictoryArmy.textContent = savedWarriors.toString();
    this.statVictoryKills.textContent = totalKills.toString();
    const stars = opts?.stars ?? 3;
    this.victoryStars.innerHTML = [1, 2, 3]
      .map((i) => `<span class="${i <= stars ? 'star-on' : 'star-off'}">${i <= stars ? '⭐' : '☆'}</span>`)
      .join('');
    this.statVictoryScore.textContent = (opts?.score ?? 0).toLocaleString('en-IN');
    this.statVictoryCoins.textContent = `🪙 +${opts?.coins ?? 0}`;
    this.statVictoryBest.textContent = (opts?.best ?? 0).toLocaleString('en-IN');
    this.victoryScreen.classList.add('active');
  }

  public showDefeat(
    distancePct: number,
    totalKills: number,
    opts?: { score?: number; reviveCost?: number; canRevive?: boolean }
  ) {
    this.statDefeatDist.textContent = `${Math.round(distancePct)}%`;
    this.statDefeatKills.textContent = totalKills.toString();
    this.statDefeatScore.textContent = (opts?.score ?? 0).toLocaleString('en-IN');
    if (opts?.canRevive) {
      this.btnRevive.style.display = 'block';
      this.reviveCostLabel.textContent = `Revive here for 🪙 ${opts.reviveCost ?? 0}`;
    } else {
      this.btnRevive.style.display = 'none';
      this.reviveCostLabel.textContent = '';
    }
    this.defeatScreen.classList.add('active');
  }

  public hideModals() {
    this.allScreens().forEach((s) => s.classList.remove('active'));
  }

  // ------------------------------------------------------------------ level map

  public renderMap(rows: MapLevelRow[], coins: number, dailyDone: boolean, dailyRewardLabel: string) {
    this.mapCoins.textContent = `🪙 ${coins.toLocaleString('en-IN')}`;
    this.levelGrid.innerHTML = rows
      .map((r) => {
        const stars = r.unlocked
          ? '★'.repeat(r.stars) + '☆'.repeat(Math.max(0, 3 - r.stars))
          : '';
        const label = r.unlocked ? `${r.id}` : '🔒';
        return `<button class="level-btn ${r.unlocked ? '' : 'locked'} ${r.boss ? 'boss-level' : ''}" data-action="select-level" data-id="${r.id}" ${r.unlocked ? '' : 'disabled'}>
          <span class="level-num">${r.boss ? '👑 ' : ''}${label}</span>
          <span class="level-stars">${stars}</span>
          <span class="level-name">${r.name}</span>
        </button>`;
      })
      .join('');
    this.dailyChallengeCard.innerHTML = dailyDone
      ? `<div class="daily-done">✅ DAILY CHALLENGE DONE — come back tomorrow!</div>`
      : `<button class="primary-btn" data-action="daily-challenge">⚔️ DAILY CHALLENGE<br><span class="daily-sub">Seeded level · reward: ${dailyRewardLabel}</span></button>`;
  }

  public showMap() {
    this.showScreen(this.mapScreen);
  }

  // ------------------------------------------------------------------ shop

  public renderShop(rows: ShopRow[], coins: number) {
    this.shopCoins.textContent = `🪙 ${coins.toLocaleString('en-IN')}`;
    this.shopList.innerHTML = rows
      .map((r) => {
        const pips = Array.from({ length: r.def.maxLevel }, (_, i) =>
          `<span class="${i < r.owned ? 'pip-on' : 'pip-off'}">●</span>`
        ).join('');
        const btn =
          r.cost === null
            ? `<span class="maxed-label">MAXED</span>`
            : `<button class="buy-btn" data-action="buy-upgrade" data-id="${r.def.id}" ${r.affordable ? '' : 'disabled'}>BUY 🪙 ${r.cost}</button>`;
        return `<div class="shop-row">
          <div class="shop-icon">${r.def.icon}</div>
          <div class="shop-info">
            <div class="shop-name">${r.def.name} <span class="shop-pips">${pips}</span></div>
            <div class="shop-desc">${r.def.desc} <b>${r.def.effectPerLevel}</b> / level</div>
          </div>
          ${btn}
        </div>`;
      })
      .join('');
  }

  public showShop() {
    this.showScreen(this.shopScreen);
  }

  // ------------------------------------------------------------------ daily rewards + missions

  public renderDaily(
    streak: number,
    canClaim: boolean,
    missions: MissionState[]
  ) {
    // 7-day track: days 1..7, current day = (streak % 7) when claimable,
    // otherwise the next unclaimed day.
    const todayIdx = canClaim ? streak % 7 : streak % 7;
    let track = '';
    for (let i = 0; i < 7; i++) {
      const reward: DailyReward = dailyRewardForDay(i);
      const isToday = i === todayIdx && canClaim;
      const isDone = !canClaim && i === ((streak - 1) % 7);
      const label = reward.booster
        ? (reward.coins > 0 ? `🪙${reward.coins} + 🎁` : '🎁 Booster')
        : `🪙 ${reward.coins}`;
      track += `<div class="daily-day ${isToday ? 'today' : ''} ${isDone ? 'done' : ''}">
        <span class="daily-day-num">DAY ${i + 1}</span>
        <span class="daily-day-reward">${label}</span>
        <span class="daily-day-state">${isDone ? '✅' : isToday ? '👈 CLAIM' : ''}</span>
      </div>`;
    }
    this.dailyTrack.innerHTML = track;
    this.btnClaimDaily.textContent = canClaim
      ? `CLAIM DAY ${((streak % 7) + 1)} REWARD`
      : `CLAIMED — COME BACK TOMORROW`;
    this.btnClaimDaily.toggleAttribute('disabled', !canClaim);

    this.missionsList.innerHTML = missions
      .map((m, idx) => {
        const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
        const action = m.claimed
          ? '<span class="mission-done">✅ CLAIMED</span>'
          : m.done
            ? `<button class="buy-btn" data-action="claim-mission" data-index="${idx}">CLAIM 🪙 ${m.reward}</button>`
            : `<span class="mission-progress">${m.progress}/${m.target}</span>`;
        return `<div class="mission-row ${m.done ? 'done' : ''}">
          <div class="mission-info">
            <div class="mission-label">${m.label}</div>
            <div class="mission-bar"><div class="mission-fill" style="width:${pct}%"></div></div>
          </div>
          ${action}
        </div>`;
      })
      .join('');
  }

  public showDaily() {
    this.showScreen(this.dailyScreen);
  }

  // ------------------------------------------------------------------ pre-level

  public renderPreLevel(
    cfg: LevelConfig,
    stars: number,
    best: number,
    boosters: PreLevelBoosterRow[],
    coins: number,
    isDaily: boolean
  ) {
    this.prelevelTitle.textContent = isDaily
      ? `⚔️ DAILY CHALLENGE — LEVEL ${cfg.id}`
      : `LEVEL ${cfg.id} — ${cfg.name.toUpperCase()}`;
    const starsText = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
    this.prelevelInfo.innerHTML =
      `<div class="prelevel-line">${starsText} &nbsp;·&nbsp; Best ${best.toLocaleString('en-IN')}</div>` +
      `<div class="prelevel-line">${cfg.boss ? '👑 Boss: Commander Sher Khan' : '🏁 Reach the finish line'} · ${cfg.totalEnemies} enemies · ${cfg.gates.length} gate pairs · ${cfg.barriers.length} barriers</div>` +
      `<div class="prelevel-line">Start army: ${cfg.startArmy} warriors · Win bonus 🪙 ${cfg.winCoins}</div>`;
    this.prelevelCoins.textContent = `🪙 ${coins.toLocaleString('en-IN')}`;
    this.boosterList.innerHTML = boosters
      .map((b) => {
        const state = b.selected
          ? 'SELECTED ✓'
          : b.owned > 0
            ? `OWNED ×${b.owned} — TAP TO USE`
            : `BUY 🪙 ${b.cost}`;
        return `<button class="booster-row ${b.selected ? 'selected' : ''}" data-action="toggle-booster" data-id="${b.id}">
          <span class="booster-icon">${b.icon}</span>
          <span class="booster-info"><b>${b.name}</b><br><span class="booster-desc">${b.desc}</span></span>
          <span class="booster-state">${state}</span>
        </button>`;
      })
      .join('');
  }

  public showPreLevel() {
    this.showScreen(this.prelevelScreen);
  }

  // ------------------------------------------------------------------ chest

  /** Show the chest closed; Game calls revealChest() after the tap. */
  public showChest(isFirst: boolean) {
    this.chestTitle.textContent = isFirst ? '🎁 YOUR FIRST CHEST!' : '🎁 VICTORY CHEST';
    this.chestReward.innerHTML = '';
    this.chestEmojiBtn.textContent = '🎁';
    this.chestEmojiBtn.removeAttribute('disabled');
    this.showScreen(this.chestScreen);
  }

  public revealChest(reward: ChestReward) {
    this.chestEmojiBtn.textContent = '✨';
    this.chestEmojiBtn.setAttribute('disabled', 'true');
    const boosterLine = reward.booster
      ? `<div class="chest-booster">🎁 +1 ${BOOSTERS.find((b) => b.id === reward.booster)?.name ?? 'Booster'}</div>`
      : '';
    this.chestReward.innerHTML =
      `<div class="chest-coins">🪙 +${reward.coins} COINS!</div>${boosterLine}`;
  }
}
