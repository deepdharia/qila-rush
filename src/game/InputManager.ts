import { CONSTANTS } from '../utils/Constants';

// Phase 1 (master plan): one Pointer Events implementation replaces the
// separate mouse + touch handlers. A second pointer (e.g. a cannon-button
// tap) can never hijack or cancel steering: only the pointerId that started
// the drag steers, and it is released on pointerup / pointercancel.
const DEAD_ZONE_PX = 6; // ignore sub-6px jitter before steering starts

export class InputManager {
  private activePointerId: number | null = null;
  private lastPointerX: number = 0;
  private downX: number = 0;
  private steeringStarted: boolean = false;
  private keysPressed: { [key: string]: boolean } = {};

  public currentTargetX: number = 0;
  private sensitivity: number = 1.35;

  constructor(canvas: HTMLCanvasElement) {
    // Pointer Events need touch-action disabled on the canvas, otherwise a
    // touch drag scrolls/zooms the page instead of steering. (Set here in
    // JS so no CSS/layout file has to change.)
    canvas.style.touchAction = 'none';
    this.setupPointer(canvas);
    this.setupKeyboard();
  }

  private setupPointer(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', (e) => {
      // A second pointer never takes over an active steer.
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.downX = e.clientX;
      this.lastPointerX = e.clientX;
      this.steeringStarted = false;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw for a mouse pointer that already
        // left the canvas; the window-level up/cancel listeners below
        // still release the steer.
      }
    });

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      if (!this.steeringStarted) {
        // Dead zone: ignore jitter until the drag clearly moves.
        if (Math.abs(e.clientX - this.downX) < DEAD_ZONE_PX) return;
        this.steeringStarted = true;
        // Start measuring from here, so the dead-zone travel never jumps
        // the army sideways when steering engages.
        this.lastPointerX = e.clientX;
        return;
      }
      const deltaX = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.applyDelta(deltaX);
    };
    // Window-only on purpose: a captured pointer's events target the
    // canvas but bubble to window, so listening on both would apply every
    // delta twice. Window catches canvas drags and off-canvas drags alike.
    window.addEventListener('pointermove', onMove);

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this.steeringStarted = false;
    };
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keysPressed[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.code] = false;
    });
  }

  private applyDelta(deltaPx: number) {
    const screenWidth = window.innerWidth || 1;
    // Map screen delta to world road coordinates
    const worldDelta = (deltaPx / screenWidth) * (CONSTANTS.ROAD_WIDTH * this.sensitivity);
    this.currentTargetX += worldDelta;

    const limit = CONSTANTS.ROAD_HALF_WIDTH - 0.8;
    this.currentTargetX = Math.max(-limit, Math.min(limit, this.currentTargetX));
  }

  public update(dt: number) {
    // Keyboard continuous movement
    let moveDir = 0;
    if (this.keysPressed['ArrowLeft'] || this.keysPressed['KeyA']) {
      moveDir -= 1;
    }
    if (this.keysPressed['ArrowRight'] || this.keysPressed['KeyD']) {
      moveDir += 1;
    }

    if (moveDir !== 0) {
      const keyboardSpeed = 16.0;
      this.currentTargetX += moveDir * keyboardSpeed * dt;
      const limit = CONSTANTS.ROAD_HALF_WIDTH - 0.8;
      this.currentTargetX = Math.max(-limit, Math.min(limit, this.currentTargetX));
    }
  }

  public reset() {
    this.currentTargetX = 0;
    this.activePointerId = null;
    this.steeringStarted = false;
    this.keysPressed = {};
  }
}
