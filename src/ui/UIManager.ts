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

  // Modals
  private startScreen: HTMLElement;
  private pauseScreen: HTMLElement;
  private victoryScreen: HTMLElement;
  private defeatScreen: HTMLElement;

  // Stat texts
  private statVictoryArmy: HTMLElement;
  private statVictoryKills: HTMLElement;
  private statDefeatDist: HTMLElement;
  private statDefeatKills: HTMLElement;

  private bannerTimeout: number | null = null;
  private dragHintTimer: number = 4.0;

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

    this.startScreen = document.getElementById('start-screen')!;
    this.pauseScreen = document.getElementById('pause-screen')!;
    this.victoryScreen = document.getElementById('victory-screen')!;
    this.defeatScreen = document.getElementById('defeat-screen')!;

    this.statVictoryArmy = document.getElementById('stat-victory-army')!;
    this.statVictoryKills = document.getElementById('stat-victory-kills')!;
    this.statDefeatDist = document.getElementById('stat-defeat-dist')!;
    this.statDefeatKills = document.getElementById('stat-defeat-kills')!;
  }

  public updateArmyCount(count: number) {
    this.uiArmyCount.textContent = count.toString();
  }

  public updateProgress(percent: number, sectionName: string = 'FORTRESS CAUSEWAY') {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this.uiProgressFill.style.width = `${clamped}%`;
    this.uiProgressText.textContent = `${sectionName} (${clamped}%)`;
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

  public showStartScreen() {
    this.startScreen.classList.add('active');
    this.pauseScreen.classList.remove('active');
    this.victoryScreen.classList.remove('active');
    this.defeatScreen.classList.remove('active');
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

  public showVictory(savedWarriors: number, totalKills: number) {
    this.statVictoryArmy.textContent = savedWarriors.toString();
    this.statVictoryKills.textContent = totalKills.toString();
    this.victoryScreen.classList.add('active');
  }

  public showDefeat(distancePct: number, totalKills: number) {
    this.statDefeatDist.textContent = `${Math.round(distancePct)}%`;
    this.statDefeatKills.textContent = totalKills.toString();
    this.defeatScreen.classList.add('active');
  }

  public hideModals() {
    this.startScreen.classList.remove('active');
    this.pauseScreen.classList.remove('active');
    this.victoryScreen.classList.remove('active');
    this.defeatScreen.classList.remove('active');
  }
}
