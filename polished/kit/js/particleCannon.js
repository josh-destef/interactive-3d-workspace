import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const particleCannonURL = new URL('../../../assets/models/particle-cannon.glb', import.meta.url);
export const accessoryRigURL = new URL('../../../assets/models/gizmobot-accessory-rig.glb', import.meta.url);

/** Load independent instances; the cannon has one canonical GLB for all labs. */
export async function loadParticleCannon(loader = new GLTFLoader()) {
  return (await loader.loadAsync(particleCannonURL.href)).scene;
}

/**
 * Swap rigid surfaces while keeping the original shoulder/upper arm/elbow.
 * Use gizmobot-accessory-rig.glb, which retains source geometry losslessly.
 * Rotation of the existing Forearm pivot continues to control the attachment.
 */
export function attachParticleCannon(robot, cannonScene, side = 'Left') {
  if (!['Left', 'Right'].includes(side)) throw new Error('Side must be Left or Right.');
  const elbow = robot.getObjectByName(`${side}Forearm`);
  const shell = robot.getObjectByName(`${side}ForearmSurface`);
  const ball = robot.getObjectByName(`${side}ElbowJointSurface`);
  const hand = robot.getObjectByName(`${side}Hand`);
  if (!elbow || !shell || !ball || !hand || ball.parent?.parent !== elbow) {
    throw new Error('Load gizmobot-accessory-rig.glb; the unsplit forearm contains the original elbow ball.');
  }
  if (elbow.userData.particleCannon) throw new Error(`${side} elbow already has a cannon.`);
  const cannon = cannonScene.getObjectByName('ParticleCannon');
  const emission = cannon?.getObjectByName('MuzzleEmission');
  if (!cannon || !emission) throw new Error('Cannon must contain ParticleCannon and MuzzleEmission.');
  const mount = new THREE.Group();
  mount.name = `${side}ParticleCannonMount`;
  // A half-turn around up preserves the chamber's top orientation on the right.
  mount.rotation.y = side === 'Right' ? Math.PI : 0;
  mount.add(cannon.clone(true));
  const emitter = mount.getObjectByName('MuzzleEmission');
  const visibility = [shell.visible, hand.visible];
  shell.visible = false;
  hand.visible = false;
  elbow.add(mount);
  elbow.userData.particleCannon = true;
  let attached = true;
  return {
    mount, elbow, emitter,
    /** glTF firing axis is +X; use the world matrix, including robot scale. */
    emissionWorld(position = new THREE.Vector3(), direction = new THREE.Vector3()) {
      emitter.updateWorldMatrix(true, false);
      position.setFromMatrixPosition(emitter.matrixWorld);
      direction.set(1, 0, 0).transformDirection(emitter.matrixWorld);
      return { position, direction };
    },
    detach() {
      if (!attached) return;
      shell.visible = visibility[0];
      hand.visible = visibility[1];
      mount.removeFromParent();
      delete elbow.userData.particleCannon;
      attached = false;
      // Geometry/materials are shared with cannonScene and remain reusable.
    },
  };
}
