import * as THREE from 'three';
import { FollowCamera } from '../camera/FollowCamera';
import { KeyboardInput } from '../input/KeyboardInput';
import { GarageOverlay } from '../ui/GarageOverlay';
import { HUD } from '../ui/HUD';
import { CarController } from '../vehicle/CarController';
import {
  getCarSpecById,
  loadGarageSelection,
  saveGarageSelection,
  type CarId,
} from '../vehicle/CarSpecs';
import { buildWorld } from '../world/WorldBuilder';

export class Game {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: KeyboardInput;
  private readonly car: CarController;
  private readonly followCamera: FollowCamera;
  private readonly hud: HUD;
  private readonly garageOverlay: GarageOverlay;

  private currentCarId: CarId;
  private currentPaintHex: string;

  private rafId = 0;
  private lastTime = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private currentFps = 60;

  private readonly onResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(width, height);
    this.followCamera.onResize(width, height);
  };

  constructor(container: HTMLElement) {
    this.container = container;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Lightweight Renderer (adaptive pixel ratio capped at 1.5)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Atmospheric Sky/Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ecae6);
    this.scene.fog = new THREE.Fog(0xa8d5ea, 260, 760);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.25, 1100);

    // 4. Lightweight Lighting (Hemisphere + single Directional, blob shadow on car)
    const hemiLight = new THREE.HemisphereLight(0xdff4ff, 0x5c6b57, 1.15);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e4, 1.45);
    dirLight.position.set(180, 260, 140);
    this.scene.add(dirLight);

    // 5. World, Persisted Vehicle, Camera, Input, HUD & Garage
    const saved = loadGarageSelection();
    this.currentCarId = saved.carId;
    this.currentPaintHex = saved.paintHex;
    const initialSpec = getCarSpecById(this.currentCarId);

    const world = buildWorld(this.scene);
    this.car = new CarController(initialSpec, this.currentPaintHex, world, this.scene);
    this.followCamera = new FollowCamera(this.camera, this.car, this.renderer.domElement);
    this.input = new KeyboardInput();

    this.hud = new HUD(container, () => {
      this.setGarageOpen(true);
    });

    this.garageOverlay = new GarageOverlay(
      container,
      this.currentCarId,
      this.currentPaintHex,
      {
        onSelectCar: (carId) => {
          if (carId === this.currentCarId) return;
          this.currentCarId = carId;
          this.car.setVehicle(getCarSpecById(carId), this.currentPaintHex);
          saveGarageSelection(this.currentCarId, this.currentPaintHex);
          this.garageOverlay.setSelection(this.currentCarId, this.currentPaintHex);
        },
        onSelectPaint: (paintHex) => {
          this.currentPaintHex = paintHex;
          this.car.setPaintColor(paintHex);
          saveGarageSelection(this.currentCarId, this.currentPaintHex);
          this.garageOverlay.setSelection(this.currentCarId, this.currentPaintHex);
        },
        onClose: () => {
          this.setGarageOpen(false);
        },
      }
    );

    window.addEventListener('resize', this.onResize);
  }

  public start(): void {
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private setGarageOpen(open: boolean): void {
    if (this.garageOverlay.isOpen() === open) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    if (open) {
      this.car.prepareForGarage();
      this.hud.setVisible(false);
      this.garageOverlay.setOpen(true);
      this.followCamera.setGarageMode(true, width, height);
    } else {
      this.garageOverlay.setOpen(false);
      this.hud.setVisible(true);
      this.followCamera.setGarageMode(false, width, height);
    }
  }

  private readonly loop = (now: number): void => {
    this.rafId = requestAnimationFrame(this.loop);

    // Clamped delta time for stable physics across tab switches
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Rolling FPS calculation (~0.25s window)
    this.fpsFrames++;
    this.fpsElapsed += dt;
    if (this.fpsElapsed >= 0.25) {
      this.currentFps = this.fpsFrames / this.fpsElapsed;
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
    }

    const actions = this.input.consumeActions();
    if (actions.toggleGarage) {
      this.setGarageOpen(!this.garageOverlay.isOpen());
    } else if (actions.closeGarage && this.garageOverlay.isOpen()) {
      this.setGarageOpen(false);
    }

    if (this.garageOverlay.isOpen()) {
      // Driving physics paused while inspecting vehicle in 3D Garage
      this.followCamera.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (actions.cycleCamera) {
      this.followCamera.cycleMode();
    }
    if (actions.resetCar) {
      this.car.reset();
      this.followCamera.snapToCar();
    }
    if (actions.toggleFps) {
      this.hud.toggleFps();
    }

    const inputState = this.input.getState();
    const telemetry = this.car.update(dt, inputState);
    this.followCamera.update(dt);
    this.hud.update(telemetry, this.followCamera.getMode(), this.currentFps);

    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.followCamera.dispose();
    this.car.dispose();
    this.input.dispose();
    this.renderer.dispose();
  }
}
