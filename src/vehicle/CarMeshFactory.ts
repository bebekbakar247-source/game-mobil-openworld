import * as THREE from 'three';
import type { CarId } from './CarSpecs';

export interface CarRig {
  root: THREE.Group;
  body: THREE.Group;
  frontWheelPivots: [THREE.Group, THREE.Group];
  wheelMeshes: THREE.Object3D[];
  wheelRadius: number;
  paintMaterial: THREE.MeshStandardMaterial;
  brakeLightMaterial: THREE.MeshStandardMaterial;
  reverseLightMaterial: THREE.MeshStandardMaterial;
  blobShadow: THREE.Mesh;
}

interface SharedCarMaterials {
  paintMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  brakeLightMaterial: THREE.MeshStandardMaterial;
  reverseLightMaterial: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshStandardMaterial;
  tireMat: THREE.MeshStandardMaterial;
  rimMat: THREE.MeshStandardMaterial;
  spokeMat: THREE.MeshStandardMaterial;
}

function createBlobShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
  grad.addColorStop(0, 'rgba(8, 12, 20, 0.58)');
  grad.addColorStop(0.55, 'rgba(8, 12, 20, 0.34)');
  grad.addColorStop(1, 'rgba(8, 12, 20, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  return new THREE.CanvasTexture(canvas);
}

function createWheel(
  radius: number,
  width: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  spokeMat: THREE.Material
): THREE.Group {
  const wheel = new THREE.Group();

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 18),
    tireMat
  );
  tire.rotation.z = Math.PI / 2;
  wheel.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width + 0.02, 12),
    rimMat
  );
  rim.rotation.z = Math.PI / 2;
  wheel.add(rim);

  const spokeWidth = width + 0.04;
  const spokeA = new THREE.Mesh(
    new THREE.BoxGeometry(spokeWidth, radius * 1.08, 0.08),
    spokeMat
  );
  wheel.add(spokeA);

  const spokeB = new THREE.Mesh(
    new THREE.BoxGeometry(spokeWidth, 0.08, radius * 1.08),
    spokeMat
  );
  wheel.add(spokeB);

  return wheel;
}

function addBox(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  rotX = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (rotX !== 0) mesh.rotation.x = rotX;
  parent.add(mesh);
  return mesh;
}

function buildUrbanHatchBody(body: THREE.Group, m: SharedCarMaterials): void {
  // Compact hatchback chassis (length ~3.75, width ~1.84)
  addBox(body, 1.82, 0.52, 3.66, 0, 0.56, 0, m.paintMat);
  // Short sloped hood
  addBox(body, 1.72, 0.2, 1.05, 0, 0.82, 1.18, m.paintMat, 0.14);
  // Tall hatchback greenhouse extending to rear tailgate
  addBox(body, 1.56, 0.56, 2.18, 0, 1.1, -0.52, m.glassMat);
  // Flat hatch roof
  addBox(body, 1.52, 0.08, 1.82, 0, 1.4, -0.58, m.paintMat);
  // Rear tailgate pillar block
  addBox(body, 1.62, 0.48, 0.28, 0, 1.06, -1.6, m.paintMat, -0.14);
  // Hot-hatch roof lip spoiler
  addBox(body, 1.56, 0.08, 0.28, 0, 1.44, -1.68, m.trimMat, -0.15);

  // Front & rear dark bumper trim + side skirts
  addBox(body, 1.86, 0.18, 0.22, 0, 0.34, 1.78, m.trimMat);
  addBox(body, 1.86, 0.18, 0.22, 0, 0.34, -1.78, m.trimMat);
  addBox(body, 0.08, 0.12, 1.68, 0.91, 0.32, 0, m.trimMat);
  addBox(body, 0.08, 0.12, 1.68, -0.91, 0.32, 0, m.trimMat);

  // Twin center exhaust tips
  addBox(body, 0.12, 0.1, 0.16, 0.12, 0.28, -1.88, m.chromeMat);
  addBox(body, 0.12, 0.1, 0.16, -0.12, 0.28, -1.88, m.chromeMat);

  // Side mirrors
  addBox(body, 0.2, 0.11, 0.14, 0.96, 0.9, 0.42, m.paintMat);
  addBox(body, 0.2, 0.11, 0.14, -0.96, 0.9, 0.42, m.paintMat);

  // Headlights + round-style fog lights
  addBox(body, 0.38, 0.14, 0.08, 0.6, 0.64, 1.84, m.headlightMat);
  addBox(body, 0.38, 0.14, 0.08, -0.6, 0.64, 1.84, m.headlightMat);
  addBox(body, 0.18, 0.1, 0.06, 0.62, 0.4, 1.86, m.headlightMat);
  addBox(body, 0.18, 0.1, 0.06, -0.62, 0.4, 1.86, m.headlightMat);

  // Tall hatch tail lights & reverse strip
  addBox(body, 0.26, 0.28, 0.08, 0.72, 0.74, -1.84, m.brakeLightMaterial);
  addBox(body, 0.26, 0.28, 0.08, -0.72, 0.74, -1.84, m.brakeLightMaterial);
  addBox(body, 0.32, 0.08, 0.08, 0, 0.56, -1.84, m.reverseLightMaterial);
}

function buildGtTouringBody(body: THREE.Group, m: SharedCarMaterials): void {
  // Long low-slung sport-tourer / shooting-brake (length ~4.88, width ~2.12)
  addBox(body, 2.08, 0.48, 4.82, 0, 0.54, 0, m.paintMat);
  // Long sculpted hood + subtle hood vent
  addBox(body, 1.94, 0.18, 1.95, 0, 0.78, 1.32, m.paintMat, 0.06);
  addBox(body, 0.62, 0.05, 0.45, 0, 0.88, 1.38, m.trimMat, 0.06);

  // Low swept fastback greenhouse
  addBox(body, 1.68, 0.42, 2.25, 0, 0.98, -0.45, m.glassMat);
  addBox(body, 1.62, 0.08, 1.65, 0, 1.2, -0.42, m.paintMat);
  // Tapered fastback rear deck
  addBox(body, 1.64, 0.16, 0.95, 0, 0.94, -1.78, m.paintMat, -0.22);

  // Aero splitter, side skirts, rear diffuser
  addBox(body, 2.14, 0.1, 0.4, 0, 0.28, 2.38, m.trimMat);
  addBox(body, 2.12, 0.12, 0.34, 0, 0.29, -2.35, m.trimMat);
  addBox(body, 0.1, 0.11, 2.6, 1.06, 0.28, 0, m.trimMat);
  addBox(body, 0.1, 0.11, 2.6, -1.06, 0.28, 0, m.trimMat);

  // Subtle ducktail spoiler
  addBox(body, 1.98, 0.1, 0.24, 0, 0.86, -2.32, m.paintMat, -0.32);

  // Quad exhaust tips
  addBox(body, 0.11, 0.09, 0.16, 0.68, 0.26, -2.46, m.chromeMat);
  addBox(body, 0.11, 0.09, 0.16, 0.52, 0.26, -2.46, m.chromeMat);
  addBox(body, 0.11, 0.09, 0.16, -0.52, 0.26, -2.46, m.chromeMat);
  addBox(body, 0.11, 0.09, 0.16, -0.68, 0.26, -2.46, m.chromeMat);

  // Mirrors
  addBox(body, 0.24, 0.1, 0.18, 1.12, 0.84, 0.58, m.paintMat);
  addBox(body, 0.24, 0.1, 0.18, -1.12, 0.84, 0.58, m.paintMat);

  // Sleek headlights & full-width LED tail light bar
  addBox(body, 0.48, 0.1, 0.08, 0.7, 0.62, 2.42, m.headlightMat);
  addBox(body, 0.48, 0.1, 0.08, -0.7, 0.62, 2.42, m.headlightMat);
  addBox(body, 1.88, 0.1, 0.08, 0, 0.66, -2.42, m.brakeLightMaterial);
  addBox(body, 0.44, 0.06, 0.08, 0, 0.54, -2.42, m.reverseLightMaterial);
}

function buildStreetDriftBody(body: THREE.Group, m: SharedCarMaterials): void {
  // Classic sporty 3-box drift coupe (length ~4.42, width ~2.0)
  addBox(body, 1.98, 0.54, 4.35, 0, 0.58, 0, m.paintMat);
  addBox(body, 1.86, 0.2, 1.55, 0, 0.84, 1.25, m.paintMat, 0.08);

  // Front intercooler core
  addBox(body, 1.02, 0.22, 0.12, 0, 0.42, 2.18, m.chromeMat);

  // Aero splitter, diffuser & side skirts
  addBox(body, 2.06, 0.11, 0.36, 0, 0.3, 2.15, m.trimMat);
  addBox(body, 2.02, 0.13, 0.32, 0, 0.32, -2.12, m.trimMat);
  addBox(body, 0.1, 0.13, 2.2, 1.0, 0.31, 0, m.trimMat);
  addBox(body, 0.1, 0.13, 2.2, -1.0, 0.31, 0, m.trimMat);

  // Cabin & roof
  addBox(body, 1.62, 0.48, 2.0, 0, 1.09, -0.18, m.glassMat);
  addBox(body, 1.56, 0.08, 1.42, 0, 1.35, -0.22, m.paintMat);

  // Tall GT rear wing
  addBox(body, 1.98, 0.08, 0.36, 0, 1.22, -2.04, m.trimMat, -0.08);
  addBox(body, 0.08, 0.38, 0.18, 0.56, 1.02, -2.02, m.trimMat);
  addBox(body, 0.08, 0.38, 0.18, -0.56, 1.02, -2.02, m.trimMat);

  // Angled drift exhaust canister
  addBox(body, 0.18, 0.14, 0.24, -0.68, 0.28, -2.2, m.chromeMat);

  // Mirrors
  addBox(body, 0.24, 0.12, 0.16, 1.06, 0.92, 0.55, m.paintMat);
  addBox(body, 0.24, 0.12, 0.16, -1.06, 0.92, 0.55, m.paintMat);

  // Headlights, dual brake lights, reverse strip
  addBox(body, 0.42, 0.14, 0.08, 0.66, 0.66, 2.18, m.headlightMat);
  addBox(body, 0.42, 0.14, 0.08, -0.66, 0.66, 2.18, m.headlightMat);
  addBox(body, 0.48, 0.14, 0.08, 0.66, 0.68, -2.18, m.brakeLightMaterial);
  addBox(body, 0.48, 0.14, 0.08, -0.66, 0.68, -2.18, m.brakeLightMaterial);
  addBox(body, 0.36, 0.09, 0.08, 0, 0.66, -2.18, m.reverseLightMaterial);
}

function buildTrailSuvBody(body: THREE.Group, m: SharedCarMaterials): void {
  // Lifted 4x4 chassis (higher ground clearance)
  addBox(body, 2.06, 0.62, 4.42, 0, 0.86, 0, m.paintMat);
  // Dark rugged underbody frame & skid plates
  addBox(body, 1.88, 0.16, 4.18, 0, 0.52, 0, m.trimMat);
  addBox(body, 1.4, 0.14, 0.28, 0, 0.52, 2.14, m.chromeMat, -0.25);
  addBox(body, 1.4, 0.14, 0.28, 0, 0.52, -2.14, m.chromeMat, 0.25);

  // Boxy upright SUV greenhouse & roof
  addBox(body, 1.84, 0.6, 2.65, 0, 1.46, -0.45, m.glassMat);
  addBox(body, 1.8, 0.1, 2.55, 0, 1.79, -0.48, m.paintMat);

  // Rugged fender flares
  const flarePositions: Array<[number, number]> = [
    [1.06, 1.42],
    [-1.06, 1.42],
    [1.06, -1.42],
    [-1.06, -1.42],
  ];
  for (const [fx, fz] of flarePositions) {
    addBox(body, 0.14, 0.22, 1.05, fx, 0.82, fz, m.trimMat);
  }

  // Front tubular bullbar / brush guard
  addBox(body, 1.56, 0.09, 0.12, 0, 0.94, 2.32, m.trimMat);
  addBox(body, 1.56, 0.09, 0.12, 0, 0.68, 2.32, m.trimMat);
  addBox(body, 0.1, 0.34, 0.12, 0.45, 0.8, 2.32, m.trimMat);
  addBox(body, 0.1, 0.34, 0.12, -0.45, 0.8, 2.32, m.trimMat);

  // Roof rack rails + 4 auxiliary LED light pods
  addBox(body, 0.08, 0.08, 2.25, 0.72, 1.88, -0.48, m.trimMat);
  addBox(body, 0.08, 0.08, 2.25, -0.72, 1.88, -0.48, m.trimMat);
  addBox(body, 1.48, 0.06, 0.08, 0, 1.88, 0.58, m.trimMat);
  addBox(body, 1.48, 0.06, 0.08, 0, 1.88, -1.52, m.trimMat);
  for (const lx of [-0.45, -0.15, 0.15, 0.45]) {
    addBox(body, 0.16, 0.11, 0.12, lx, 1.94, 0.58, m.headlightMat);
  }

  // Rear tailgate-mounted spare wheel
  const spare = createWheel(0.44, 0.3, m.tireMat, m.rimMat, m.spokeMat);
  spare.rotation.y = Math.PI / 2;
  spare.position.set(0, 1.06, -2.35);
  body.add(spare);

  // Mirrors
  addBox(body, 0.26, 0.14, 0.16, 1.12, 1.24, 0.55, m.trimMat);
  addBox(body, 0.26, 0.14, 0.16, -1.12, 1.24, 0.55, m.trimMat);

  // Headlights, brake lights & reverse strip
  addBox(body, 0.4, 0.18, 0.08, 0.74, 0.94, 2.22, m.headlightMat);
  addBox(body, 0.4, 0.18, 0.08, -0.74, 0.94, 2.22, m.headlightMat);
  addBox(body, 0.34, 0.26, 0.08, 0.78, 0.96, -2.22, m.brakeLightMaterial);
  addBox(body, 0.34, 0.26, 0.08, -0.78, 0.96, -2.22, m.brakeLightMaterial);
  addBox(body, 0.34, 0.09, 0.08, 0.46, 0.72, -2.22, m.reverseLightMaterial);
}

export function createCarRig(carId: CarId, paintHex: string): CarRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const materials: SharedCarMaterials = {
    paintMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color(paintHex),
      roughness: 0.32,
      metalness: 0.28,
    }),
    trimMat: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.72,
      metalness: 0.15,
    }),
    glassMat: new THREE.MeshStandardMaterial({
      color: 0x1d3557,
      roughness: 0.15,
      metalness: 0.65,
    }),
    headlightMat: new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef3c7,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    }),
    brakeLightMaterial: new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.45,
      roughness: 0.25,
    }),
    reverseLightMaterial: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xffffff,
      emissiveIntensity: 0.0,
      roughness: 0.25,
    }),
    chromeMat: new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.25,
      metalness: 0.85,
    }),
    tireMat: new THREE.MeshStandardMaterial({ color: 0x16191f, roughness: 0.9 }),
    rimMat: new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.3,
      metalness: 0.75,
    }),
    spokeMat: new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.6,
    }),
  };

  let wheelRadius = 0.41;
  let wheelWidth = 0.35;
  let axleX = 0.95;
  let axleZ = 1.36;
  let shadowW = 2.8;
  let shadowL = 5.2;

  switch (carId) {
    case 'urban-hatch':
      wheelRadius = 0.38;
      wheelWidth = 0.31;
      axleX = 0.88;
      axleZ = 1.16;
      shadowW = 2.55;
      shadowL = 4.45;
      buildUrbanHatchBody(body, materials);
      break;
    case 'gt-touring':
      wheelRadius = 0.43;
      wheelWidth = 0.38;
      axleX = 0.98;
      axleZ = 1.56;
      shadowW = 2.95;
      shadowL = 5.65;
      buildGtTouringBody(body, materials);
      break;
    case 'trail-suv':
      wheelRadius = 0.52;
      wheelWidth = 0.42;
      axleX = 1.06;
      axleZ = 1.42;
      shadowW = 3.05;
      shadowL = 5.4;
      buildTrailSuvBody(body, materials);
      break;
    case 'street-drift':
    default:
      wheelRadius = 0.41;
      wheelWidth = 0.35;
      axleX = 0.95;
      axleZ = 1.36;
      shadowW = 2.8;
      shadowL = 5.2;
      buildStreetDriftBody(body, materials);
      break;
  }

  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(axleX, wheelRadius, axleZ);
  const frontLeftWheel = createWheel(
    wheelRadius,
    wheelWidth,
    materials.tireMat,
    materials.rimMat,
    materials.spokeMat
  );
  frontLeftPivot.add(frontLeftWheel);
  root.add(frontLeftPivot);

  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(-axleX, wheelRadius, axleZ);
  const frontRightWheel = createWheel(
    wheelRadius,
    wheelWidth,
    materials.tireMat,
    materials.rimMat,
    materials.spokeMat
  );
  frontRightPivot.add(frontRightWheel);
  root.add(frontRightPivot);

  const rearLeftWheel = createWheel(
    wheelRadius,
    wheelWidth,
    materials.tireMat,
    materials.rimMat,
    materials.spokeMat
  );
  rearLeftWheel.position.set(axleX, wheelRadius, -axleZ);
  root.add(rearLeftWheel);

  const rearRightWheel = createWheel(
    wheelRadius,
    wheelWidth,
    materials.tireMat,
    materials.rimMat,
    materials.spokeMat
  );
  rearRightWheel.position.set(-axleX, wheelRadius, -axleZ);
  root.add(rearRightWheel);

  // Lightweight Blob Shadow
  const shadowGeom = new THREE.PlaneGeometry(shadowW, shadowL);
  shadowGeom.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createBlobShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  const blobShadow = new THREE.Mesh(shadowGeom, shadowMat);
  blobShadow.position.set(0, 0.13, 0);

  return {
    root,
    body,
    frontWheelPivots: [frontLeftPivot, frontRightPivot],
    wheelMeshes: [frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel],
    wheelRadius,
    paintMaterial: materials.paintMat,
    brakeLightMaterial: materials.brakeLightMaterial,
    reverseLightMaterial: materials.reverseLightMaterial,
    blobShadow,
  };
}

export function disposeCarRig(rig: CarRig): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  const collect = (obj: THREE.Object3D): void => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          geometries.add(child.geometry);
        }
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (!mat) continue;
          materials.add(mat);
          const maybeTextured = mat as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
          if (maybeTextured.map) {
            textures.add(maybeTextured.map);
          }
        }
      }
    });
  };

  collect(rig.root);
  collect(rig.blobShadow);

  rig.root.removeFromParent();
  rig.blobShadow.removeFromParent();

  for (const tex of textures) {
    tex.dispose();
  }
  for (const mat of materials) {
    mat.dispose();
  }
  for (const geom of geometries) {
    geom.dispose();
  }
}
