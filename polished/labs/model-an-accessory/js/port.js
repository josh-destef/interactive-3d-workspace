import * as THREE from 'three';

/* ═══════════════════════════════════════════════
   PORT
   Gizmobot's back socket and the module's mating plug, built to the same
   radius and rim geometry so any plug snaps onto the port regardless of
   which accent color the student picked for their module.
   Both halves are built along local +Z with the mating face at z = 0, so
   the caller can place and turn either one with nothing but a position
   and a look-direction - no compensating rotation to get wrong.
═══════════════════════════════════════════════ */

const OUTER_RADIUS = 0.17;
const INNER_RADIUS = 0.105;
const RING_TUBE = 0.016;
const CHARCOAL = 0x25303c;
const DEFAULT_ACCENT = 0xff9022;

// A CylinderGeometry is built along Y; rotating it +X by 90 degrees lays
// its axis on Z, and translating by half its depth puts the mating face
// at z = 0 with the body trailing into -Z, exactly as the caller expects.
function layFlatOnZ(geometry, depth) {
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function chargedMaterial(extra) {
  return new THREE.MeshStandardMaterial({ color: CHARCOAL, roughness: 0.45, metalness: 0.15, ...extra });
}

function addPips(group, material, z) {
  const pipRadius = (INNER_RADIUS + OUTER_RADIUS) / 2;
  const pipGeo = new THREE.SphereGeometry(0.012, 8, 8);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const pip = new THREE.Mesh(pipGeo, material);
    pip.name = `Port_Pip_${i}`;
    pip.position.set(Math.cos(angle) * pipRadius, Math.sin(angle) * pipRadius, z);
    pip.castShadow = true;
    pip.receiveShadow = true;
    group.add(pip);
  }
}

export function createBackPort() {
  const group = new THREE.Group();
  group.name = 'BackPort';
  group.userData.isPort = true;

  const depth = 0.07;
  const bodyMat = chargedMaterial();
  const body = new THREE.Mesh(layFlatOnZ(new THREE.CylinderGeometry(OUTER_RADIUS, OUTER_RADIUS, depth, 32), depth), bodyMat);
  body.name = 'Port_Body';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const ringMat = new THREE.MeshStandardMaterial({ color: DEFAULT_ACCENT, roughness: 0.35, metalness: 0.15 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(OUTER_RADIUS - RING_TUBE, RING_TUBE, 12, 32), ringMat);
  ring.name = 'Port_Ring';
  ring.position.z = 0;
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  // The recess reads by sitting behind the rim, not by being darker alone -
  // a flat disc at z = 0 would look pasted on rather than sunk in.
  const innerMat = chargedMaterial({ color: 0x1a222b });
  const inner = new THREE.Mesh(new THREE.CircleGeometry(INNER_RADIUS, 24), innerMat);
  inner.name = 'Port_Inner';
  inner.position.z = -0.02;
  inner.castShadow = true;
  inner.receiveShadow = true;
  group.add(inner);

  addPips(group, bodyMat, -0.01);

  group.setActive = on => {
    ringMat.emissive.setHex(DEFAULT_ACCENT);
    ringMat.emissiveIntensity = on ? 0.9 : 0;
  };

  return group;
}

export function createMountPlug(color = DEFAULT_ACCENT) {
  const group = new THREE.Group();
  group.name = 'MountPlug';
  group.userData.isPlug = true;

  const depth = 0.06;
  const bodyMat = chargedMaterial();
  const body = new THREE.Mesh(layFlatOnZ(new THREE.CylinderGeometry(OUTER_RADIUS, OUTER_RADIUS, depth, 32), depth), bodyMat);
  body.name = 'Plug_Body';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const ringMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(OUTER_RADIUS - RING_TUBE, RING_TUBE, 12, 32), ringMat);
  ring.name = 'Plug_Ring';
  ring.position.z = 0;
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  // Proud by the same 0.02 the port is sunk by, so the two faces close
  // flush against each other when the module snaps home.
  const bossMat = chargedMaterial();
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(INNER_RADIUS, INNER_RADIUS, 0.02, 24), bossMat);
  boss.name = 'Plug_Boss';
  boss.rotation.x = Math.PI / 2;
  boss.position.z = 0.01;
  boss.castShadow = true;
  boss.receiveShadow = true;
  group.add(boss);

  group.setActive = on => {
    ringMat.emissive.setHex(color);
    ringMat.emissiveIntensity = on ? 0.9 : 0;
  };

  return group;
}
