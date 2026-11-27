import type { LevelConfig } from '../systems/Levels';
import type { UpgradeDef } from '../systems/Economy';
import { BOOSTERS } from '../systems/Economy';
import type { MissionState } from '../systems/SaveManager';
import type { DailyReward, BoosterId } from '../systems/Daily';
import { dailyRewardForDay } from '../systems/Daily';
import type { ChestReward } from '../systems/Economy';
import type { WarBonusDef } from '../systems/WarBonus';
// Phase 5 (Doomfall war-gear + fortify): shop gear catalogue + pre-level
// fortification picks.
import {
  FORTIFY_DEFS,
  GEAR_SLOT_LABELS,
  type FortifyType,
  type GearDef,
  type GearSlot
} from '../systems/WarGear';

// Data shapes UIManager renders (Game owns the logic, this file owns the DOM).
export interface MapLevelRow {
  id: number;
  name: string;
  stars: number;
  unlocked: boolean;
  boss: boolean;
}

/** One draft card: the bonus def + how many times it is already stacked. */
export interface DraftChoice {
  def: WarBonusDef;
  stackCount: number;
}

export interface ShopRow {
  def: UpgradeDef;
  owned: number;
  cost: number | null;
  affordable: boolean;
}

/**
 * Phase 3 (Doomfall failure-pays): what ONE banking event credited, split
 * by source. Game builds this from run accumulators minus what a previous
 * defeat in the same run already banked, so the defeat screen shows exactly
 * what was banked — never double-counted across a revive.
 */
export interface RunCoinBreakdown {
  killCount: number;
  killCoins: number;
  grazeCount: number;
  grazeCoins: number;
  waveCount: number;
  waveCoins: number;
  bossCount: number;
  bossCoins: number;
  /** Coins this banking event actually credited. */
  total: number;
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

/** Phase 5: one shop gear card — buy once, own forever, equip for free. */
export interface GearRow {
  def: GearDef;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
}

/** Phase 5: one fortify slot on the pre-level screen (null = empty slot). */
export interface FortifySlotRow {
  slot: number;
  picked: FortifyType | null;
  /** Whether picking each type still fits the wallet (after other picks). */
  affordable: Record<FortifyType, boolean>;
}

export class UIManager {
  // DOM Elements
  private uiArmyCount: HTMLElement;
  private uiProgressFill: HTMLElement;
  private uiProgressText: HTMLElement;
  private bossHud: HTMLElement;
  private uiBossHealthFill: HTMLElement;
  private uiBossHpText: HTMLElement;
  private floatingBanner: HTMLElement;
  private uiDragHint: HTMLElement;
  private uiBuffTray: HTMLElement;
  private btnTopkhana: HTMLElement;
  private uiCannonCd: HTMLElement;

  // Phase 3: score / combo HUD
  private uiScoreValue: HTMLElement;
  private uiComboBadge: HTMLElement;
  private uiRunCoins: HTMLElement;

  // Phase 2 (Doomfall endless): wave chip + menu best line + defeat labels
  private uiWaveChip: HTMLElement;
  private endlessBestLine: HTMLElement;
  private defeatTitle: HTMLElement;
  private defeatSubtitle: HTMLElement;
  private defeatNewBest: HTMLElement;
  private statDefeatLabelDist: HTMLElement;
  private statDefeatLabelKills: HTMLElement;
  private statDefeatLabelScore: HTMLElement;
  private statDefeatLabelExtra: HTMLElement;
  private statDefeatExtra: HTMLElement;

  // Phase 3 (Doomfall failure-pays): the "loss still paid" line, the
  // itemised coin breakdown and the new war-chest balance on the defeat
  // screen (shared by level and endless defeats).
  private defeatPaysLine: HTMLElement;
  private defeatBreakdown: HTMLElement;
  private defeatBalance: HTMLElement;

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
  private chestContinueBtn: HTMLElement;
  private chestMapBtn: HTMLElement;

  // Phase 5 (Doomfall war-gear + fortify): shop gear list, pre-level
  // fortify slots + running total, commander ability HUD button.
  private gearList: HTMLElement;
  private fortifyList: HTMLElement;
  private fortifyTotal: HTMLElement;
  private btnCommander: HTMLElement;
  private commanderIcon: HTMLElement;
  private commanderTitle: HTMLElement;

  // Phase 1 (Doomfall draft): in-run war-bonus draft modal.
  private draftScreen: HTMLElement;
  private draftCards: HTMLElement;
  private draftSubtitle: HTMLElement;

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
    this.uiBossHpText = document.getElementById('ui-boss-hp-text')!;
    this.floatingBanner = document.getElementById('floating-banner')!;
    this.uiDragHint = document.getElementById('ui-drag-hint')!;
    this.uiBuffTray = document.getElementById('ui-buff-tray')!;
    this.btnTopkhana = document.getElementById('btn-topkhana')!;
    this.uiCannonCd = document.getElementById('ui-cannon-cd')!;

    this.uiScoreValue = document.getElementById('ui-score-value')!;
    this.uiComboBadge = document.getElementById('ui-combo-badge')!;
    this.uiRunCoins = document.getElementById('ui-run-coins')!;

    this.uiWaveChip = document.getElementById('ui-wave-chip')!;
    this.endlessBestLine = document.getElementById('endless-best-line')!;
    this.defeatTitle = document.getElementById('defeat-title')!;
    this.defeatSubtitle = document.getElementById('defeat-subtitle')!;
    this.defeatNewBest = document.getElementById('defeat-new-best')!;
    this.statDefeatLabelDist = document.getElementById('stat-defeat-label-dist')!;
    this.statDefeatLabelKills = document.getElementById('stat-defeat-label-kills')!;
    this.statDefeatLabelScore = document.getElementById('stat-defeat-label-score')!;
    this.statDefeatLabelExtra = document.getElementById('stat-defeat-label-extra')!;
    this.statDefeatExtra = document.getElementById('stat-defeat-extra')!;
    this.defeatPaysLine = document.getElementById('defeat-pays-line')!;
    this.defeatBreakdown = document.getElementById('defeat-breakdown')!;
    this.defeatBalance = document.getElementById('defeat-balance')!;

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
    this.chestContinueBtn = document.getElementById('btn-chest-continue')!;
    this.chestMapBtn = document.getElementById('btn-chest-map')!;

    this.gearList = document.getElementById('gear-list')!;
    this.fortifyList = document.getElementById('fortify-list')!;
    this.fortifyTotal = document.getElementById('fortify-total')!;
    this.btnCommander = document.getElementById('btn-commander')!;
    this.commanderIcon = document.getElementById('commander-icon')!;
    this.commanderTitle = document.getElementById('commander-title')!;

    this.draftScreen = document.getElementById('draft-screen')!;
    this.draftCards = document.getElementById('draft-cards')!;
    this.draftSubtitle = document.getElementById('draft-subtitle')!;

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
    // Phase 1: scale-pop on every change — remove, force a reflow, re-add
    // so the .pop animation restarts even on rapid successive updates.
    this.uiArmyCount.classList.remove('pop');
    void this.uiArmyCount.offsetWidth;
    this.uiArmyCount.classList.add('pop');
  }

  /**
   * Phase 0 — hidden debug export. Serialises the live perf snapshot and
   * the local-only telemetry snapshot as one JSON string. No UI of its own;
   * Game wires it to the ?perf=1 overlay's COPY STATS button. Nothing is
   * sent anywhere — the player chooses to copy it to their clipboard.
   */
  public buildDebugExport(perf: Record<string, unknown>, telemetry: unknown): string {
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), perf, telemetry },
      null,
      2
    );
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

  /** Phase 2 (Doomfall endless): best line under the Endless Siege button. */
  public renderEndlessBest(bestWaves: number, bestKills: number) {
    this.endlessBestLine.textContent =
      bestWaves > 0
        ? `♾️ ENDLESS BEST — WAVE ${bestWaves} · ${bestKills.toLocaleString('en-IN')} KILLS`
        : '♾️ ENDLESS SIEGE — NO RUN YET. HOW LONG CAN YOU LAST?';
  }

  /** Phase 2 (Doomfall endless): current wave chip in the HUD score row. */
  public updateWaveChip(wave: number, show: boolean) {
    if (!show) {
      if (this.uiWaveChip.style.display !== 'none') this.uiWaveChip.style.display = 'none';
      return;
    }
    const text = `🌊 WAVE ${wave}`;
    if (this.uiWaveChip.style.display !== 'inline-block' || this.uiWaveChip.textContent !== text) {
      this.uiWaveChip.style.display = 'inline-block';
      this.uiWaveChip.textContent = text;
    }
  }

  public showBossHUD(show: boolean) {
    this.bossHud.style.display = show ? 'block' : 'none';
  }

  public updateBossHealth(current: number, max: number) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.uiBossHealthFill.style.width = `${pct}%`;
    // Phase 1: boss HP as a big number next to the bar (bar-only before).
    this.uiBossHpText.textContent = `${Math.max(0, Math.ceil(current))} / ${Math.ceil(max)} HP`;
  }

  // Phase 1: gate "+N" floating text is saffron (#f59e0b) by default, matching
  // the #floating-banner CSS. NOTE: Game.ts passes an explicit colour on
  // every call today (e.g. the gate "+N WARRIORS!" call passes '#38bdf8'
  // blue), which overrides this default — the live gate text only turns
  // saffron once that Game.ts call site changes its colour argument.
  public showNotification(text: string, color: string = '#f59e0b') {
    this.floatingBanner.textContent = text;
    this.floatingBanner.style.color = color;
    this.floatingBanner.classList.add('show');

    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      this.floatingBanner.classList.remove('show');
    }, 1600);
  }

  public updateBuffs(isFire: boolean, isDouble: boolean, draftLabels: string[] = []) {
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
    // Phase 1 (Doomfall draft): one pill per stacked war bonus, e.g.
    // "⚡ RAPID FIRE ×2". Fire/double pills above are the barrier rewards;
    // draft flaming arrows shares the 🔥 pill, so it is not duplicated here.
    for (const label of draftLabels) {
      const pill = document.createElement('div');
      pill.className = 'buff-pill';
      pill.textContent = label;
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

  /**
   * Phase 5 (Doomfall war-gear): commander ability button. Shown only
   * while a commander ability is equipped; hidden for 'none'. The button
   * is usable once per run — after use it dims (class 'used') until the
   * next run re-arms it.
   */
  public showCommanderButton(icon: string, title: string) {
    this.commanderIcon.textContent = icon;
    this.commanderTitle.textContent = title;
    this.btnCommander.classList.remove('used');
    this.btnCommander.classList.add('ready');
    this.btnCommander.style.display = 'flex';
  }

  public hideCommanderButton() {
    this.btnCommander.style.display = 'none';
  }

  public setCommanderUsed(used: boolean) {
    this.btnCommander.classList.toggle('used', used);
    this.btnCommander.classList.toggle('ready', !used);
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
      this.chestScreen,
      this.draftScreen
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

  /**
   * Phase 3 (Doomfall failure-pays): renders the itemised "what this loss
   * banked" breakdown — one row per coin source that actually paid, a
   * total row, and the new war-chest balance. Sources with a zero count
   * are omitted so the list stays short on a phone screen.
   */
  private renderDefeatBreakdown(breakdown: RunCoinBreakdown, newBalance: number) {
    const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
    const rows: [string, number][] = [];
    if (breakdown.killCount > 0) {
      rows.push([`⚔️ ${breakdown.killCount} ${plural(breakdown.killCount, 'kill', 'kills')}`, breakdown.killCoins]);
    }
    if (breakdown.grazeCount > 0) {
      rows.push([`💨 ${breakdown.grazeCount} near-miss ${plural(breakdown.grazeCount, 'graze', 'grazes')}`, breakdown.grazeCoins]);
    }
    if (breakdown.waveCount > 0) {
      rows.push([`🌊 ${breakdown.waveCount} ${plural(breakdown.waveCount, 'wave', 'waves')} survived`, breakdown.waveCoins]);
    }
    if (breakdown.bossCount > 0) {
      rows.push([`👑 ${breakdown.bossCount} Sher Khan ${plural(breakdown.bossCount, 'felled', 'felled')}`, breakdown.bossCoins]);
    }
    this.defeatBreakdown.innerHTML =
      rows
        .map(
          ([label, coins]) =>
            `<div class="coin-row"><span>${label}</span><span>🪙 +${coins.toLocaleString('en-IN')}</span></div>`
        )
        .join('') +
      `<div class="coin-row coin-total"><span>Banked from this run</span><span>🪙 +${breakdown.total.toLocaleString('en-IN')}</span></div>`;
    this.defeatBalance.textContent = `🪙 WAR CHEST: ${newBalance.toLocaleString('en-IN')}`;
  }

  /** The "loss still paid" line above the breakdown — honest when the run
   *  banked nothing (a zero-kill death), celebratory when it paid. */
  private renderDefeatPaysLine(totalBanked: number, endless: boolean) {
    this.defeatPaysLine.textContent =
      totalBanked > 0
        ? endless
          ? '💰 The siege ends — but your war chest grew.'
          : '💰 Defeat — but your war chest grew.'
        : 'No coins banked this run — the next march starts fresh.';
  }

  public showDefeat(
    distancePct: number,
    totalKills: number,
    opts?: {
      score?: number;
      reviveCost?: number;
      canRevive?: boolean;
      breakdown?: RunCoinBreakdown;
      newBalance?: number;
    }
  ) {
    // The defeat screen is shared with Endless Siege, which relabels the
    // boxes — restore the level labels every time a level defeat shows.
    this.defeatTitle.textContent = 'FORT HAS FALLEN';
    this.defeatSubtitle.textContent = 'Your army was overwhelmed by the invaders!';
    this.defeatNewBest.style.display = 'none';
    this.statDefeatLabelDist.textContent = 'Distance Cleared';
    this.statDefeatLabelKills.textContent = 'Enemies Slain';
    this.statDefeatLabelScore.textContent = 'Score';
    this.statDefeatLabelExtra.textContent = 'Lives';
    this.statDefeatExtra.textContent = '-1 ❤️';
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
    // Phase 3 (Doomfall failure-pays): the loss visibly funds the next win.
    const breakdown = opts?.breakdown ?? {
      killCount: 0,
      killCoins: 0,
      grazeCount: 0,
      grazeCoins: 0,
      waveCount: 0,
      waveCoins: 0,
      bossCount: 0,
      bossCoins: 0,
      total: 0
    };
    this.renderDefeatPaysLine(breakdown.total, false);
    this.renderDefeatBreakdown(breakdown, opts?.newBalance ?? 0);
    this.defeatScreen.classList.add('active');
  }

  /**
   * Phase 2 (Doomfall endless): defeat screen for an Endless Siege run.
   * No lives lost, no revive (endless is pure — defeat ends the run), and
   * the boxes show waves survived, kills, coins earned and the best wave.
   * Phase 3 adds the itemised breakdown + war-chest balance, like levels.
   */
  public showEndlessDefeat(opts: {
    waves: number;
    kills: number;
    coins: number;
    bestWaves: number;
    newBest: boolean;
    breakdown?: RunCoinBreakdown;
    newBalance?: number;
  }) {
    this.defeatTitle.textContent = 'THE SIEGE ENDS';
    this.defeatSubtitle.textContent = `The endless siege claims another army — you held the causeway for ${opts.waves} wave${opts.waves === 1 ? '' : 's'}.`;
    this.defeatNewBest.style.display = opts.newBest ? 'block' : 'none';
    this.statDefeatLabelDist.textContent = 'Waves Survived';
    this.statDefeatDist.textContent = `${opts.waves}`;
    this.statDefeatLabelKills.textContent = 'Enemies Slain';
    this.statDefeatKills.textContent = opts.kills.toString();
    this.statDefeatLabelScore.textContent = 'Coins Earned';
    this.statDefeatScore.textContent = `🪙 +${opts.coins.toLocaleString('en-IN')}`;
    this.statDefeatLabelExtra.textContent = 'Best Waves';
    this.statDefeatExtra.textContent = `${opts.bestWaves}`;
    this.btnRevive.style.display = 'none';
    this.reviveCostLabel.textContent = '';
    const breakdown = opts?.breakdown ?? {
      killCount: 0,
      killCoins: 0,
      grazeCount: 0,
      grazeCoins: 0,
      waveCount: 0,
      waveCoins: 0,
      bossCount: 0,
      bossCoins: 0,
      total: opts.coins
    };
    this.renderDefeatPaysLine(breakdown.total, true);
    this.renderDefeatBreakdown(breakdown, opts?.newBalance ?? 0);
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

  public renderShop(rows: ShopRow[], coins: number, gearRows: GearRow[] = []) {
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
    // Phase 5 (Doomfall war-gear): buy-once gear, grouped by slot. Owned
    // gear shows EQUIP / EQUIPPED (free); unowned gear shows its price.
    // One tap buys AND equips; tapping owned gear just equips it.
    let lastSlot: GearSlot | '' = '';
    this.gearList.innerHTML = gearRows
      .map((r) => {
        const header =
          r.def.slot !== lastSlot
            ? `<div class="section-label">${GEAR_SLOT_LABELS[r.def.slot]}</div>`
            : '';
        lastSlot = r.def.slot;
        const btn = r.equipped
          ? `<span class="gear-equipped-label">✅ EQUIPPED</span>`
          : r.owned
            ? `<button class="buy-btn" data-action="gear-action" data-id="${r.def.id}">EQUIP</button>`
            : `<button class="buy-btn" data-action="gear-action" data-id="${r.def.id}" ${r.affordable ? '' : 'disabled'}>BUY 🪙 ${r.def.cost}</button>`;
        return `${header}<div class="shop-row">
          <div class="shop-icon">${r.def.icon}</div>
          <div class="shop-info">
            <div class="shop-name">${r.def.name}</div>
            <div class="shop-desc">${r.def.effect}</div>
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
    isDaily: boolean,
    fortifySlots: FortifySlotRow[] = [],
    fortifyTotalCost: number = 0,
    titleOverride?: string,
    infoOverride?: string
  ) {
    this.prelevelTitle.textContent =
      titleOverride ??
      (isDaily
        ? `⚔️ DAILY CHALLENGE — LEVEL ${cfg.id}`
        : `LEVEL ${cfg.id} — ${cfg.name.toUpperCase()}`);
    const starsText = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
    this.prelevelInfo.innerHTML = infoOverride
      ? `<div class="prelevel-line">${infoOverride}</div>`
      : `<div class="prelevel-line">${starsText} &nbsp;·&nbsp; Best ${best.toLocaleString('en-IN')}</div>` +
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
    // Phase 5 (Doomfall fortify): 3 fixed slots, one fortification each.
    // Tapping a type selects it for that slot (tap again to clear); the
    // coins are charged only when START is tapped, never on this screen.
    this.fortifyList.innerHTML = fortifySlots
      .map((s) => {
        const buttons = FORTIFY_DEFS.map((f) => {
          const selected = s.picked === f.type;
          return `<button class="fortify-type-btn ${selected ? 'selected' : ''}" data-action="fortify-pick" data-slot="${s.slot}" data-type="${f.type}" ${!selected && !s.affordable[f.type] ? 'disabled' : ''} title="${f.effect}">
            ${f.icon} ${f.name}<span class="fortify-cost">🪙 ${f.cost}</span>
          </button>`;
        }).join('');
        return `<div class="fortify-slot">
          <div class="fortify-slot-label">SLOT ${s.slot + 1} — ${s.picked ? FORTIFY_DEFS.find((f) => f.type === s.picked)!.name.toUpperCase() : 'EMPTY'}</div>
          <div class="fortify-types">${buttons}</div>
        </div>`;
      })
      .join('');
    this.fortifyTotal.textContent =
      fortifySlots.length > 0
        ? fortifyTotalCost > 0
          ? `FORTIFY TOTAL: 🪙 ${fortifyTotalCost} — charged when the battle starts`
          : 'No fortifications picked — the causeway stands bare.'
        : '';
  }

  public showPreLevel() {
    this.showScreen(this.prelevelScreen);
  }

  // ------------------------------------------------------------------ chest

  /** Show the chest closed; Game calls revealChest() after the tap.
   *  CONTINUE / LEVEL MAP stay hidden until the chest is opened, so the
   *  reward can never be discarded by leaving early. */
  public showChest(isFirst: boolean) {
    this.chestTitle.textContent = isFirst ? '🎁 YOUR FIRST CHEST!' : '🎁 VICTORY CHEST';
    this.chestReward.innerHTML = '';
    this.chestEmojiBtn.textContent = '🎁';
    this.chestEmojiBtn.removeAttribute('disabled');
    this.chestContinueBtn.style.display = 'none';
    this.chestMapBtn.style.display = 'none';
    this.showScreen(this.chestScreen);
  }

  public revealChest(reward: ChestReward) {
    this.chestEmojiBtn.textContent = '✨';
    this.chestEmojiBtn.setAttribute('disabled', 'true');
    this.chestContinueBtn.style.display = '';
    this.chestMapBtn.style.display = '';
    const boosterLine = reward.booster
      ? `<div class="chest-booster">🎁 +1 ${BOOSTERS.find((b) => b.id === reward.booster)?.name ?? 'Booster'}</div>`
      : '';
    this.chestReward.innerHTML =
      `<div class="chest-coins">🪙 +${reward.coins} COINS!</div>${boosterLine}`;
  }

  // ------------------------------------------------------------------ war-bonus draft (Phase 1, Doomfall)

  /**
   * Shows the 1-of-3 draft. Each card is a big tappable button (min 56px
   * tall) with icon + name + one-line effect; a bonus already owned this
   * run shows its stack count ("×2") so re-picking it reads as stacking.
   * Picks dispatch via the shared delegated listener as data-action
   * "draft-pick" — Game handles the choice.
   */
  public showDraft(choices: DraftChoice[], source: 'barrier' | 'wave') {
    this.draftSubtitle.textContent =
      source === 'barrier'
        ? 'Barrier smashed! Choose one war bonus — it lasts this run only.'
        : 'Wave cleared! Choose one war bonus — it lasts this run only.';
    this.draftCards.innerHTML = choices
      .map((c) => {
        const stack =
          c.stackCount > 0 ? `<span class="draft-stack">×${c.stackCount + 1} STACK</span>` : '';
        return `<button class="draft-card" data-action="draft-pick" data-id="${c.def.id}">
          <span class="draft-icon">${c.def.icon}</span>
          <span class="draft-info">
            <span class="draft-name">${c.def.name} ${stack}</span>
            <span class="draft-effect">${c.def.effect}</span>
          </span>
        </button>`;
      })
      .join('');
    this.draftScreen.classList.add('active');
  }

  public hideDraft() {
    this.draftScreen.classList.remove('active');
  }

  /** True while the draft modal is open (Game's 'draft' state mirrors it). */
  public isDraftOpen(): boolean {
    return this.draftScreen.classList.contains('active');
  }
}
