import * as THREE from 'three';

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
}

export interface RampDef {
  x: number;
  z: number;
  width: number;
  length: number;
  height: number;
  yaw: number;
}

export interface GroundSample {
  height: number;
  slopeX: number;
  slopeZ: number;
  onRamp: boolean;
  rampIndex: number;
}

export interface WorldData {
  colliders: AABB[];
  circleColliders: CircleCollider[];
  ramps: RampDef[];
  bounds: AABB;
  spawn: { x: number; z: number; yaw: number };
  streetLampBulbMaterial: THREE.MeshStandardMaterial;
  buildingMaterial: THREE.MeshStandardMaterial;
  sampleGround: (x: number, z: number, currentY: number) => GroundSample;
}

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createDashedRoadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2d3138';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle shoulder lines
  ctx.fillStyle = '#d8dde6';
  ctx.fillRect(10, 0, 5, 256);
  ctx.fillRect(241, 0, 5, 256);

  // Center dashed yellow/amber line
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(125, 16, 6, 96);
  ctx.fillRect(125, 144, 6, 96);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createBuildingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e5e9ef';
  ctx.fillRect(0, 0, 256, 512);

  const cols = 6;
  const rows = 14;
  const padX = 12;
  const padY = 10;
  const cellW = (256 - padX * 2) / cols;
  const cellH = (512 - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = padX + c * cellW + 4;
      const wy = padY + r * cellH + 5;
      const ww = cellW - 8;
      const wh = cellH - 10;

      ctx.fillStyle = (r + c) % 5 === 0 ? '#5b84a6' : '#32485c';
      ctx.fillRect(wx, wy, ww, wh);

      // Window highlight strip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(wx + 2, wy + 2, ww * 0.35, wh - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createBuildingEmissiveTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 512);

  const cols = 6;
  const rows = 14;
  const padX = 12;
  const padY = 10;
  const cellW = (256 - padX * 2) / cols;
  const cellH = (512 - padY * 2) / rows;
  const rng = createSeededRng(77123);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() > 0.6) continue;
      const wx = padX + c * cellW + 4;
      const wy = padY + r * cellH + 5;
      const ww = cellW - 8;
      const wh = cellH - 10;

      ctx.fillStyle = (r + c) % 3 === 0 ? '#ffe8a3' : '#ffd166';
      ctx.fillRect(wx, wy, ww, wh);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRampTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f97316';
  ctx.fillRect(0, 0, 256, 512);

  // Side safety stripes
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 20, 512);
  ctx.fillRect(236, 0, 20, 512);

  // Chevrons pointing up (+V / launch direction)
  ctx.fillStyle = '#fde047';
  for (let y = 40; y < 480; y += 90) {
    ctx.beginPath();
    ctx.moveTo(46, y + 48);
    ctx.lineTo(128, y);
    ctx.lineTo(210, y + 48);
    ctx.lineTo(210, y + 72);
    ctx.lineTo(128, y + 24);
    ctx.lineTo(46, y + 72);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createRampMesh(ramp: RampDef, material: THREE.Material): THREE.Mesh {
  const hw = ramp.width * 0.5;
  const hl = ramp.length * 0.5;
  const h = ramp.height;

  // Wedge: local -Z is ground entry (y=0), local +Z is launch lip (y=h)
  const positions = new Float32Array([
    // Sloped top surface (2 triangles)
    -hw, 0, -hl,
    hw, 0, -hl,
    hw, h, hl,
    -hw, 0, -hl,
    hw, h, hl,
    -hw, h, hl,

    // Back vertical wall (+Z)
    -hw, 0, hl,
    -hw, h, hl,
    hw, h, hl,
    -hw, 0, hl,
    hw, h, hl,
    hw, 0, hl,

    // Left triangle (-X)
    -hw, 0, -hl,
    -hw, h, hl,
    -hw, 0, hl,

    // Right triangle (+X)
    hw, 0, -hl,
    hw, 0, hl,
    hw, h, hl,
  ]);

  const uvs = new Float32Array([
    // Top slope
    0, 0,
    1, 0,
    1, 1,
    0, 0,
    1, 1,
    0, 1,

    // Back wall
    0, 0,
    0, 1,
    1, 1,
    0, 0,
    1, 1,
    1, 0,

    // Left
    0, 0,
    1, 1,
    1, 0,

    // Right
    0, 0,
    1, 0,
    1, 1,
  ]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(ramp.x, 0.06, ramp.z);
  mesh.rotation.y = ramp.yaw;
  return mesh;
}

export function buildWorld(scene: THREE.Scene): WorldData {
  const colliders: AABB[] = [];
  const circleColliders: CircleCollider[] = [];
  const bounds: AABB = { minX: -660, maxX: 590, minZ: -660, maxZ: 660 };

  const rng = createSeededRng(20261124);

  // 1. Ocean, Land, Beach, and Boardwalk (strict Y-layering)
  const oceanGeom = new THREE.PlaneGeometry(4000, 4000);
  oceanGeom.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x219ebc,
    roughness: 0.35,
    metalness: 0.1,
  });
  const ocean = new THREE.Mesh(oceanGeom, oceanMat);
  ocean.position.set(0, -1.6, 0);
  scene.add(ocean);

  const landGeom = new THREE.PlaneGeometry(1270, 1400);
  landGeom.rotateX(-Math.PI / 2);
  const landMat = new THREE.MeshStandardMaterial({
    color: 0x6ca965,
    roughness: 0.95,
  });
  const land = new THREE.Mesh(landGeom, landMat);
  land.position.set(-65, 0.0, 0);
  scene.add(land);

  const beachGeom = new THREE.PlaneGeometry(60, 1400);
  beachGeom.rotateX(-Math.PI / 2);
  const beachMat = new THREE.MeshStandardMaterial({
    color: 0xe9d8a6,
    roughness: 0.92,
  });
  const beach = new THREE.Mesh(beachGeom, beachMat);
  beach.position.set(595, 0.03, 0);
  scene.add(beach);

  // Coastal wooden boardwalk promenade & scenic pier
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x9c6644,
    roughness: 0.85,
  });
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(16, 0.22, 1120), woodMat);
  boardwalk.position.set(548, 0.14, 0);
  scene.add(boardwalk);

  const pier = new THREE.Mesh(new THREE.BoxGeometry(84, 0.22, 14), woodMat);
  pier.position.set(598, 0.14, 0);
  scene.add(pier);

  // 2. Road Network (Asphalt y = 0.06, Main Boulevards y = 0.058, Roundabout y = 0.062)
  const roadTexBase = createDashedRoadTexture();
  const makeRoadMat = (repeatX: number, repeatY: number): THREE.MeshStandardMaterial => {
    const tex = roadTexBase.clone();
    tex.needsUpdate = true;
    tex.repeat.set(repeatX, repeatY);
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
    });
  };

  const solidAsphaltMat = new THREE.MeshStandardMaterial({
    color: 0x2d3138,
    roughness: 0.85,
  });

  const addRoadSegment = (
    x: number,
    z: number,
    width: number,
    length: number,
    horizontal: boolean,
    y = 0.06
  ): void => {
    const geom = new THREE.PlaneGeometry(width, length);
    geom.rotateX(-Math.PI / 2);
    if (horizontal) {
      geom.rotateY(Math.PI / 2);
    }
    const mat = makeRoadMat(1, Math.max(1, Math.round(length / 28)));
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
  };

  // Outer Loop Highway (width 26, straights from -440 to +440, corners radius 80 -> ±520)
  addRoadSegment(0, -520, 26, 880, true, 0.06); // North highway
  addRoadSegment(0, 520, 26, 880, true, 0.06); // South highway
  addRoadSegment(-520, 0, 26, 880, false, 0.06); // West highway
  addRoadSegment(520, 0, 26, 880, false, 0.06); // East Coastal Boardwalk Road

  // 4 Seamless Corner Arcs centered at (±440, ±440)
  const corners: Array<{ cx: number; cz: number; startAngle: number }> = [
    { cx: 440, cz: 440, startAngle: 0 },
    { cx: -440, cz: 440, startAngle: Math.PI / 2 },
    { cx: -440, cz: -440, startAngle: Math.PI },
    { cx: 440, cz: -440, startAngle: (3 * Math.PI) / 2 },
  ];
  const cornerLineMat = new THREE.MeshBasicMaterial({ color: 0xf2c14e });
  for (const c of corners) {
    const arcGeom = new THREE.RingGeometry(67, 93, 24, 1, c.startAngle, Math.PI / 2);
    arcGeom.rotateX(-Math.PI / 2);
    const arcMesh = new THREE.Mesh(arcGeom, solidAsphaltMat);
    arcMesh.position.set(c.cx, 0.06, c.cz);
    scene.add(arcMesh);

    const stripeGeom = new THREE.RingGeometry(79.5, 80.5, 24, 1, c.startAngle, Math.PI / 2);
    stripeGeom.rotateX(-Math.PI / 2);
    const stripeMesh = new THREE.Mesh(stripeGeom, cornerLineMat);
    stripeMesh.position.set(c.cx, 0.09, c.cz);
    scene.add(stripeMesh);
  }

  // Main Boulevards (width 22)
  addRoadSegment(0, 0, 22, 1040, true, 0.058);
  addRoadSegment(0, 0, 22, 1040, false, 0.058);

  // Downtown City Grid Streets (width 16)
  const gridX = [-260, -130, 130, 260, 390];
  const gridZ = [-260, -130, 130, 260];
  for (const gx of gridX) {
    addRoadSegment(gx, 0, 16, 1040, false, 0.059);
  }
  for (const gz of gridZ) {
    addRoadSegment(0, gz, 16, 1040, true, 0.059);
  }

  // 3. Central Roundabout at (0, 0)
  const roundaboutRing = new THREE.Mesh(
    new THREE.RingGeometry(34, 62, 48).rotateX(-Math.PI / 2),
    solidAsphaltMat
  );
  roundaboutRing.position.set(0, 0.062, 0);
  scene.add(roundaboutRing);

  const roundaboutDash = new THREE.Mesh(
    new THREE.RingGeometry(47.6, 48.4, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf2c14e })
  );
  roundaboutDash.position.set(0, 0.092, 0);
  scene.add(roundaboutDash);

  const islandMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(34, 34.4, 0.35, 40),
    new THREE.MeshStandardMaterial({ color: 0x5f9e59, roughness: 0.9 })
  );
  islandMesh.position.set(0, 0.175, 0);
  scene.add(islandMesh);

  // Central Obelisk Monument
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 6.8, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9e2ec, roughness: 0.7 })
  );
  pedestal.position.set(0, 1.4, 0);
  scene.add(pedestal);

  const obelisk = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 22, 4),
    new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.45, metalness: 0.15 })
  );
  obelisk.position.set(0, 13.5, 0);
  obelisk.rotation.y = Math.PI / 4;
  scene.add(obelisk);

  circleColliders.push({ x: 0, z: 0, radius: 34.2 });

  // 4. Downtown Stunt Plaza (flat concrete pad at block x in [-260..-130], z in [130..260])
  const plazaGeom = new THREE.PlaneGeometry(108, 108);
  plazaGeom.rotateX(-Math.PI / 2);
  const plazaMesh = new THREE.Mesh(
    plazaGeom,
    new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.9 })
  );
  plazaMesh.position.set(-195, 0.03, 195);
  scene.add(plazaMesh);

  // 5. Three Stunt Ramps
  const ramps: RampDef[] = [
    // Coastal Boardwalk Jump (launches +Z)
    { x: 520, z: -130, width: 10, length: 26, height: 5.2, yaw: 0 },
    // Downtown Stunt Plaza Ramp (launches -Z)
    { x: -195, z: 205, width: 12, length: 24, height: 4.8, yaw: Math.PI },
    // North Highway Mega Ramp (launches +X)
    { x: -40, z: -520, width: 10, length: 26, height: 5.2, yaw: Math.PI / 2 },
  ];

  const rampMat = new THREE.MeshStandardMaterial({
    map: createRampTexture(),
    roughness: 0.55,
  });
  for (const r of ramps) {
    scene.add(createRampMesh(r, rampMat));
  }

  // 6. Instanced City Blocks, Sidewalks & Buildings
  const xCenters = [-455, -325, -195, -65, 65, 195, 325, 455];
  const zCenters = [-455, -325, -195, -65, 65, 195, 325, 455];

  const buildingSpecs: Array<{ x: number; z: number; w: number; d: number; h: number; color: number }> = [];
  const sidewalkSpecs: Array<{ x: number; z: number; w: number; d: number }> = [];
  const treeSpecs: Array<{ x: number; z: number; scale: number; palm: boolean }> = [];

  const buildingPalette = [0xd8e2dc, 0x8ecae6, 0xe5989b, 0xb5c99a, 0xcbd5e1, 0xf4d58d];

  for (const bx of xCenters) {
    for (const bz of zCenters) {
      // Skip blocks overlapping the Central Roundabout
      if (Math.hypot(bx, bz) < 105) {
        continue;
      }

      // Skip Downtown Stunt Plaza block
      if (bx === -195 && bz === 195) {
        continue;
      }

      // Keep outer ring blocks more open/park-like on corners
      const isOuterCorner = Math.abs(bx) === 455 && Math.abs(bz) === 455;
      const blockSize = 92;

      sidewalkSpecs.push({ x: bx, z: bz, w: blockSize, d: blockSize });

      if (isOuterCorner) {
        // Park trees in outer corners
        for (let t = 0; t < 6; t++) {
          treeSpecs.push({
            x: bx + (rng() - 0.5) * 66,
            z: bz + (rng() - 0.5) * 66,
            scale: 0.9 + rng() * 0.6,
            palm: bx > 350,
          });
        }
        continue;
      }

      // Place 2x2 buildings per city block
      const subOffsets = [-21, 21];
      for (const ox of subOffsets) {
        for (const oz of subOffsets) {
          const cx = bx + ox;
          const cz = bz + oz;
          if (Math.hypot(cx, cz) < 82) continue;

          // Leave occasional pocket parks
          if (rng() < 0.14) {
            treeSpecs.push({
              x: cx,
              z: cz,
              scale: 1.0 + rng() * 0.4,
              palm: bx > 350,
            });
            continue;
          }

          const isDowntown = Math.abs(cx) < 220 && Math.abs(cz) < 220;
          const w = 24 + rng() * 11;
          const d = 24 + rng() * 11;
          const h = isDowntown ? 28 + rng() * 52 : 14 + rng() * 26;
          const color = buildingPalette[Math.floor(rng() * buildingPalette.length)];

          buildingSpecs.push({ x: cx, z: cz, w, d, h, color });
          colliders.push({
            minX: cx - w * 0.5,
            maxX: cx + w * 0.5,
            minZ: cz - d * 0.5,
            maxZ: cz + d * 0.5,
          });
        }
      }
    }
  }

  // Sidewalks InstancedMesh
  if (sidewalkSpecs.length > 0) {
    const swGeom = new THREE.BoxGeometry(1, 0.06, 1);
    const swMat = new THREE.MeshStandardMaterial({ color: 0xbcccdc, roughness: 0.92 });
    const swInst = new THREE.InstancedMesh(swGeom, swMat, sidewalkSpecs.length);
    const dummy = new THREE.Object3D();
    sidewalkSpecs.forEach((s, i) => {
      dummy.position.set(s.x, 0.03, s.z);
      dummy.scale.set(s.w, 1, s.d);
      dummy.updateMatrix();
      swInst.setMatrixAt(i, dummy.matrix);
    });
    swInst.instanceMatrix.needsUpdate = true;
    scene.add(swInst);
  }

  // Buildings InstancedMesh (NOTE: never set vertexColors: true with setColorAt)
  const bMat = new THREE.MeshStandardMaterial({
    map: createBuildingTexture(),
    emissive: new THREE.Color(0xffd89b),
    emissiveMap: createBuildingEmissiveTexture(),
    emissiveIntensity: 0.0,
    roughness: 0.72,
  });
  if (buildingSpecs.length > 0) {
    const bGeom = new THREE.BoxGeometry(1, 1, 1);
    const bInst = new THREE.InstancedMesh(bGeom, bMat, buildingSpecs.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    buildingSpecs.forEach((b, i) => {
      dummy.position.set(b.x, b.h * 0.5, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      bInst.setMatrixAt(i, dummy.matrix);
      color.setHex(b.color);
      bInst.setColorAt(i, color);
    });
    bInst.instanceMatrix.needsUpdate = true;
    if (bInst.instanceColor) bInst.instanceColor.needsUpdate = true;
    scene.add(bInst);
  }

  // 7. Coastal Palm Trees, Roundabout Island Trees & Outer Trees (InstancedMesh)
  for (let z = -520; z <= 520; z += 44) {
    if (Math.abs(z) < 28) continue; // Keep pier entrance open
    treeSpecs.push({ x: 562, z, scale: 1.15 + rng() * 0.35, palm: true });
  }
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    treeSpecs.push({
      x: Math.cos(ang) * 20,
      z: Math.sin(ang) * 20,
      scale: 1.0,
      palm: false,
    });
  }
  for (let i = 0; i < 60; i++) {
    const side = i % 3;
    let tx = 0;
    let tz = 0;
    if (side === 0) {
      tx = -585 - rng() * 60;
      tz = (rng() - 0.5) * 1200;
    } else if (side === 1) {
      tx = (rng() - 0.5) * 1100;
      tz = -585 - rng() * 60;
    } else {
      tx = (rng() - 0.5) * 1100;
      tz = 585 + rng() * 60;
    }
    treeSpecs.push({ x: tx, z: tz, scale: 1.1 + rng() * 0.7, palm: false });
  }

  if (treeSpecs.length > 0) {
    const trunkGeom = new THREE.CylinderGeometry(0.45, 0.7, 5.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7f5539, roughness: 0.9 });
    const trunkInst = new THREE.InstancedMesh(trunkGeom, trunkMat, treeSpecs.length);

    const crownGeom = new THREE.ConeGeometry(3.1, 6.4, 7);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const crownInst = new THREE.InstancedMesh(crownGeom, crownMat, treeSpecs.length);

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    treeSpecs.forEach((t, i) => {
      dummy.position.set(t.x, 2.6 * t.scale, t.z);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, (t.palm ? 5.8 : 6.4) * t.scale, t.z);
      dummy.scale.set(
        t.palm ? t.scale * 1.15 : t.scale,
        t.palm ? t.scale * 0.55 : t.scale,
        t.palm ? t.scale * 1.15 : t.scale
      );
      dummy.updateMatrix();
      crownInst.setMatrixAt(i, dummy.matrix);

      tint.setHex(t.palm ? 0x52b788 : rng() > 0.5 ? 0x40916c : 0x588157);
      crownInst.setColorAt(i, tint);
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
    scene.add(trunkInst);
    scene.add(crownInst);
  }

  // 8. Instanced Street Lamps along Boulevards, Loop Highway & Coastal Road
  const lampPositions: Array<{ x: number; z: number; rotY: number }> = [];
  for (let p = -440; p <= 440; p += 88) {
    if (Math.abs(p) > 75) {
      lampPositions.push({ x: p, z: 14, rotY: Math.PI });
      lampPositions.push({ x: 14, z: p, rotY: -Math.PI / 2 });
    }
    lampPositions.push({ x: 536, z: p, rotY: -Math.PI / 2 });
  }
  for (let p = -440; p <= 440; p += 110) {
    lampPositions.push({ x: p, z: -504, rotY: Math.PI });
    lampPositions.push({ x: p, z: 504, rotY: 0 });
    lampPositions.push({ x: -504, z: p, rotY: Math.PI / 2 });
  }

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.06,
  });

  if (lampPositions.length > 0) {
    const poleGeom = new THREE.CylinderGeometry(0.18, 0.24, 7.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.5 });
    const poleInst = new THREE.InstancedMesh(poleGeom, poleMat, lampPositions.length);

    const bulbGeom = new THREE.BoxGeometry(1.1, 0.25, 0.65);
    const bulbInst = new THREE.InstancedMesh(bulbGeom, bulbMat, lampPositions.length);

    const dummy = new THREE.Object3D();
    lampPositions.forEach((lp, i) => {
      dummy.position.set(lp.x, 3.75, lp.z);
      dummy.rotation.set(0, lp.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(i, dummy.matrix);

      const offsetX = Math.sin(lp.rotY) * 0.7;
      const offsetZ = Math.cos(lp.rotY) * 0.7;
      dummy.position.set(lp.x + offsetX, 7.5, lp.z + offsetZ);
      dummy.updateMatrix();
      bulbInst.setMatrixAt(i, dummy.matrix);
    });

    poleInst.instanceMatrix.needsUpdate = true;
    bulbInst.instanceMatrix.needsUpdate = true;
    scene.add(poleInst);
    scene.add(bulbInst);
  }

  // 9. Perimeter Guardrail Posts (InstancedMesh) marking playable bounds
  const guardPosts: Array<{ x: number; z: number; rotY: number }> = [];
  for (let p = -640; p <= 640; p += 40) {
    if (p <= 580) {
      guardPosts.push({ x: p, z: -662, rotY: 0 });
      guardPosts.push({ x: p, z: 662, rotY: 0 });
    }
    guardPosts.push({ x: -662, z: p, rotY: Math.PI / 2 });
  }
  if (guardPosts.length > 0) {
    const railGeom = new THREE.BoxGeometry(36, 0.9, 0.6);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
    const railInst = new THREE.InstancedMesh(railGeom, railMat, guardPosts.length);
    const dummy = new THREE.Object3D();
    guardPosts.forEach((gp, i) => {
      dummy.position.set(gp.x, 0.55, gp.z);
      dummy.rotation.set(0, gp.rotY, 0);
      dummy.updateMatrix();
      railInst.setMatrixAt(i, dummy.matrix);
    });
    railInst.instanceMatrix.needsUpdate = true;
    scene.add(railInst);
  }

  // Ground sampler including ramp surfaces
  const sampleGround = (x: number, z: number, currentY: number): GroundSample => {
    for (let i = 0; i < ramps.length; i++) {
      const r = ramps[i];
      const dx = x - r.x;
      const dz = z - r.z;
      const cos = Math.cos(r.yaw);
      const sin = Math.sin(r.yaw);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      const hw = r.width * 0.5;
      const hl = r.length * 0.5;

      if (Math.abs(lx) <= hw && Math.abs(lz) <= hl) {
        const t = (lz + hl) / r.length;
        const surfaceY = 0.06 + t * r.height;
        if (currentY >= surfaceY - 1.1) {
          const slope = r.height / r.length;
          return {
            height: surfaceY,
            slopeX: Math.sin(r.yaw) * slope,
            slopeZ: Math.cos(r.yaw) * slope,
            onRamp: true,
            rampIndex: i,
          };
        }
      }
    }

    return {
      height: 0.06,
      slopeX: 0,
      slopeZ: 0,
      onRamp: false,
      rampIndex: -1,
    };
  };

  return {
    colliders,
    circleColliders,
    ramps,
    bounds,
    spawn: { x: -165, z: 0, yaw: Math.PI / 2 },
    streetLampBulbMaterial: bulbMat,
    buildingMaterial: bMat,
    sampleGround,
  };
}
