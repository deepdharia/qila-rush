import { CONSTANTS } from '../utils/Constants';

export class InputManager {
  private isPointerDown: boolean = false;
  private lastPointerX: number = 0;
  private keysPressed: { [key: string]: boolean } = {};

  public currentTargetX: number = 0;
  private sensitivity: number = 1.35;

  constructor(canvas: HTMLCanvasElement) {
    this.setupMouseAndTouch(canvas);
    this.setupKeyboard();
  }

  private setupMouseAndTouch(canvas: HTMLCanvasElement) {
    // Mouse Events
    canvas.addEventListener('mousedown', (e) => {
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerDown) return;
      const deltaX = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.applyDelta(deltaX);
    });

    window.addEventListener('mouseup', () => {
      this.isPointerDown = false;
    });

    // Touch Events
    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 0) {
          this.isPointerDown = true;
          this.lastPointerX = e.touches[0].clientX;
        }
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        if (!this.isPointerDown || e.touches.length === 0) return;
        const currentX = e.touches[0].clientX;
        const deltaX = currentX - this.lastPointerX;
        this.lastPointerX = currentX;
        this.applyDelta(deltaX);
      },
      { passive: false }
    );

    window.addEventListener('touchend', () => {
      this.isPointerDown = false;
    });
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
    this.isPointerDown = false;
    this.keysPressed = {};
  }
}
