import type { WorldData } from '../world/WorldBuilder';

export class MiniMap {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly staticCanvas: HTMLCanvasElement;
  private readonly cssSize = 172;
  private readonly pixelSize: number;

  constructor(container: HTMLElement, world: WorldData) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelSize = Math.round(this.cssSize * dpr);

    this.root = document.createElement('div');
    this.root.className = 'minimap-card';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap-canvas';
    this.canvas.width = this.pixelSize;
    this.canvas.height = this.pixelSize;
    this.root.appendChild(this.canvas);

    const north = document.createElement('span');
    north.className = 'minimap-north';
    north.textContent = 'N';
    this.root.appendChild(north);

    container.appendChild(this.root);

    this.ctx = this.canvas.getContext('2d')!;
    this.staticCanvas = document.createElement('canvas');
    this.staticCanvas.width = this.pixelSize;
    this.staticCanvas.height = this.pixelSize;

    this.renderStaticMap(world);
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public update(carX: number, carZ: number, carYaw: number): void {
    const s = this.pixelSize;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(this.staticCanvas, 0, 0);

    const px = this.worldToMap(carX);
    const py = this.worldToMap(carZ);

    ctx.save();
    ctx.translate(px, py);
    // At carYaw = 0, car faces +Z (down/south); at PI/2 faces +X (right/east)
    ctx.rotate(Math.PI - carYaw);

    const r = s * 0.044;

    // Soft directional glow
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.fill();

    // Player chevron arrow pointing -Y in rotated space
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.25);
    ctx.lineTo(r * 0.9, r * 0.95);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r * 0.9, r * 0.95);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.01);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  private worldToMap(coord: number): number {
    return ((coord + 700) / 1400) * this.pixelSize;
  }

  private worldLenToMap(len: number): number {
    return (len / 1400) * this.pixelSize;
  }

  private renderStaticMap(world: WorldData): void {
    const ctx = this.staticCanvas.getContext('2d')!;
    const s = this.pixelSize;

    // Base land mass
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, s, s);

    // Coastal beach & ocean on the east
    const beachX = this.worldToMap(565);
    const oceanX = this.worldToMap(608);
    ctx.fillStyle = '#cbb989';
    ctx.fillRect(beachX, 0, oceanX - beachX, s);
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(oceanX, 0, s - oceanX, s);

    // Scenic pier
    ctx.fillStyle = '#9c6644';
    ctx.fillRect(
      this.worldToMap(548),
      this.worldToMap(-8),
      this.worldLenToMap(92),
      this.worldLenToMap(16)
    );

    // Downtown Grid Streets
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(1.5, this.worldLenToMap(16));
    const gridCoords = [-260, -130, 130, 260];
    for (const gx of [-260, -130, 130, 260, 390]) {
      const mx = this.worldToMap(gx);
      ctx.beginPath();
      ctx.moveTo(mx, this.worldToMap(-520));
      ctx.lineTo(mx, this.worldToMap(520));
      ctx.stroke();
    }
    for (const gz of gridCoords) {
      const mz = this.worldToMap(gz);
      ctx.beginPath();
      ctx.moveTo(this.worldToMap(-520), mz);
      ctx.lineTo(this.worldToMap(520), mz);
      ctx.stroke();
    }

    // Main Boulevards
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(2, this.worldLenToMap(22));
    ctx.beginPath();
    ctx.moveTo(this.worldToMap(-520), this.worldToMap(0));
    ctx.lineTo(this.worldToMap(520), this.worldToMap(0));
    ctx.moveTo(this.worldToMap(0), this.worldToMap(-520));
    ctx.lineTo(this.worldToMap(0), this.worldToMap(520));
    ctx.stroke();

    // Outer Loop Highway (straights + rounded corners)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(2.5, this.worldLenToMap(26));
    const hwMin = this.worldToMap(-520);
    const hwMax = this.worldToMap(520);
    const cornerR = this.worldLenToMap(80);
    ctx.beginPath();
    ctx.roundRect(hwMin, hwMin, hwMax - hwMin, hwMax - hwMin, cornerR);
    ctx.stroke();

    // Central Roundabout
    const cx = this.worldToMap(0);
    const cy = this.worldToMap(0);
    ctx.beginPath();
    ctx.arc(cx, cy, this.worldLenToMap(48), 0, Math.PI * 2);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(2.5, this.worldLenToMap(26));
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, this.worldLenToMap(32), 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();

    // Stunt ramp markers
    ctx.fillStyle = '#f97316';
    for (const ramp of world.ramps) {
      const rx = this.worldToMap(ramp.x);
      const ry = this.worldToMap(ramp.z);
      ctx.beginPath();
      ctx.arc(rx, ry, Math.max(2.5, s * 0.022), 0, Math.PI * 2);
      ctx.fill();
    }

    // Playable boundary frame
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.32)';
    ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.setLineDash([s * 0.03, s * 0.025]);
    ctx.strokeRect(
      this.worldToMap(world.bounds.minX),
      this.worldToMap(world.bounds.minZ),
      this.worldLenToMap(world.bounds.maxX - world.bounds.minX),
      this.worldLenToMap(world.bounds.maxZ - world.bounds.minZ)
    );
    ctx.setLineDash([]);
  }
}
