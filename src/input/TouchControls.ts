import type { InputState } from './KeyboardInput';

type TouchControlKey = 'steerLeft' | 'steerRight' | 'throttle' | 'brake' | 'handbrake';

export class TouchControls {
  private readonly root: HTMLElement;
  private readonly activePointers: Record<TouchControlKey, Set<number>> = {
    steerLeft: new Set<number>(),
    steerRight: new Set<number>(),
    throttle: new Set<number>(),
    brake: new Set<number>(),
    handbrake: new Set<number>(),
  };
  private readonly buttons = new Map<TouchControlKey, HTMLButtonElement>();
  private readonly cleanupFns: Array<() => void> = [];

  private active = false;
  private visible = false;

  private readonly onGlobalPointerEnd = (e: PointerEvent): void => {
    this.releasePointerEverywhere(e.pointerId);
  };

  private readonly onWindowBlur = (): void => {
    this.resetAllPointers();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.resetAllPointers();
    }
  };

  private readonly onPreventContext = (e: Event): void => {
    e.preventDefault();
  };

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch-controls';
    this.root.hidden = true;

    this.root.innerHTML = `
      <div class="touch-cluster touch-cluster-left" aria-label="Steering Controls">
        <button
          type="button"
          class="touch-btn touch-steer-btn"
          data-touch-key="steerLeft"
          aria-label="Steer Left"
        >
          <span class="touch-arrow" aria-hidden="true">◀</span>
        </button>
        <button
          type="button"
          class="touch-btn touch-steer-btn"
          data-touch-key="steerRight"
          aria-label="Steer Right"
        >
          <span class="touch-arrow" aria-hidden="true">▶</span>
        </button>
      </div>

      <div class="touch-cluster touch-cluster-right" aria-label="Pedal and Drift Controls">
        <button
          type="button"
          class="touch-btn touch-drift-btn"
          data-touch-key="handbrake"
          aria-label="Drift / Handbrake"
        >
          <span class="touch-btn-label">DRIFT</span>
        </button>
        <div class="touch-pedals-row">
          <button
            type="button"
            class="touch-btn touch-pedal-btn touch-brake-btn"
            data-touch-key="brake"
            aria-label="Brake and Reverse"
          >
            <span class="touch-btn-label">BRAKE</span>
          </button>
          <button
            type="button"
            class="touch-btn touch-pedal-btn touch-gas-btn"
            data-touch-key="throttle"
            aria-label="Gas / Accelerate"
          >
            <span class="touch-btn-label">GAS</span>
          </button>
        </div>
      </div>
    `;

    this.root.addEventListener('contextmenu', this.onPreventContext);
    container.appendChild(this.root);

    this.root.querySelectorAll<HTMLButtonElement>('[data-touch-key]').forEach((btn) => {
      const key = btn.dataset.touchKey as TouchControlKey;
      this.buttons.set(key, btn);
      this.bindButtonEvents(btn, key);
    });

    window.addEventListener('pointerup', this.onGlobalPointerEnd);
    window.addEventListener('pointercancel', this.onGlobalPointerEnd);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  public setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.resetAllPointers();
    }
    this.syncVisibility();
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) {
      this.resetAllPointers();
    }
    this.syncVisibility();
  }

  public getState(): InputState {
    if (!this.active || !this.visible) {
      return {
        throttle: 0,
        brake: 0,
        steer: 0,
        handbrake: false,
      };
    }

    const throttle = this.activePointers.throttle.size > 0 ? 1 : 0;
    const brake = this.activePointers.brake.size > 0 ? 1 : 0;
    const left = this.activePointers.steerLeft.size > 0 ? 1 : 0;
    const right = this.activePointers.steerRight.size > 0 ? 1 : 0;
    const handbrake = this.activePointers.handbrake.size > 0;

    return {
      throttle,
      brake,
      steer: left - right,
      handbrake,
    };
  }

  public resetAllPointers(): void {
    (Object.keys(this.activePointers) as TouchControlKey[]).forEach((key) => {
      this.activePointers[key].clear();
      this.buttons.get(key)?.classList.remove('is-pressed');
    });
  }

  public dispose(): void {
    this.resetAllPointers();
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns.length = 0;
    this.root.removeEventListener('contextmenu', this.onPreventContext);
    window.removeEventListener('pointerup', this.onGlobalPointerEnd);
    window.removeEventListener('pointercancel', this.onGlobalPointerEnd);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.root.remove();
  }

  private syncVisibility(): void {
    this.root.hidden = !(this.active && this.visible);
  }

  private bindButtonEvents(btn: HTMLButtonElement, key: TouchControlKey): void {
    const onPointerDown = (e: PointerEvent): void => {
      if (!this.active || !this.visible) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      this.releasePointerEverywhere(e.pointerId);
      this.activePointers[key].add(e.pointerId);
      this.syncButtonClass(key);
    };

    const onPointerRelease = (e: PointerEvent): void => {
      if (this.activePointers[key].delete(e.pointerId)) {
        this.syncButtonClass(key);
      }
    };

    btn.addEventListener('pointerdown', onPointerDown);
    btn.addEventListener('pointerup', onPointerRelease);
    btn.addEventListener('pointercancel', onPointerRelease);
    btn.addEventListener('pointerleave', onPointerRelease);
    btn.addEventListener('contextmenu', this.onPreventContext);

    this.cleanupFns.push(() => {
      btn.removeEventListener('pointerdown', onPointerDown);
      btn.removeEventListener('pointerup', onPointerRelease);
      btn.removeEventListener('pointercancel', onPointerRelease);
      btn.removeEventListener('pointerleave', onPointerRelease);
      btn.removeEventListener('contextmenu', this.onPreventContext);
    });
  }

  private releasePointerEverywhere(pointerId: number): void {
    (Object.keys(this.activePointers) as TouchControlKey[]).forEach((key) => {
      if (this.activePointers[key].delete(pointerId)) {
        this.syncButtonClass(key);
      }
    });
  }

  private syncButtonClass(key: TouchControlKey): void {
    const btn = this.buttons.get(key);
    if (!btn) return;
    btn.classList.toggle('is-pressed', this.activePointers[key].size > 0);
  }
}
