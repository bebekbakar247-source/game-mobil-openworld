import * as THREE from 'three';
import type { CarController } from '../vehicle/CarController';
import type { WorldData } from './WorldBuilder';

export type TimeOfDay = 'day' | 'sunset' | 'night';

const TIME_ORDER: TimeOfDay[] = ['day', 'sunset', 'night'];

interface AtmospherePreset {
  sky: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  dirColor: number;
  dirIntensity: number;
  dirPos: [number, number, number];
  exposure: number;
  lampEmissive: number;
  windowEmissive: number;
  headlightLevel: number;
}

const PRESETS: Record<TimeOfDay, AtmospherePreset> = {
  day: {
    sky: 0x8ecae6,
    fogColor: 0xa8d5ea,
    fogNear: 260,
    fogFar: 760,
    hemiSky: 0xdff4ff,
    hemiGround: 0x5c6b57,
    hemiIntensity: 1.15,
    dirColor: 0xfff5e4,
    dirIntensity: 1.45,
    dirPos: [180, 260, 140],
    exposure: 1.05,
    lampEmissive: 0.06,
    windowEmissive: 0.0,
    headlightLevel: 0.0,
  },
  sunset: {
    sky: 0xd96b52,
    fogColor: 0xe07a5f,
    fogNear: 210,
    fogFar: 700,
    hemiSky: 0xffb4a2,
    hemiGround: 0x3d314a,
    hemiIntensity: 0.84,
    dirColor: 0xff9e44,
    dirIntensity: 1.35,
    dirPos: [-260, 78, 160],
    exposure: 1.02,
    lampEmissive: 1.15,
    windowEmissive: 0.3,
    headlightLevel: 0.45,
  },
  night: {
    sky: 0x0b132b,
    fogColor: 0x111d3a,
    fogNear: 175,
    fogFar: 620,
    hemiSky: 0x2b4570,
    hemiGround: 0x0f172a,
    hemiIntensity: 0.45,
    dirColor: 0x8ecae6,
    dirIntensity: 0.5,
    dirPos: [-150, 220, -140],
    exposure: 0.98,
    lampEmissive: 2.6,
    windowEmissive: 0.85,
    headlightLevel: 1.0,
  },
};

export class AtmosphereManager {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly dirLight: THREE.DirectionalLight;
  private readonly world: WorldData;
  private readonly car: CarController;

  private modeIndex = 0;
  private currentHeadlightLevel = 0;

  // Scratch targets (zero per-frame allocations)
  private readonly targetSky = new THREE.Color();
  private readonly targetFog = new THREE.Color();
  private readonly targetHemiSky = new THREE.Color();
  private readonly targetHemiGround = new THREE.Color();
  private readonly targetDirColor = new THREE.Color();
  private readonly targetDirPos = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    world: WorldData,
    car: CarController
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.hemiLight = hemiLight;
    this.dirLight = dirLight;
    this.world = world;
    this.car = car;

    this.applyImmediate('day');
  }

  public getTimeOfDay(): TimeOfDay {
    return TIME_ORDER[this.modeIndex];
  }

  public cycleTimeOfDay(): TimeOfDay {
    this.modeIndex = (this.modeIndex + 1) % TIME_ORDER.length;
    return this.getTimeOfDay();
  }

  public update(dt: number): void {
    const preset = PRESETS[this.getTimeOfDay()];
    const alpha = 1 - Math.exp(-3.2 * dt);

    const bg = this.scene.background as THREE.Color;
    this.targetSky.setHex(preset.sky);
    bg.lerp(this.targetSky, alpha);

    const fog = this.scene.fog as THREE.Fog;
    if (fog) {
      this.targetFog.setHex(preset.fogColor);
      fog.color.lerp(this.targetFog, alpha);
      fog.near += (preset.fogNear - fog.near) * alpha;
      fog.far += (preset.fogFar - fog.far) * alpha;
    }

    this.targetHemiSky.setHex(preset.hemiSky);
    this.targetHemiGround.setHex(preset.hemiGround);
    this.hemiLight.color.lerp(this.targetHemiSky, alpha);
    this.hemiLight.groundColor.lerp(this.targetHemiGround, alpha);
    this.hemiLight.intensity += (preset.hemiIntensity - this.hemiLight.intensity) * alpha;

    this.targetDirColor.setHex(preset.dirColor);
    this.dirLight.color.lerp(this.targetDirColor, alpha);
    this.dirLight.intensity += (preset.dirIntensity - this.dirLight.intensity) * alpha;
    this.targetDirPos.set(preset.dirPos[0], preset.dirPos[1], preset.dirPos[2]);
    this.dirLight.position.lerp(this.targetDirPos, alpha);

    this.renderer.toneMappingExposure +=
      (preset.exposure - this.renderer.toneMappingExposure) * alpha;

    this.world.streetLampBulbMaterial.emissiveIntensity +=
      (preset.lampEmissive - this.world.streetLampBulbMaterial.emissiveIntensity) * alpha;
    this.world.buildingMaterial.emissiveIntensity +=
      (preset.windowEmissive - this.world.buildingMaterial.emissiveIntensity) * alpha;

    this.currentHeadlightLevel +=
      (preset.headlightLevel - this.currentHeadlightLevel) * alpha;
    this.car.setHeadlightLevel(this.currentHeadlightLevel);
  }

  private applyImmediate(mode: TimeOfDay): void {
    const preset = PRESETS[mode];
    (this.scene.background as THREE.Color).setHex(preset.sky);

    const fog = this.scene.fog as THREE.Fog;
    if (fog) {
      fog.color.setHex(preset.fogColor);
      fog.near = preset.fogNear;
      fog.far = preset.fogFar;
    }

    this.hemiLight.color.setHex(preset.hemiSky);
    this.hemiLight.groundColor.setHex(preset.hemiGround);
    this.hemiLight.intensity = preset.hemiIntensity;

    this.dirLight.color.setHex(preset.dirColor);
    this.dirLight.intensity = preset.dirIntensity;
    this.dirLight.position.set(preset.dirPos[0], preset.dirPos[1], preset.dirPos[2]);

    this.renderer.toneMappingExposure = preset.exposure;
    this.world.streetLampBulbMaterial.emissiveIntensity = preset.lampEmissive;
    this.world.buildingMaterial.emissiveIntensity = preset.windowEmissive;

    this.currentHeadlightLevel = preset.headlightLevel;
    this.car.setHeadlightLevel(preset.headlightLevel);
  }
}
