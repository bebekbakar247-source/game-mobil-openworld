import type { CameraMode } from '../camera/FollowCamera';
import type { CarTelemetry } from '../vehicle/CarController';

export class HUD {
  private readonly speedEl: HTMLElement;
  private readonly gearEl: HTMLElement;
  private readonly cameraEl: HTMLElement;
  private readonly driftBadgeEl: HTMLElement;
  private readonly rpmFillEl: HTMLElement;
  private readonly fpsToggleBtn: HTMLButtonElement;
  private readonly fpsValueEl: HTMLElement;

  private fpsVisible = false;
  private lastSpeed = -1;
  private lastGear = '';
  private lastMode: CameraMode | '' = '';
  private lastDrifting = false;
  private lastRedline = false;
  private lastFpsText = '';

  constructor(container: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud-overlay';

    root.innerHTML = `
      <div class="hud-top-right">
        <button type="button" class="fps-pill" aria-pressed="false" title="Toggle FPS Counter (F)">
          <span class="fps-dot"></span>
          <span class="fps-label">FPS</span>
          <span class="fps-value" hidden>60</span>
        </button>
      </div>

      <div class="hud-bottom-left">
        <div class="controls-card">
          <div class="control-row"><kbd>W A S D</kbd><span>/</span><kbd>↑ ↓ ← →</kbd><span class="control-desc">Drive</span></div>
          <div class="control-row"><kbd>SPACE</kbd><span class="control-desc">Drift</span></div>
          <div class="control-row"><kbd>C</kbd><span class="control-desc">Camera</span></div>
          <div class="control-row"><kbd>R</kbd><span class="control-desc">Reset</span></div>
          <div class="control-row"><kbd>F</kbd><span class="control-desc">FPS</span></div>
        </div>
      </div>

      <div class="hud-bottom-right">
        <div class="cluster-card">
          <div class="cluster-meta">
            <span class="badge badge-camera">CHASE</span>
            <span class="badge badge-drift" hidden>DRIFT</span>
            <span class="gear-pill">N</span>
          </div>
          <div class="speed-row">
            <span class="speed-value">0</span>
            <span class="speed-unit">km/h</span>
          </div>
          <div class="rpm-track" aria-label="Engine RPM">
            <div class="rpm-fill"></div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(root);

    this.speedEl = root.querySelector('.speed-value') as HTMLElement;
    this.gearEl = root.querySelector('.gear-pill') as HTMLElement;
    this.cameraEl = root.querySelector('.badge-camera') as HTMLElement;
    this.driftBadgeEl = root.querySelector('.badge-drift') as HTMLElement;
    this.rpmFillEl = root.querySelector('.rpm-fill') as HTMLElement;
    this.fpsToggleBtn = root.querySelector('.fps-pill') as HTMLButtonElement;
    this.fpsValueEl = root.querySelector('.fps-value') as HTMLElement;

    this.fpsToggleBtn.addEventListener('click', () => {
      this.toggleFps();
    });
  }

  public toggleFps(): void {
    this.fpsVisible = !this.fpsVisible;
    this.fpsToggleBtn.setAttribute('aria-pressed', String(this.fpsVisible));
    this.fpsToggleBtn.classList.toggle('is-active', this.fpsVisible);
    this.fpsValueEl.hidden = !this.fpsVisible;
  }

  public update(telemetry: CarTelemetry, cameraMode: CameraMode, fps: number): void {
    if (telemetry.speedKmh !== this.lastSpeed) {
      this.lastSpeed = telemetry.speedKmh;
      this.speedEl.textContent = String(telemetry.speedKmh);
    }

    if (telemetry.gear !== this.lastGear) {
      this.lastGear = telemetry.gear;
      this.gearEl.textContent = telemetry.gear;
    }

    if (cameraMode !== this.lastMode) {
      this.lastMode = cameraMode;
      this.cameraEl.textContent = cameraMode.toUpperCase();
    }

    if (telemetry.isDrifting !== this.lastDrifting) {
      this.lastDrifting = telemetry.isDrifting;
      this.driftBadgeEl.hidden = !telemetry.isDrifting;
    }

    this.rpmFillEl.style.transform = `scaleX(${telemetry.rpm.toFixed(3)})`;
    const isRedline = telemetry.rpm > 0.82;
    if (isRedline !== this.lastRedline) {
      this.lastRedline = isRedline;
      this.rpmFillEl.classList.toggle('is-redline', isRedline);
    }

    if (this.fpsVisible) {
      const fpsText = String(Math.round(fps));
      if (fpsText !== this.lastFpsText) {
        this.lastFpsText = fpsText;
        this.fpsValueEl.textContent = fpsText;
      }
    }
  }
}
