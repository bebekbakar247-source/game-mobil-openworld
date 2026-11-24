export type PlatformMode = 'pc' | 'mobile';

export function detectRecommendedMode(): PlatformMode {
  if (typeof window === 'undefined') {
    return 'pc';
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const noHover = window.matchMedia?.('(hover: none)').matches ?? false;
  const hasTouch = navigator.maxTouchPoints > 0;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);

  if (coarsePointer || (noHover && hasTouch) || (hasTouch && shortSide <= 820)) {
    return 'mobile';
  }

  return 'pc';
}

export interface ModeSelectorCallbacks {
  onSelectMode: (mode: PlatformMode) => void;
}

export class ModeSelector {
  private readonly root: HTMLElement;
  private open = true;

  constructor(container: HTMLElement, callbacks: ModeSelectorCallbacks) {
    const recommended = detectRecommendedMode();

    this.root = document.createElement('div');
    this.root.className = 'mode-selector-overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'mode-selector-title');

    const pcRecHtml =
      recommended === 'pc'
        ? '<span class="mode-recommended-badge">(Recommended)</span>'
        : '';
    const mobileRecHtml =
      recommended === 'mobile'
        ? '<span class="mode-recommended-badge">(Recommended)</span>'
        : '';

    this.root.innerHTML = `
      <div class="mode-selector-card">
        <div class="mode-selector-kicker">OPEN-WORLD FREE-ROAM DRIVE</div>
        <h1 id="mode-selector-title" class="mode-selector-title">Select Control Mode</h1>
        <p class="mode-selector-subtitle">
          Choose your preferred driving setup. You can switch between PC and Mobile anytime from the top HUD bar.
        </p>

        <div class="mode-selector-options">
          <button
            type="button"
            class="mode-option-btn ${recommended === 'pc' ? 'is-recommended' : ''}"
            data-select-mode="pc"
          >
            <div class="mode-option-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2.5"></rect>
                <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 13h6"></path>
              </svg>
            </div>
            <div class="mode-option-body">
              <div class="mode-option-title-row">
                <span class="mode-option-label">PC Mode (Keyboard)</span>
                ${pcRecHtml}
              </div>
              <span class="mode-option-desc">WASD / Arrow keys to drive, Spacebar to drift, full keyboard shortcuts</span>
            </div>
          </button>

          <button
            type="button"
            class="mode-option-btn ${recommended === 'mobile' ? 'is-recommended' : ''}"
            data-select-mode="mobile"
          >
            <div class="mode-option-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2.5"></rect>
                <path d="M12 18h.01"></path>
              </svg>
            </div>
            <div class="mode-option-body">
              <div class="mode-option-title-row">
                <span class="mode-option-label">Mobile Mode (Touch Controls)</span>
                ${mobileRecHtml}
              </div>
              <span class="mode-option-desc">Multi-touch steering buttons, Gas, Brake &amp; Drift pedals, tap-friendly HUD</span>
            </div>
          </button>
        </div>
      </div>
    `;

    container.appendChild(this.root);

    this.root.querySelectorAll<HTMLButtonElement>('[data-select-mode]').forEach((btn) => {
      const mode = btn.dataset.selectMode as PlatformMode;
      btn.addEventListener('click', () => {
        this.setOpen(false);
        callbacks.onSelectMode(mode);
      });
    });
  }

  public isOpen(): boolean {
    return this.open;
  }

  public setOpen(open: boolean): void {
    this.open = open;
    this.root.hidden = !open;
  }

  public dispose(): void {
    this.root.remove();
  }
}
