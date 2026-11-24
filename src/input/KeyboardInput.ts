export interface InputState {
  throttle: number;
  brake: number;
  steer: number; // +1 = left, -1 = right
  handbrake: boolean;
}

export function mergeInputStates(a: InputState, b: InputState): InputState {
  return {
    throttle: Math.max(a.throttle, b.throttle),
    brake: Math.max(a.brake, b.brake),
    steer: Math.max(-1, Math.min(1, a.steer + b.steer)),
    handbrake: a.handbrake || b.handbrake,
  };
}

export interface InputActions {
  cycleCamera: boolean;
  resetCar: boolean;
  toggleFps: boolean;
  toggleGarage: boolean;
  closeGarage: boolean;
  cycleTimeOfDay: boolean;
  toggleMute: boolean;
}

const PREVENT_DEFAULT_CODES = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

export class KeyboardInput {
  private readonly pressed = new Set<string>();
  private cycleCameraQueued = false;
  private resetCarQueued = false;
  private toggleFpsQueued = false;
  private toggleGarageQueued = false;
  private closeGarageQueued = false;
  private cycleTimeOfDayQueued = false;
  private toggleMuteQueued = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (PREVENT_DEFAULT_CODES.has(e.code)) {
      e.preventDefault();
    }

    if (!e.repeat) {
      if (e.code === 'KeyC') {
        this.cycleCameraQueued = true;
      } else if (e.code === 'KeyR') {
        this.resetCarQueued = true;
      } else if (e.code === 'KeyF') {
        this.toggleFpsQueued = true;
      } else if (e.code === 'KeyG') {
        this.toggleGarageQueued = true;
      } else if (e.code === 'Escape') {
        this.closeGarageQueued = true;
      } else if (e.code === 'KeyN') {
        this.cycleTimeOfDayQueued = true;
      } else if (e.code === 'KeyM') {
        this.toggleMuteQueued = true;
      }
    }

    this.pressed.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.pressed.clear();
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  public getState(): InputState {
    const throttle =
      this.pressed.has('KeyW') || this.pressed.has('ArrowUp') ? 1 : 0;
    const brake =
      this.pressed.has('KeyS') || this.pressed.has('ArrowDown') ? 1 : 0;

    const left =
      this.pressed.has('KeyA') || this.pressed.has('ArrowLeft') ? 1 : 0;
    const right =
      this.pressed.has('KeyD') || this.pressed.has('ArrowRight') ? 1 : 0;

    return {
      throttle,
      brake,
      steer: left - right,
      handbrake: this.pressed.has('Space'),
    };
  }

  public consumeActions(): InputActions {
    const actions: InputActions = {
      cycleCamera: this.cycleCameraQueued,
      resetCar: this.resetCarQueued,
      toggleFps: this.toggleFpsQueued,
      toggleGarage: this.toggleGarageQueued,
      closeGarage: this.closeGarageQueued,
      cycleTimeOfDay: this.cycleTimeOfDayQueued,
      toggleMute: this.toggleMuteQueued,
    };
    this.cycleCameraQueued = false;
    this.resetCarQueued = false;
    this.toggleFpsQueued = false;
    this.toggleGarageQueued = false;
    this.closeGarageQueued = false;
    this.cycleTimeOfDayQueued = false;
    this.toggleMuteQueued = false;
    return actions;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.pressed.clear();
  }
}
