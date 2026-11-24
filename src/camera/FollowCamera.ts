import * as THREE from 'three';
import type { CarController } from '../vehicle/CarController';

export type CameraMode = 'chase' | 'hood' | 'far';

const MODE_ORDER: CameraMode[] = ['chase', 'hood', 'far'];

export class FollowCamera {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly car: CarController;
  private modeIndex = 0;

  private readonly carPos = new THREE.Vector3();
  private readonly carForward = new THREE.Vector3();
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();
  private readonly currentTarget = new THREE.Vector3();
  private readonly smoothedForward = new THREE.Vector3(0, 0, 1);

  constructor(camera: THREE.PerspectiveCamera, car: CarController) {
    this.camera = camera;
    this.car = car;
    this.snapToCar();
  }

  public getMode(): CameraMode {
    return MODE_ORDER[this.modeIndex];
  }

  public cycleMode(): CameraMode {
    this.modeIndex = (this.modeIndex + 1) % MODE_ORDER.length;
    if (this.getMode() === 'hood') {
      this.snapToCar();
    }
    return this.getMode();
  }

  public snapToCar(): void {
    this.car.getPosition(this.carPos);
    this.car.getForwardVector(this.carForward);
    this.smoothedForward.copy(this.carForward);

    this.computeDesiredTransforms(this.carForward);
    this.camera.position.copy(this.desiredPos);
    this.currentTarget.copy(this.desiredTarget);
    this.camera.lookAt(this.currentTarget);
  }

  public update(dt: number): void {
    this.car.getPosition(this.carPos);
    this.car.getForwardVector(this.carForward);

    const mode = this.getMode();
    const speedRatio = this.car.getSpeedRatio();

    if (mode === 'hood') {
      this.computeDesiredTransforms(this.carForward);
      const posAlpha = 1 - Math.exp(-28 * dt);
      this.camera.position.lerp(this.desiredPos, posAlpha);
      this.currentTarget.lerp(this.desiredTarget, posAlpha);
      this.camera.lookAt(this.currentTarget);

      const targetFov = 66 + speedRatio * 9;
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
      return;
    }

    // Spring-damped heading & position follow for chase / far modes
    const headingAlpha = 1 - Math.exp(-6.5 * dt);
    this.smoothedForward.lerp(this.carForward, headingAlpha).normalize();

    this.computeDesiredTransforms(this.smoothedForward);

    const posAlpha = 1 - Math.exp(-(mode === 'chase' ? 9.0 : 7.5) * dt);
    const lookAlpha = 1 - Math.exp(-12.0 * dt);

    this.camera.position.lerp(this.desiredPos, posAlpha);
    this.currentTarget.lerp(this.desiredTarget, lookAlpha);
    this.camera.lookAt(this.currentTarget);

    const baseFov = mode === 'chase' ? 60 : 58;
    const targetFov = baseFov + speedRatio * 12;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5 * dt));
    this.camera.updateProjectionMatrix();
  }

  private computeDesiredTransforms(forward: THREE.Vector3): void {
    const mode = this.getMode();

    if (mode === 'hood') {
      this.desiredPos.set(
        this.carPos.x + forward.x * 0.55,
        this.carPos.y + 1.48,
        this.carPos.z + forward.z * 0.55
      );
      this.desiredTarget.set(
        this.carPos.x + forward.x * 22,
        this.carPos.y + 1.35,
        this.carPos.z + forward.z * 22
      );
      return;
    }

    const dist = mode === 'chase' ? 9.0 : 15.0;
    const height = mode === 'chase' ? 3.5 : 6.2;
    const lookAhead = mode === 'chase' ? 5.5 : 7.5;

    this.desiredPos.set(
      this.carPos.x - forward.x * dist,
      this.carPos.y + height,
      this.carPos.z - forward.z * dist
    );
    this.desiredTarget.set(
      this.carPos.x + forward.x * lookAhead,
      this.carPos.y + 1.35,
      this.carPos.z + forward.z * lookAhead
    );
  }
}
