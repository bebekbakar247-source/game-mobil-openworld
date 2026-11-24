export type CarId = 'urban-hatch' | 'gt-touring' | 'street-drift' | 'trail-suv';

export interface PaintSwatch {
  id: string;
  name: string;
  hex: string;
}

export interface CarDisplayStats {
  topSpeed: number;
  acceleration: number;
  handling: number;
  drift: number;
}

export interface CarPhysicsSpec {
  maxForwardSpeed: number;
  maxReverseSpeed: number;
  accel: number;
  accelFalloff: number;
  brakeDecel: number;
  turnRate: number;
  steerResponse: number;
  highSpeedSteerDamp: number;
  normalGrip: number;
  driftGrip: number;
  driftYawBoost: number;
  handbrakeDrag: number;
  rollMultiplier: number;
  pitchMultiplier: number;
  collisionRadius: number;
  rearAxleZ: number;
  rearTrackHalfWidth: number;
}

export interface CarSpec {
  id: CarId;
  name: string;
  tagline: string;
  defaultColor: string;
  stats: CarDisplayStats;
  physics: CarPhysicsSpec;
  hoodCamOffset: { y: number; z: number; lookY: number };
}

export const PAINT_SWATCHES: readonly PaintSwatch[] = [
  { id: 'crimson', name: 'Crimson Red', hex: '#e63946' },
  { id: 'cobalt', name: 'Cobalt Blue', hex: '#2563eb' },
  { id: 'amber', name: 'Sunburst Amber', hex: '#f59e0b' },
  { id: 'emerald', name: 'Emerald Mint', hex: '#10b981' },
  { id: 'glacier', name: 'Glacier White', hex: '#f1f5f9' },
  { id: 'graphite', name: 'Midnight Graphite', hex: '#334155' },
];

export const CAR_SPECS: readonly CarSpec[] = [
  {
    id: 'urban-hatch',
    name: 'Urban Hatch',
    tagline: 'Nimble compact hot-hatch built for tight city corners',
    defaultColor: '#f59e0b',
    stats: {
      topSpeed: 70,
      acceleration: 86,
      handling: 94,
      drift: 65,
    },
    physics: {
      maxForwardSpeed: 46,
      maxReverseSpeed: 16,
      accel: 34,
      accelFalloff: 0.62,
      brakeDecel: 50,
      turnRate: 3.05,
      steerResponse: 9.5,
      highSpeedSteerDamp: 0.012,
      normalGrip: 11.0,
      driftGrip: 2.8,
      driftYawBoost: 1.15,
      handbrakeDrag: 2.0,
      rollMultiplier: 0.95,
      pitchMultiplier: 1.0,
      collisionRadius: 1.52,
      rearAxleZ: -1.16,
      rearTrackHalfWidth: 0.88,
    },
    hoodCamOffset: { y: 1.52, z: 0.42, lookY: 1.38 },
  },
  {
    id: 'gt-touring',
    name: 'GT Touring',
    tagline: 'Long sleek sport-tourer with blistering top speed & planted grip',
    defaultColor: '#2563eb',
    stats: {
      topSpeed: 98,
      acceleration: 82,
      handling: 84,
      drift: 54,
    },
    physics: {
      maxForwardSpeed: 62,
      maxReverseSpeed: 17,
      accel: 29,
      accelFalloff: 0.38,
      brakeDecel: 52,
      turnRate: 2.35,
      steerResponse: 7.8,
      highSpeedSteerDamp: 0.016,
      normalGrip: 12.5,
      driftGrip: 3.1,
      driftYawBoost: 1.08,
      handbrakeDrag: 2.1,
      rollMultiplier: 0.65,
      pitchMultiplier: 0.7,
      collisionRadius: 1.75,
      rearAxleZ: -1.56,
      rearTrackHalfWidth: 0.98,
    },
    hoodCamOffset: { y: 1.36, z: 0.62, lookY: 1.24 },
  },
  {
    id: 'street-drift',
    name: 'Street Drift',
    tagline: 'Classic rear-drive sport coupe tuned for effortless long slides',
    defaultColor: '#e63946',
    stats: {
      topSpeed: 84,
      acceleration: 80,
      handling: 78,
      drift: 98,
    },
    physics: {
      maxForwardSpeed: 53,
      maxReverseSpeed: 16,
      accel: 31,
      accelFalloff: 0.5,
      brakeDecel: 46,
      turnRate: 2.75,
      steerResponse: 8.5,
      highSpeedSteerDamp: 0.011,
      normalGrip: 5.8,
      driftGrip: 1.35,
      driftYawBoost: 1.34,
      handbrakeDrag: 0.95,
      rollMultiplier: 1.05,
      pitchMultiplier: 1.0,
      collisionRadius: 1.65,
      rearAxleZ: -1.36,
      rearTrackHalfWidth: 0.95,
    },
    hoodCamOffset: { y: 1.46, z: 0.52, lookY: 1.32 },
  },
  {
    id: 'trail-suv',
    name: 'Trail SUV',
    tagline: 'Lifted wide-stance 4x4 with heavy torque and plush suspension',
    defaultColor: '#10b981',
    stats: {
      topSpeed: 74,
      acceleration: 88,
      handling: 72,
      drift: 60,
    },
    physics: {
      maxForwardSpeed: 48,
      maxReverseSpeed: 18,
      accel: 35,
      accelFalloff: 0.58,
      brakeDecel: 44,
      turnRate: 2.25,
      steerResponse: 6.5,
      highSpeedSteerDamp: 0.015,
      normalGrip: 8.8,
      driftGrip: 2.5,
      driftYawBoost: 1.12,
      handbrakeDrag: 1.9,
      rollMultiplier: 1.75,
      pitchMultiplier: 1.65,
      collisionRadius: 1.78,
      rearAxleZ: -1.42,
      rearTrackHalfWidth: 1.06,
    },
    hoodCamOffset: { y: 1.92, z: 0.58, lookY: 1.74 },
  },
];

export function getCarSpecById(id: CarId): CarSpec {
  return CAR_SPECS.find((spec) => spec.id === id) ?? CAR_SPECS[2];
}

const STORAGE_KEY = 'openworld_drive_garage_v1';

export function loadGarageSelection(): { carId: CarId; paintHex: string } {
  const fallback = { carId: 'street-drift' as CarId, paintHex: '#e63946' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { carId?: unknown; paintHex?: unknown };
    const validCar = CAR_SPECS.find((c) => c.id === parsed.carId);
    const validHex =
      typeof parsed.paintHex === 'string' &&
      PAINT_SWATCHES.some((s) => s.hex.toLowerCase() === parsed.paintHex!.toString().toLowerCase())
        ? parsed.paintHex
        : validCar?.defaultColor ?? fallback.paintHex;
    return {
      carId: validCar ? validCar.id : fallback.carId,
      paintHex: validHex,
    };
  } catch {
    return fallback;
  }
}

export function saveGarageSelection(carId: CarId, paintHex: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ carId, paintHex }));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}
