import * as THREE from 'three';
import type { CarController } from '../vehicle/CarController';

export type CameraMode = 'chase' | 'hood' | 'far';

const MODE_ORDER: CameraMode[] = ['chase', 'hood', 'far'];

export class FollowCamera {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly car: CarController;
  private readonly domElement: HTMLElement;
  private modeIndex = 0;

  private readonly carPos = new THREE.Vector3();
  private readonly carForward = new THREE.Vector3();
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();
  private readonly currentTarget = new THREE.Vector3();
  private readonly smoothedForward = new THREE.Vector3(0, 0, 1);

  // Garage 360-degree interactive orbit state
  private garageActive = false;
  private isDragging = false;
  private activePointerId = -1;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private orbitYaw = 0;
  private orbitPitch = 0.28;
  private orbitDist = 7.2;
  private targetOrbitYaw = 0;
  private targetOrbitPitch = 0.28;
  private targetOrbitDist = 7.2;

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.garageActive || e.button !== 0) return;
    this.isDragging = true;
    this.activePointerId = e.pointerId;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.domElement.classList.add('is-dragging');
    try {
      this.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.garageActive || !this.isDragging || e.pointerId !== this.activePointerId) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.targetOrbitYaw -= dx * 0.0075;
    this.targetOrbitPitch = THREE.MathUtils.clamp(this.targetOrbitPitch + dy * 0.006, 0.06, 1.15);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    this.isDragging = false;
    this.activePointerId = -1;
    this.domElement.classList.remove('is-dragging');
    try {
      if (this.domElement.hasPointerCapture(e.pointerId)) {
        this.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.garageActive) return;
    e.preventDefault();
    this.targetOrbitDist = THREE.MathUtils.clamp(
      this.targetOrbitDist + Math.sign(e.deltaY) * 0.65,
      4.8,
      11.5
    );
  };

  constructor(camera: THREE.PerspectiveCamera, car: CarController, domElement: HTMLElement) {
    this.camera = camera;
    this.car = car;
    this.domElement = domElement;

    domElement.addEventListener('pointerdown', this.onPointerDown);
    domElement.addEventListener('pointermove', this.onPointerMove);
    domElement.addEventListener('pointerup', this.onPointerUp);
    domElement.addEventListener('pointercancel', this.onPointerUp);
    domElement.addEventListener('wheel', this.onWheel, { passive: false });

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

  public setGarageMode(active: boolean, viewportWidth: number, viewportHeight: number): void {
    this.garageActive = active;
    this.isDragging = false;
    this.activePointerId = -1;
    this.domElement.classList.toggle('is-garage-orbit', active);
    this.domElement.classList.remove('is-dragging');

    if (active) {
      this.car.getPosition(this.carPos);
      this.car.getForwardVector(this.carForward);
      const carYaw = Math.atan2(this.carForward.x, this.carForward.z);

      this.orbitYaw = carYaw + Math.PI * 0.78;
      this.targetOrbitYaw = this.orbitYaw;
      this.orbitPitch = 0.28;
      this.targetOrbitPitch = 0.28;
      this.orbitDist = 7.2;
      this.targetOrbitDist = 7.2;

      this.updateGarageViewOffset(viewportWidth, viewportHeight);
      this.camera.fov = 50;
      this.camera.updateProjectionMatrix();
      this.applyGarageOrbitPosition(1);
    } else {
      this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.snapToCar();
    }
  }

  public onResize(viewportWidth: number, viewportHeight: number): void {
    if (this.garageActive) {
      this.updateGarageViewOffset(viewportWidth, viewportHeight);
    }
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
    if (this.garageActive) {
      const orbitAlpha = 1 - Math.exp(-14 * dt);
      this.orbitYaw += (this.targetOrbitYaw - this.orbitYaw) * orbitAlpha;
      this.orbitPitch += (this.targetOrbitPitch - this.orbitPitch) * orbitAlpha;
      this.orbitDist += (this.targetOrbitDist - this.orbitDist) * orbitAlpha;
      this.applyGarageOrbitPosition(1 - Math.exp(-16 * dt));
      return;
    }

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

  public dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('pointercancel', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
  }

  private updateGarageViewOffset(viewportWidth: number, viewportHeight: number): void {
    const offsetX = viewportWidth > 860 ? 180 : 0;
    this.camera.setViewOffset(
      viewportWidth,
      viewportHeight,
      offsetX,
      0,
      viewportWidth,
      viewportHeight
    );
  }

  private applyGarageOrbitPosition(lerpAlpha: number): void {
    this.car.getPosition(this.carPos);
    const focusY = this.carPos.y + 0.85;
    const horiz = Math.cos(this.orbitPitch) * this.orbitDist;

    this.desiredPos.set(
      this.carPos.x + Math.sin(this.orbitYaw) * horiz,
      focusY + Math.sin(this.orbitPitch) * this.orbitDist,
      this.carPos.z + Math.cos(this.orbitYaw) * horiz
    );
    this.desiredTarget.set(this.carPos.x, focusY, this.carPos.z);

    if (lerpAlpha >= 1) {
      this.camera.position.copy(this.desiredPos);
      this.currentTarget.copy(this.desiredTarget);
    } else {
      this.camera.position.lerp(this.desiredPos, lerpAlpha);
      this.currentTarget.lerp(this.desiredTarget, lerpAlpha);
    }
    this.camera.lookAt(this.currentTarget);
  }

  private computeDesiredTransforms(forward: THREE.Vector3): void {
    const mode = this.getMode();

    if (mode === 'hood') {
      const hood = this.car.getSpec().hoodCamOffset;
      this.desiredPos.set(
        this.carPos.x + forward.x * hood.z,
        this.carPos.y + hood.y,
        this.carPos.z + forward.z * hood.z
      );
      this.desiredTarget.set(
        this.carPos.x + forward.x * 22,
        this.carPos.y + hood.lookY,
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
