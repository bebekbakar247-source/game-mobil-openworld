import type { CameraMode } from '../camera/FollowCamera';
import type { CarTelemetry } from '../vehicle/CarController';
import type { TimeOfDay } from '../world/AtmosphereManager';
import type { PlatformMode } from './ModeSelector';

export interface HUDCallbacks {
  onOpenGarage: () => void;
  onCycleTimeOfDay: () => void;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onResetCar: () => void;
  onTogglePlatformMode: () => void;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly controlsWrapEl: HTMLElement;
  private readonly portraitBannerEl: HTMLElement;
  private readonly modeToggleBtn: HTMLButtonElement;
  private readonly modePcSegEl: HTMLElement;
  private readonly modeMobileSegEl: HTMLElement;
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

  private platformMode: PlatformMode = 'pc';
  private portraitDismissed = false;
  private fpsVisible = false;
  private lastSpeed = -1;
  private lastGear = '';
  private lastMode: CameraMode | '' = '';
  private lastDrifting = false;
  private lastRedline = false;
  private lastFpsText = '';

  private readonly onViewportChange = (): void => {
    this.syncPortraitBanner();
  };

  constructor(container: HTMLElement, callbacks: HUDCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'hud-overlay';

    this.root.innerHTML = `
      <div class="hud-top-right">
        <button
          type="button"
          class="hud-pill-btn mode-toggle-btn"
          data-mode="pc"
          title="Switch PC / Mobile Control Mode"
        >
          <span class="mode-seg mode-seg-pc is-active">PC</span>
          <span class="mode-seg-sep">/</span>
          <span class="mode-seg mode-seg-mobile">Mobile</span>
        </button>
        <button type="button" class="hud-pill-btn cam-btn" title="Switch Camera View (C)">
          <span>CAM</span>
          <kbd>C</kbd>
        </button>
        <button type="button" class="hud-pill-btn reset-btn" title="Reset Car Position (R)">
          <span>RESET</span>
          <kbd>R</kbd>
        </button>
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

      <div class="portrait-banner" role="status" hidden>
        <span class="portrait-banner-icon" aria-hidden="true">↻</span>
        <span class="portrait-banner-text">Rotate device to landscape for a better view</span>
        <button type="button" class="portrait-banner-close" aria-label="Dismiss rotation tip">✕</button>
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

    this.controlsWrapEl = this.root.querySelector('.hud-bottom-left') as HTMLElement;
    this.portraitBannerEl = this.root.querySelector('.portrait-banner') as HTMLElement;
    this.modeToggleBtn = this.root.querySelector('.mode-toggle-btn') as HTMLButtonElement;
    this.modePcSegEl = this.root.querySelector('.mode-seg-pc') as HTMLElement;
    this.modeMobileSegEl = this.root.querySelector('.mode-seg-mobile') as HTMLElement;
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

    this.modeToggleBtn.addEventListener('click', callbacks.onTogglePlatformMode);
    (this.root.querySelector('.cam-btn') as HTMLButtonElement).addEventListener(
      'click',
      callbacks.onCycleCamera
    );
    (this.root.querySelector('.reset-btn') as HTMLButtonElement).addEventListener(
      'click',
      callbacks.onResetCar
    );
    (this.root.querySelector('.garage-btn') as HTMLButtonElement).addEventListener(
      'click',
      callbacks.onOpenGarage
    );
    this.timeBtn.addEventListener('click', callbacks.onCycleTimeOfDay);
    this.muteBtn.addEventListener('click', callbacks.onToggleMute);
    this.fpsToggleBtn.addEventListener('click', () => {
      this.toggleFps();
    });
    (this.root.querySelector('.portrait-banner-close') as HTMLButtonElement).addEventListener(
      'click',
      () => {
        this.portraitDismissed = true;
        this.syncPortraitBanner();
      }
    );

    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('orientationchange', this.onViewportChange);
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) {
      this.syncPortraitBanner();
    }
  }

  public setPlatformMode(mode: PlatformMode): void {
    this.platformMode = mode;
    this.modeToggleBtn.dataset.mode = mode;
    this.modePcSegEl.classList.toggle('is-active', mode === 'pc');
    this.modeMobileSegEl.classList.toggle('is-active', mode === 'mobile');
    this.controlsWrapEl.hidden = mode === 'mobile';
    this.syncPortraitBanner();
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

  public dispose(): void {
    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('orientationchange', this.onViewportChange);
    this.root.remove();
  }

  private syncPortraitBanner(): void {
    const isPortrait = window.innerHeight > window.innerWidth;
    this.portraitBannerEl.hidden = !(
      this.platformMode === 'mobile' &&
      isPortrait &&
      !this.portraitDismissed
    );
  }
}
