import * as THREE from 'three';
import type { InputState } from '../input/KeyboardInput';
import type { AABB, RampDef, WorldData } from '../world/WorldBuilder';
import type { CarRig } from './CarMeshFactory';

export interface CarTelemetry {
  speedKmh: number;
  rpm: number;
  gear: string;
  isDrifting: boolean;
  isAirborne: boolean;
}

class SkidMarkSystem {
  private readonly maxQuads = 240;
  private readonly positions: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private readonly mesh: THREE.Mesh;
  private head = 0;

  constructor(scene: THREE.Scene) {
    // 6 vertices (2 triangles) per quad * 3 coords
    this.positions = new Float32Array(this.maxQuads * 6 * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.MeshBasicMaterial({
      color: 0x111317,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  public addSegment(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    nx: number,
    nz: number,
    halfWidth = 0.16
  ): void {
    const base = this.head * 18;
    const ox = nx * halfWidth;
    const oz = nz * halfWidth;

    // Triangle 1
    this.positions[base + 0] = x0 - ox;
    this.positions[base + 1] = y;
    this.positions[base + 2] = z0 - oz;

    this.positions[base + 3] = x0 + ox;
    this.positions[base + 4] = y;
    this.positions[base + 5] = z0 + oz;

    this.positions[base + 6] = x1 + ox;
    this.positions[base + 7] = y;
    this.positions[base + 8] = z1 + oz;

    // Triangle 2
    this.positions[base + 9] = x0 - ox;
    this.positions[base + 10] = y;
    this.positions[base + 11] = z0 - oz;

    this.positions[base + 12] = x1 + ox;
    this.positions[base + 13] = y;
    this.positions[base + 14] = z1 + oz;

    this.positions[base + 15] = x1 - ox;
    this.positions[base + 16] = y;
    this.positions[base + 17] = z1 - oz;

    this.head = (this.head + 1) % this.maxQuads;
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  public clear(): void {
    this.positions.fill(0);
    this.head = 0;
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class CarController {
  private readonly rig: CarRig;
  private readonly world: WorldData;
  private readonly skidMarks: SkidMarkSystem;

  // Physics state
  private x = 0;
  private y = 0.06;
  private z = 0;
  private yaw = 0;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private steerAngle = 0;
  private grounded = true;
  private wasOnRamp = false;
  private lastRampSlope = 0;

  // Visual suspension state
  private bodyRoll = 0;
  private bodyPitch = 0;
  private landingDip = 0;

  // Skid mark previous rear wheel coords
  private hasPrevSkid = false;
  private prevRearLx = 0;
  private prevRearLz = 0;
  private prevRearRx = 0;
  private prevRearRz = 0;

  private readonly carRadius = 1.65;

  constructor(rig: CarRig, world: WorldData, scene: THREE.Scene) {
    this.rig = rig;
    this.world = world;
    this.skidMarks = new SkidMarkSystem(scene);

    scene.add(this.rig.root);
    scene.add(this.rig.blobShadow);
    this.reset(false);
  }

  public reset(clearSkids = true): void {
    this.x = this.world.spawn.x;
    this.z = this.world.spawn.z;
    this.yaw = this.world.spawn.yaw;
    this.y = this.world.sampleGround(this.x, this.z, 10).height;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.steerAngle = 0;
    this.grounded = true;
    this.wasOnRamp = false;
    this.lastRampSlope = 0;
    this.bodyRoll = 0;
    this.bodyPitch = 0;
    this.landingDip = 0;
    this.hasPrevSkid = false;
    if (clearSkids) {
      this.skidMarks.clear();
    }
    this.syncVisuals(0, 0, 0, false, false, this.y);
  }

  public update(dt: number, input: InputState): CarTelemetry {
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    // Local basis: forward = (sinYaw, 0, cosYaw), left = (cosYaw, 0, -sinYaw)
    let forwardSpeed = this.vx * sinYaw + this.vz * cosYaw;
    let lateralSpeed = this.vx * cosYaw - this.vz * sinYaw;

    // 1. Steering (speed-sensitive)
    const targetSteer = input.steer;
    const steerLerp = 1 - Math.exp(-7.5 * dt);
    this.steerAngle += (targetSteer - this.steerAngle) * steerLerp;

    const absSpeed = Math.abs(forwardSpeed);
    const isDrifting =
      this.grounded &&
      ((input.handbrake && absSpeed > 7) || (Math.abs(lateralSpeed) > 6.5 && absSpeed > 10));

    if (this.grounded && absSpeed > 0.35) {
      const speedFactor = Math.min(1, absSpeed / 7.5);
      const highSpeedDamp = 1 / (1 + absSpeed * 0.014);
      const driftYawBoost = input.handbrake ? 1.18 : 1.0;
      const reverseSign = forwardSpeed >= -0.1 ? 1 : -1;
      const turnRate =
        this.steerAngle * 2.55 * speedFactor * highSpeedDamp * driftYawBoost * reverseSign;
      this.yaw += turnRate * dt;
    }

    // Recompute basis after yaw update
    const sYaw = Math.sin(this.yaw);
    const cYaw = Math.cos(this.yaw);

    // 2. Longitudinal acceleration / braking / reverse
    const maxForward = 52; // ~187 km/h
    const maxReverse = 16; // ~58 km/h
    let longAccel = 0;

    if (this.grounded) {
      if (input.throttle > 0) {
        if (forwardSpeed < -1.0) {
          longAccel = 46;
        } else {
          const speedRatio = Math.max(0, forwardSpeed / maxForward);
          longAccel = 30 * (1 - 0.55 * speedRatio * speedRatio);
        }
      } else if (input.brake > 0) {
        if (forwardSpeed > 1.0) {
          longAccel = -46;
        } else {
          const revRatio = Math.max(0, -forwardSpeed / maxReverse);
          longAccel = -20 * (1 - revRatio * 0.6);
        }
      } else {
        // Coasting drag
        longAccel = -Math.sign(forwardSpeed) * Math.min(absSpeed / Math.max(dt, 0.001), 4.5);
      }

      if (input.handbrake) {
        forwardSpeed *= Math.exp(-1.8 * dt);
      }

      forwardSpeed += longAccel * dt;
      forwardSpeed = THREE.MathUtils.clamp(forwardSpeed, -maxReverse, maxForward);

      // 3. Lateral grip (lower when handbrake drifting)
      const lateralGrip = input.handbrake ? 2.2 : 9.5;
      lateralSpeed *= Math.exp(-lateralGrip * dt);

      this.vx = sYaw * forwardSpeed + cYaw * lateralSpeed;
      this.vz = cYaw * forwardSpeed - sYaw * lateralSpeed;
    }

    // 4. Integrate horizontal position & resolve collisions
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.resolveWorldBounds();
    this.resolveRampSideWalls();
    this.resolveBuildingCollisions();
    this.resolveCircleCollisions();

    // 5. Vertical physics & ramp launches
    const ground = this.world.sampleGround(this.x, this.z, this.y);
    const rampSlope = ground.onRamp
      ? ground.slopeX * sYaw + ground.slopeZ * cYaw
      : 0;

    if (this.grounded) {
      if (this.wasOnRamp && !ground.onRamp && forwardSpeed > 8 && this.lastRampSlope > 0.05) {
        // Launch off ramp lip
        this.vy = Math.max(0, forwardSpeed * this.lastRampSlope);
        this.grounded = false;
      } else if (this.y > ground.height + 0.35) {
        this.grounded = false;
      } else {
        this.y = ground.height;
        this.vy = 0;
      }
    }

    if (!this.grounded) {
      this.vy -= 26 * dt;
      this.y += this.vy * dt;
      if (this.y <= ground.height) {
        const impactVy = -this.vy;
        this.y = ground.height;
        this.vy = 0;
        this.grounded = true;
        if (impactVy > 3) {
          this.landingDip = Math.min(0.24, impactVy * 0.016);
        }
      }
    }

    this.wasOnRamp = ground.onRamp;
    this.lastRampSlope = rampSlope;

    // 6. Skid marks
    this.updateSkidMarks(dt, isDrifting || (this.grounded && input.brake > 0 && forwardSpeed > 18), ground.height);

    // 7. Visual rig & lights
    const targetRoll = THREE.MathUtils.clamp(
      -this.steerAngle * Math.min(1, absSpeed / 22) * 0.075 - lateralSpeed * 0.008,
      -0.12,
      0.12
    );
    const targetPitch = this.grounded
      ? -rampSlope - THREE.MathUtils.clamp(longAccel * 0.0022, -0.055, 0.055)
      : THREE.MathUtils.clamp(-this.vy * 0.015, -0.22, 0.22);

    this.syncVisuals(
      dt,
      targetRoll,
      targetPitch,
      input.brake > 0 || input.handbrake,
      forwardSpeed < -0.5,
      ground.height
    );

    // Spin wheels
    const wheelDelta = (forwardSpeed * dt) / this.rig.wheelRadius;
    for (const w of this.rig.wheelMeshes) {
      w.rotation.x += wheelDelta;
    }

    // 8. Telemetry
    const speedKmh = Math.round(Math.abs(forwardSpeed) * 3.6);
    const { gear, rpm } = computeGearAndRpm(forwardSpeed);

    return {
      speedKmh,
      rpm,
      gear,
      isDrifting,
      isAirborne: !this.grounded,
    };
  }

  public getPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.x, this.y, this.z);
  }

  public getForwardVector(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  public getSpeedRatio(): number {
    return Math.min(1, Math.hypot(this.vx, this.vz) / 52);
  }

  private syncVisuals(
    dt: number,
    targetRoll: number,
    targetPitch: number,
    isBraking: boolean,
    isReversing: boolean,
    groundHeight: number
  ): void {
    const suspLerp = dt > 0 ? 1 - Math.exp(-10 * dt) : 1;
    this.bodyRoll += (targetRoll - this.bodyRoll) * suspLerp;
    this.bodyPitch += (targetPitch - this.bodyPitch) * suspLerp;
    this.landingDip *= dt > 0 ? Math.exp(-12 * dt) : 0;

    this.rig.root.position.set(this.x, this.y, this.z);
    this.rig.root.rotation.set(0, this.yaw, 0);

    this.rig.body.position.y = -this.landingDip;
    this.rig.body.rotation.set(this.bodyPitch, 0, this.bodyRoll);

    const visualSteer = this.steerAngle * 0.58;
    this.rig.frontWheelPivots[0].rotation.y = visualSteer;
    this.rig.frontWheelPivots[1].rotation.y = visualSteer;

    this.rig.brakeLightMaterial.emissiveIntensity = isBraking ? 2.2 : 0.45;
    this.rig.reverseLightMaterial.emissiveIntensity = isReversing ? 1.6 : 0.0;

    // Blob shadow stays flat on ground
    const airHeight = Math.max(0, this.y - groundHeight);
    this.rig.blobShadow.position.set(this.x, groundHeight + 0.13, this.z);
    this.rig.blobShadow.rotation.y = this.yaw;
    const shadowScale = 1 + airHeight * 0.06;
    this.rig.blobShadow.scale.set(shadowScale, 1, shadowScale);
    const shadowMat = this.rig.blobShadow.material as THREE.MeshBasicMaterial;
    shadowMat.opacity = Math.max(0.15, 0.85 - airHeight * 0.09);
  }

  private updateSkidMarks(_dt: number, emit: boolean, groundY: number): void {
    if (!emit || !this.grounded) {
      this.hasPrevSkid = false;
      return;
    }

    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    // Rear wheels at local (±0.94, -1.36)
    const rearCenterX = this.x - s * 1.36;
    const rearCenterZ = this.z - c * 1.36;
    const lx = rearCenterX + c * 0.94;
    const lz = rearCenterZ - s * 0.94;
    const rx = rearCenterX - c * 0.94;
    const rz = rearCenterZ + s * 0.94;

    if (this.hasPrevSkid) {
      const dist = Math.hypot(lx - this.prevRearLx, lz - this.prevRearLz);
      if (dist > 0.25) {
        this.skidMarks.addSegment(this.prevRearLx, this.prevRearLz, lx, lz, groundY + 0.05, c, -s);
        this.skidMarks.addSegment(this.prevRearRx, this.prevRearRz, rx, rz, groundY + 0.05, c, -s);
        this.prevRearLx = lx;
        this.prevRearLz = lz;
        this.prevRearRx = rx;
        this.prevRearRz = rz;
      }
    } else {
      this.hasPrevSkid = true;
      this.prevRearLx = lx;
      this.prevRearLz = lz;
      this.prevRearRx = rx;
      this.prevRearRz = rz;
    }
  }

  private resolveWorldBounds(): void {
    const b = this.world.bounds;
    const minX = b.minX + this.carRadius;
    const maxX = b.maxX - this.carRadius;
    const minZ = b.minZ + this.carRadius;
    const maxZ = b.maxZ - this.carRadius;

    if (this.x < minX) {
      this.x = minX;
      if (this.vx < 0) this.vx = 0;
    } else if (this.x > maxX) {
      this.x = maxX;
      if (this.vx > 0) this.vx = 0;
    }

    if (this.z < minZ) {
      this.z = minZ;
      if (this.vz < 0) this.vz = 0;
    } else if (this.z > maxZ) {
      this.z = maxZ;
      if (this.vz > 0) this.vz = 0;
    }
  }

  private resolveRampSideWalls(): void {
    for (let i = 0; i < this.world.ramps.length; i++) {
      const r: RampDef = this.world.ramps[i];
      const dx = this.x - r.x;
      const dz = this.z - r.z;
      const cos = Math.cos(r.yaw);
      const sin = Math.sin(r.yaw);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      const hw = r.width * 0.5 + this.carRadius * 0.65;
      const hl = r.length * 0.5 + this.carRadius * 0.65;

      if (Math.abs(lx) < hw && Math.abs(lz) < hl) {
        const t = THREE.MathUtils.clamp((lz + r.length * 0.5) / r.length, 0, 1);
        const surfaceY = 0.06 + t * r.height;
        if (this.y < surfaceY - 1.1) {
          // Push out along nearest edge in local space
          const penX = hw - Math.abs(lx);
          const penZ = hl - Math.abs(lz);
          let pushLx = 0;
          let pushLz = 0;
          let normLx = 0;
          let normLz = 0;

          if (penX < penZ) {
            normLx = lx >= 0 ? 1 : -1;
            pushLx = normLx * penX;
          } else {
            normLz = lz >= 0 ? 1 : -1;
            pushLz = normLz * penZ;
          }

          // Transform back to world space
          this.x += pushLx * cos + pushLz * sin;
          this.z += -pushLx * sin + pushLz * cos;

          const nx = normLx * cos + normLz * sin;
          const nz = -normLx * sin + normLz * cos;
          const vDotN = this.vx * nx + this.vz * nz;
          if (vDotN < 0) {
            this.vx -= vDotN * nx;
            this.vz -= vDotN * nz;
          }
        }
      }
    }
  }

  private resolveBuildingCollisions(): void {
    const r = this.carRadius;
    const rSq = r * r;
    const colliders: AABB[] = this.world.colliders;

    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      const cx = THREE.MathUtils.clamp(this.x, box.minX, box.maxX);
      const cz = THREE.MathUtils.clamp(this.z, box.minZ, box.maxZ);
      const dx = this.x - cx;
      const dz = this.z - cz;
      const distSq = dx * dx + dz * dz;

      if (distSq >= rSq) continue;

      let nx = 0;
      let nz = 0;
      let push = 0;

      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        nx = dx / dist;
        nz = dz / dist;
        push = r - dist;
      } else {
        // Fallback if car center is inside AABB
        const dLeft = this.x - box.minX;
        const dRight = box.maxX - this.x;
        const dTop = this.z - box.minZ;
        const dBottom = box.maxZ - this.z;
        const minPen = Math.min(dLeft, dRight, dTop, dBottom);
        if (minPen === dLeft) nx = -1;
        else if (minPen === dRight) nx = 1;
        else if (minPen === dTop) nz = -1;
        else nz = 1;
        push = minPen + r;
      }

      this.x += nx * push;
      this.z += nz * push;

      const vDotN = this.vx * nx + this.vz * nz;
      if (vDotN < 0) {
        this.vx -= vDotN * nx;
        this.vz -= vDotN * nz;
        this.vx *= 0.9;
        this.vz *= 0.9;
      }
    }
  }

  private resolveCircleCollisions(): void {
    for (let i = 0; i < this.world.circleColliders.length; i++) {
      const c = this.world.circleColliders[i];
      const dx = this.x - c.x;
      const dz = this.z - c.z;
      const minDist = c.radius + this.carRadius;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDist * minDist && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const push = minDist - dist;

        this.x += nx * push;
        this.z += nz * push;

        const vDotN = this.vx * nx + this.vz * nz;
        if (vDotN < 0) {
          this.vx -= vDotN * nx;
          this.vz -= vDotN * nz;
          this.vx *= 0.92;
          this.vz *= 0.92;
        }
      }
    }
  }
}

function computeGearAndRpm(forwardSpeed: number): { gear: string; rpm: number } {
  if (forwardSpeed < -0.5) {
    return {
      gear: 'R',
      rpm: THREE.MathUtils.clamp(0.2 + (Math.abs(forwardSpeed) / 16) * 0.72, 0.18, 0.95),
    };
  }

  const speed = Math.abs(forwardSpeed);
  if (speed < 0.6) {
    return { gear: 'N', rpm: 0.14 };
  }

  const thresholds = [0, 11, 21, 32, 43, 55];
  let gearIdx = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (speed <= thresholds[i]) {
      gearIdx = i;
      break;
    }
    gearIdx = 5;
  }

  const low = thresholds[gearIdx - 1];
  const high = thresholds[gearIdx];
  const t = THREE.MathUtils.clamp((speed - low) / (high - low), 0, 1);
  const rpm = THREE.MathUtils.clamp(0.28 + t * 0.68, 0.2, 0.98);

  return { gear: String(gearIdx), rpm };
}
