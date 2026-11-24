import type { CameraMode } from '../camera/FollowCamera';
import type { CarTelemetry } from '../vehicle/CarController';
import type { TimeOfDay } from '../world/AtmosphereManager';

export interface HUDCallbacks {
  onOpenGarage: () => void;
  onCycleTimeOfDay: () => void;
  onToggleMute: () => void;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly speedEl: HTMLElement;
  private readonly gearEl: HTMLElement;
  private readonly cameraEl: HTMLElement;
  private readonly driftBadgeEl: HTMLElement;
  private readonly rpmFillEl: HTMLElement;
  private readonly fpsToggleBtn: HTMLButtonElement;
  private readonly fpsValueEl: HTMLElement;
  private readonly timeBtn: HTMLButtonElement;
  private readonly timeLabelEl: HTMLElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly muteLabelEl: HTMLElement;

  private fpsVisible = false;
  private lastSpeed = -1;
  private lastGear = '';
  private lastMode: CameraMode | '' = '';
  private lastDrifting = false;
  private lastRedline = false;
  private lastFpsText = '';

  constructor(container: HTMLElement, callbacks: HUDCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'hud-overlay';

    this.root.innerHTML = `
      <div class="hud-top-right">
        <button type="button" class="hud-pill-btn time-btn" data-time="day" title="Cycle Time of Day (N)">
          <span class="time-dot"></span>
          <span class="time-label">DAY</span>
          <kbd>N</kbd>
        </button>
        <button type="button" class="hud-pill-btn mute-btn" aria-pressed="false" title="Toggle Audio Mute (M)">
          <span class="mute-dot"></span>
          <span class="mute-label">SOUND</span>
          <kbd>M</kbd>
        </button>
        <button type="button" class="garage-btn" title="Open 3D Garage (G)">
          <span>GARAGE</span>
          <kbd>G</kbd>
        </button>
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
          <div class="control-row"><kbd>G</kbd><span class="control-desc">Garage</span></div>
          <div class="control-row"><kbd>N</kbd><span class="control-desc">Time</span></div>
          <div class="control-row"><kbd>M</kbd><span class="control-desc">Audio</span></div>
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

    container.appendChild(this.root);

    this.speedEl = this.root.querySelector('.speed-value') as HTMLElement;
    this.gearEl = this.root.querySelector('.gear-pill') as HTMLElement;
    this.cameraEl = this.root.querySelector('.badge-camera') as HTMLElement;
    this.driftBadgeEl = this.root.querySelector('.badge-drift') as HTMLElement;
    this.rpmFillEl = this.root.querySelector('.rpm-fill') as HTMLElement;
    this.fpsToggleBtn = this.root.querySelector('.fps-pill') as HTMLButtonElement;
    this.fpsValueEl = this.root.querySelector('.fps-value') as HTMLElement;
    this.timeBtn = this.root.querySelector('.time-btn') as HTMLButtonElement;
    this.timeLabelEl = this.root.querySelector('.time-label') as HTMLElement;
    this.muteBtn = this.root.querySelector('.mute-btn') as HTMLButtonElement;
    this.muteLabelEl = this.root.querySelector('.mute-label') as HTMLElement;

    (this.root.querySelector('.garage-btn') as HTMLButtonElement).addEventListener(
      'click',
      callbacks.onOpenGarage
    );
    this.timeBtn.addEventListener('click', callbacks.onCycleTimeOfDay);
    this.muteBtn.addEventListener('click', callbacks.onToggleMute);
    this.fpsToggleBtn.addEventListener('click', () => {
      this.toggleFps();
    });
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public setTimeOfDay(mode: TimeOfDay): void {
    this.timeBtn.dataset.time = mode;
    this.timeLabelEl.textContent = mode.toUpperCase();
  }

  public setMuted(muted: boolean): void {
    this.muteBtn.classList.toggle('is-muted', muted);
    this.muteBtn.setAttribute('aria-pressed', String(muted));
    this.muteLabelEl.textContent = muted ? 'MUTED' : 'SOUND';
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
