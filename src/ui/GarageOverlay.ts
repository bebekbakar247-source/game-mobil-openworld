import {
  CAR_SPECS,
  PAINT_SWATCHES,
  getCarSpecById,
  type CarId,
} from '../vehicle/CarSpecs';

export interface GarageOverlayCallbacks {
  onSelectCar: (carId: CarId) => void;
  onSelectPaint: (paintHex: string) => void;
  onClose: () => void;
}

export class GarageOverlay {
  private readonly root: HTMLElement;
  private readonly carNameEl: HTMLElement;
  private readonly carTaglineEl: HTMLElement;
  private readonly paintNameEl: HTMLElement;
  private readonly speedValEl: HTMLElement;
  private readonly speedBarEl: HTMLElement;
  private readonly accelBarEl: HTMLElement;
  private readonly handlingBarEl: HTMLElement;
  private readonly driftBarEl: HTMLElement;
  private readonly carButtons = new Map<CarId, HTMLButtonElement>();
  private readonly swatchButtons = new Map<string, HTMLButtonElement>();

  private open = false;

  constructor(
    container: HTMLElement,
    initialCarId: CarId,
    initialPaintHex: string,
    callbacks: GarageOverlayCallbacks
  ) {
    this.root = document.createElement('div');
    this.root.className = 'garage-overlay';
    this.root.hidden = true;

    const carCardsHtml = CAR_SPECS.map(
      (spec) => `
      <button type="button" class="car-card" data-car-id="${spec.id}">
        <div class="car-card-top">
          <span class="car-card-name">${spec.name}</span>
          <span class="car-card-speed">${Math.round(spec.physics.maxForwardSpeed * 3.6)} km/h</span>
        </div>
        <div class="car-card-tagline">${spec.tagline}</div>
      </button>
    `
    ).join('');

    const swatchesHtml = PAINT_SWATCHES.map(
      (swatch) => `
      <button
        type="button"
        class="swatch-btn"
        data-paint-hex="${swatch.hex}"
        title="${swatch.name}"
        aria-label="${swatch.name}"
        style="--swatch-color: ${swatch.hex};"
      ></button>
    `
    ).join('');

    this.root.innerHTML = `
      <div class="garage-showcase-banner">
        <div class="garage-showcase-kicker">3D GARAGE SHOWCASE</div>
        <h2 class="garage-showcase-title"></h2>
        <p class="garage-showcase-tagline"></p>
        <div class="garage-orbit-hint">Drag mouse to orbit 360° • Scroll to zoom</div>
      </div>

      <aside class="garage-panel" aria-label="Vehicle Selection Garage">
        <div class="garage-panel-header">
          <div>
            <div class="garage-panel-eyebrow">CUSTOMIZE &amp; SELECT</div>
            <h3 class="garage-panel-title">GARAGE</h3>
          </div>
          <button type="button" class="garage-close-btn" title="Close Garage (Esc)">ESC</button>
        </div>

        <div class="garage-section">
          <div class="garage-section-label">VEHICLES</div>
          <div class="car-list">${carCardsHtml}</div>
        </div>

        <div class="garage-section">
          <div class="garage-section-label">PERFORMANCE SPECS</div>
          <div class="stats-grid">
            <div class="stat-row">
              <div class="stat-head"><span>Top Speed</span><span class="stat-top-speed-val">0 km/h</span></div>
              <div class="stat-track"><div class="stat-bar-fill stat-bar-speed"></div></div>
            </div>
            <div class="stat-row">
              <div class="stat-head"><span>Acceleration</span></div>
              <div class="stat-track"><div class="stat-bar-fill stat-bar-accel"></div></div>
            </div>
            <div class="stat-row">
              <div class="stat-head"><span>Handling</span></div>
              <div class="stat-track"><div class="stat-bar-fill stat-bar-handling"></div></div>
            </div>
            <div class="stat-row">
              <div class="stat-head"><span>Drift</span></div>
              <div class="stat-track"><div class="stat-bar-fill stat-bar-drift"></div></div>
            </div>
          </div>
        </div>

        <div class="garage-section">
          <div class="garage-section-header">
            <span class="garage-section-label">PAINT FINISH</span>
            <span class="garage-paint-name"></span>
          </div>
          <div class="swatch-grid">${swatchesHtml}</div>
        </div>

        <button type="button" class="garage-drive-btn">Drive Now <kbd>G</kbd></button>
      </aside>
    `;

    container.appendChild(this.root);

    this.carNameEl = this.root.querySelector('.garage-showcase-title') as HTMLElement;
    this.carTaglineEl = this.root.querySelector('.garage-showcase-tagline') as HTMLElement;
    this.paintNameEl = this.root.querySelector('.garage-paint-name') as HTMLElement;
    this.speedValEl = this.root.querySelector('.stat-top-speed-val') as HTMLElement;
    this.speedBarEl = this.root.querySelector('.stat-bar-speed') as HTMLElement;
    this.accelBarEl = this.root.querySelector('.stat-bar-accel') as HTMLElement;
    this.handlingBarEl = this.root.querySelector('.stat-bar-handling') as HTMLElement;
    this.driftBarEl = this.root.querySelector('.stat-bar-drift') as HTMLElement;

    this.root.querySelectorAll<HTMLButtonElement>('.car-card').forEach((btn) => {
      const id = btn.dataset.carId as CarId;
      this.carButtons.set(id, btn);
      btn.addEventListener('click', () => callbacks.onSelectCar(id));
    });

    this.root.querySelectorAll<HTMLButtonElement>('.swatch-btn').forEach((btn) => {
      const hex = btn.dataset.paintHex!;
      this.swatchButtons.set(hex.toLowerCase(), btn);
      btn.addEventListener('click', () => callbacks.onSelectPaint(hex));
    });

    this.root.querySelector('.garage-close-btn')!.addEventListener('click', callbacks.onClose);
    this.root.querySelector('.garage-drive-btn')!.addEventListener('click', callbacks.onClose);

    this.setSelection(initialCarId, initialPaintHex);
  }

  public isOpen(): boolean {
    return this.open;
  }

  public setOpen(open: boolean): void {
    this.open = open;
    this.root.hidden = !open;
    this.root.classList.toggle('is-open', open);
  }

  public setSelection(carId: CarId, paintHex: string): void {
    const spec = getCarSpecById(carId);
    const normalizedHex = paintHex.toLowerCase();
    const swatch = PAINT_SWATCHES.find((s) => s.hex.toLowerCase() === normalizedHex);

    this.carNameEl.textContent = spec.name;
    this.carTaglineEl.textContent = spec.tagline;
    this.paintNameEl.textContent = swatch ? swatch.name : 'Custom';

    this.speedValEl.textContent = `${Math.round(spec.physics.maxForwardSpeed * 3.6)} km/h`;
    this.speedBarEl.style.width = `${spec.stats.topSpeed}%`;
    this.accelBarEl.style.width = `${spec.stats.acceleration}%`;
    this.handlingBarEl.style.width = `${spec.stats.handling}%`;
    this.driftBarEl.style.width = `${spec.stats.drift}%`;

    this.carButtons.forEach((btn, id) => {
      btn.classList.toggle('is-selected', id === carId);
    });

    this.swatchButtons.forEach((btn, hex) => {
      btn.classList.toggle('is-selected', hex === normalizedHex);
    });
  }
}
