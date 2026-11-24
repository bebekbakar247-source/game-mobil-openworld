import * as THREE from 'three';

export interface CarRig {
  root: THREE.Group;
  body: THREE.Group;
  frontWheelPivots: [THREE.Group, THREE.Group];
  wheelMeshes: THREE.Object3D[];
  wheelRadius: number;
  brakeLightMaterial: THREE.MeshStandardMaterial;
  reverseLightMaterial: THREE.MeshStandardMaterial;
  blobShadow: THREE.Mesh;
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

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createWheel(
  radius: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  spokeMat: THREE.Material
): THREE.Group {
  const wheel = new THREE.Group();

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.34, 18),
    tireMat
  );
  tire.rotation.z = Math.PI / 2;
  wheel.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, 0.36, 12),
    rimMat
  );
  rim.rotation.z = Math.PI / 2;
  wheel.add(rim);

  // Visible spoke bar so wheel rotation is clear at a glance
  const spokeA = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, radius * 1.12, 0.08),
    spokeMat
  );
  wheel.add(spokeA);

  const spokeB = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.08, radius * 1.12),
    spokeMat
  );
  wheel.add(spokeB);

  return wheel;
}

export function createCarRig(): CarRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paintMat = new THREE.MeshStandardMaterial({
    color: 0xe63946,
    roughness: 0.32,
    metalness: 0.28,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.15,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1d3557,
    roughness: 0.15,
    metalness: 0.65,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef3c7,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const brakeLightMaterial = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });
  const reverseLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.25,
  });

  // Lower chassis (local +Z is forward)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.56, 4.35), paintMat);
  chassis.position.set(0, 0.6, 0);
  body.add(chassis);

  // Tapered front hood & nose
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.22, 1.55), paintMat);
  hood.position.set(0, 0.86, 1.25);
  hood.rotation.x = 0.08;
  body.add(hood);

  // Front splitter & rear diffuser
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.12, 0.35), trimMat);
  splitter.position.set(0, 0.32, 2.15);
  body.add(splitter);

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.14, 0.32), trimMat);
  diffuser.position.set(0, 0.34, -2.12);
  body.add(diffuser);

  // Side skirts
  const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 2.2), trimMat);
  skirtL.position.set(1.0, 0.33, 0);
  body.add(skirtL);

  const skirtR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 2.2), trimMat);
  skirtR.position.set(-1.0, 0.33, 0);
  body.add(skirtR);

  // Cabin greenhouse
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 2.05), glassMat);
  cabin.position.set(0, 1.12, -0.18);
  body.add(cabin);

  // Roof cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.08, 1.45), paintMat);
  roof.position.set(0, 1.38, -0.22);
  body.add(roof);

  // Rear wing spoiler
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.08, 0.34), trimMat);
  wing.position.set(0, 1.12, -2.02);
  body.add(wing);

  const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.18), trimMat);
  strutL.position.set(0.55, 0.98, -2.02);
  body.add(strutL);

  const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.18), trimMat);
  strutR.position.set(-0.55, 0.98, -2.02);
  body.add(strutR);

  // Side mirrors
  const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.16), paintMat);
  mirrorL.position.set(1.06, 0.94, 0.55);
  body.add(mirrorL);

  const mirrorR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.16), paintMat);
  mirrorR.position.set(-1.06, 0.94, 0.55);
  body.add(mirrorR);

  // Headlights (+Z)
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), headlightMat);
  headL.position.set(0.66, 0.68, 2.18);
  body.add(headL);

  const headR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), headlightMat);
  headR.position.set(-0.66, 0.68, 2.18);
  body.add(headR);

  // Brake lights (-Z)
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.08), brakeLightMaterial);
  tailL.position.set(0.66, 0.7, -2.18);
  body.add(tailL);

  const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.08), brakeLightMaterial);
  tailR.position.set(-0.66, 0.7, -2.18);
  body.add(tailR);

  // Reverse light center strip (-Z)
  const revStrip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.08), reverseLightMaterial);
  revStrip.position.set(0, 0.68, -2.18);
  body.add(revStrip);

  // 4 Wheels
  const wheelRadius = 0.42;
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x16191f, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.75,
  });
  const spokeMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.4,
    metalness: 0.6,
  });

  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(0.94, wheelRadius, 1.36);
  const frontLeftWheel = createWheel(wheelRadius, tireMat, rimMat, spokeMat);
  frontLeftPivot.add(frontLeftWheel);
  root.add(frontLeftPivot);

  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(-0.94, wheelRadius, 1.36);
  const frontRightWheel = createWheel(wheelRadius, tireMat, rimMat, spokeMat);
  frontRightPivot.add(frontRightWheel);
  root.add(frontRightPivot);

  const rearLeftWheel = createWheel(wheelRadius, tireMat, rimMat, spokeMat);
  rearLeftWheel.position.set(0.94, wheelRadius, -1.36);
  root.add(rearLeftWheel);

  const rearRightWheel = createWheel(wheelRadius, tireMat, rimMat, spokeMat);
  rearRightWheel.position.set(-0.94, wheelRadius, -1.36);
  root.add(rearRightWheel);

  // Lightweight Blob Shadow
  const shadowGeom = new THREE.PlaneGeometry(2.8, 5.2);
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
    brakeLightMaterial,
    reverseLightMaterial,
    blobShadow,
  };
}
