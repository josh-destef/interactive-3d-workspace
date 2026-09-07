import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPoser } from '../../robot-assembly/js/posing.js';

const MANIFEST_URL = new URL('../../robot-assembly/assets/assembly-manifest.json', import.meta.url);
const MODEL_URL = new URL('../../robot-assembly/assets/gizmobot-assembly.glb', import.meta.url);
const ARM_LIMITS = [-85, 75];
const WRIST_LIMITS = [-45, 45];

// Gizmobot is modelled in a T-pose: each arm runs along local +X, and the hand is a flat
// paddle whose palm faces local -Y. Rotating the shoulder about Z swings the arm in the
// screen plane, which keeps the palm edge-on to the camera. So as the arm comes up we roll
// the hand a quarter turn to bring the palm round to face the viewer, and drive the wave
// from the hand's local Y instead. Three.js applies an 'XYZ' Euler as RX·RY·RZ, so the roll
// (x) is the outer rotation and the sweep (y) then rocks the hand across the screen while
// the palm keeps pointing at us.
const PALM_ROLL = 90;
// A raised arm is a shoulder AND an elbow. Bending the elbow by ELBOW_LIFT while opening the
// shoulder by the same amount less keeps the hand aimed exactly where the learner pointed it,
// but turns one straight diagonal into a recognisable wave. FORWARD_SWING then tips the whole
// raised arm towards the viewer so it reads in depth instead of flat against the body.
const ELBOW_LIFT = 32;
const FORWARD_SWING = 15;
const RAISE_SPAN = [-10, 60];
// Looking very slightly down, rather than dead level, is what stops the viewport reading as a
// flat sticker: the floor recedes and the grid converges. Matches the navigate-and-transform lab.
const ELEVATION = 12;
const REST = { arm: -75, wrist: 0 };

const clamp = (value, [min, max]) => THREE.MathUtils.clamp(Number(value), min, max);

export async function createScene({ canvas, viewport, onSelect = () => {} }) {
  if (!canvas || !viewport) throw new TypeError('createScene requires a canvas and viewport.');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const parts = new Map();
  const ownedMaterials = new Set();
  const originalLooks = new Map();
  let robot;
  let poser;
  let selected = null;
  let resizeObserver;
  let disposed = false;
  // Bounds covering every pose the lesson can reach, so the camera frames the whole
  // performance once instead of re-fitting (and visibly breathing) on each pose change.
  let framing = null;
  let bodyCentreX = 0;
  const current = { ...REST };

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  scene.environment = environment;
  room.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xfffdf5, 0xb8c1ad, 2.15));
  const key = new THREE.DirectionalLight(0xfff1d8, 3.2);
  key.position.set(-4, 6.5, -2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3.5;
  key.shadow.camera.right = 3.5;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -1;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 16;
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcce6ff, 1.65);
  rim.position.set(4, 3.5, 4);
  scene.add(rim);

  const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.26 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(60, 60, 0x2b3a33, 0x2b3a33);
  grid.material.transparent = true;
  grid.material.opacity = 0.09;
  grid.material.depthWrite = false;
  scene.add(grid);

  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffa33b, transparent: true, opacity: 0.95, depthTest: false });
  const selectionRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 12, 64), ringMaterial);
  selectionRing.renderOrder = 20;
  selectionRing.visible = false;
  scene.add(selectionRing);

  function render() {
    if (!disposed) renderer.render(scene, camera);
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, viewport.clientWidth);
    const height = Math.max(1, viewport.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fitView();
    render();
  }

  function fitView() {
    if (!framing) return;
    // Keep Gizmobot horizontally centred on its own body. Framing the raw union of poses
    // would slide the whole robot sideways to balance the raised arm's reach.
    const center = framing.getCenter(new THREE.Vector3());
    center.x = bodyCentreX;
    const size = new THREE.Vector3(
      2 * Math.max(framing.max.x - center.x, center.x - framing.min.x),
      framing.max.y - framing.min.y,
      framing.max.z - framing.min.z,
    );
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const distanceY = size.y / (2 * Math.tan(verticalFov / 2));
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const distanceX = size.x / (2 * Math.tan(horizontalFov / 2));
    const distance = Math.max(distanceX, distanceY) * 1.12 + size.z * 0.5;
    const tilt = THREE.MathUtils.degToRad(ELEVATION);
    camera.position.set(
      center.x,
      center.y + distance * Math.sin(tilt),
      center.z - distance * Math.cos(tilt),
    );
    camera.lookAt(center.x, center.y, center.z);
    camera.updateMatrixWorld();
  }

  function updateSelectionLook() {
    for (const [mesh, look] of originalLooks) {
      const active = selected === 'arm'
        ? (mesh.userData.animationJoint === 'arm' || mesh.userData.animationJoint === 'wrist')
        : selected === 'wrist' && mesh.userData.animationJoint === 'wrist';
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material, index) => {
        const base = look[index];
        if (material.color && base.color) material.color.copy(base.color).lerp(new THREE.Color(0xffb45c), active ? 0.18 : 0);
        if (material.emissive && base.emissive) {
          material.emissive.copy(base.emissive);
          if (active) material.emissive.lerp(new THREE.Color(0xff7a18), 0.22);
        }
        material.needsUpdate = true;
      });
    }
  }

  function updateRing() {
    if (!selected || !robot) {
      selectionRing.visible = false;
      return;
    }
    // Ring the middle of the limb rather than its pivot: the shoulder pivot sits inside the
    // torso and the wrist pivot sits at the very base of the hand, so neither reads as
    // "this is the part you are moving".
    const joint = parts.get(selected === 'arm' ? 'LeftUpperArm' : 'LeftHand')?.object;
    if (!joint) return;
    joint.updateWorldMatrix(true, false);
    selectionRing.position.set(selected === 'arm' ? 0.19 : 0.34, 0, 0).applyMatrix4(joint.matrixWorld);
    selectionRing.quaternion.copy(camera.quaternion);
    selectionRing.visible = true;
  }

  function selectJoint(joint) {
    if (joint !== 'arm' && joint !== 'wrist' && joint !== null) throw new TypeError("Joint must be 'arm', 'wrist', or null.");
    selected = joint;
    updateSelectionLook();
    updateRing();
    render();
  }

  // Applies the lesson's two abstract values to the real rig. The hand is composed directly
  // afterwards, because poser.set() rewrites every joint from its own stored values and would
  // undo a roll written before it.
  function applyPose() {
    const raised = THREE.MathUtils.smoothstep(current.arm, RAISE_SPAN[0], RAISE_SPAN[1]);
    const bend = ELBOW_LIFT * raised;
    poser.set('LeftUpperArm', 'z', current.arm - bend);
    poser.set('LeftUpperArm', 'x', -FORWARD_SWING * raised);
    poser.set('LeftForearm', 'z', bend);
    parts.get('LeftHand').object.rotation.set(
      THREE.MathUtils.degToRad(PALM_ROLL * raised),
      THREE.MathUtils.degToRad(current.wrist),
      0,
    );
  }

  function setPose({ arm, wrist } = {}) {
    if (arm !== undefined) current.arm = clamp(arm, ARM_LIMITS);
    if (wrist !== undefined) current.wrist = clamp(wrist, WRIST_LIMITS);
    applyPose();
    updateRing();
  }

  function resetView() {
    fitView();
    render();
  }

  function getJointPositions() {
    if (!robot) return null;
    robot.updateWorldMatrix(true, true);
    return {
      arm: parts.get('LeftUpperArm').object.getWorldPosition(new THREE.Vector3()),
      wrist: parts.get('LeftHand').object.getWorldPosition(new THREE.Vector3()),
    };
  }

  function pick(event) {
    if (disposed || event.button !== 0 || !robot) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(robot, true)[0];
    const joint = hit?.object?.userData.animationJoint || null;
    if (joint) {
      selectJoint(joint);
      onSelect(joint);
    }
  }

  canvas.addEventListener('pointerdown', pick);

  function dispose() {
    if (disposed) return;
    disposed = true;
    resizeObserver?.disconnect();
    canvas.removeEventListener('pointerdown', pick);
    scene.traverse(object => object.geometry?.dispose?.());
    for (const material of ownedMaterials) material.dispose();
    floorMaterial.dispose();
    grid.material.dispose();
    ringMaterial.dispose();
    environment.dispose();
    renderer.dispose();
  }

  try {
    const [manifest, gltf] = await Promise.all([
      fetch(MANIFEST_URL).then(response => {
        if (!response.ok) throw new Error(`Gizmobot manifest failed to load (${response.status}).`);
        return response.json();
      }),
      new GLTFLoader().loadAsync(MODEL_URL.href),
    ]);

    robot = gltf.scene.getObjectByName(manifest.parent);
    if (!robot) throw new Error(`Gizmobot root '${manifest.parent}' is missing from the model.`);
    robot.position.set(0, 0, 0);
    robot.rotation.set(0, 0, 0);
    robot.scale.setScalar(1);
    scene.add(robot);

    for (const definition of manifest.parts) {
      const object = robot.getObjectByName(definition.node);
      if (!object) throw new Error(`Gizmobot part '${definition.node}' is missing from the model.`);
      parts.set(definition.node, { object, definition });
    }

    poser = createPoser(robot, manifest, parts);
    poser.enable();
    // Mirrors REST.arm so the idle stance is symmetric.
    poser.set('RightUpperArm', 'z', -REST.arm);
    applyPose();

    const armRoot = parts.get('LeftUpperArm').object;
    const handRoot = parts.get('LeftHand').object;
    armRoot.traverse(object => { if (object.isMesh) object.userData.animationJoint = 'arm'; });
    handRoot.traverse(object => { if (object.isMesh) object.userData.animationJoint = 'wrist'; });

    robot.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      const source = Array.isArray(object.material) ? object.material : [object.material];
      const copies = source.map(material => {
        ownedMaterials.add(material);
        const copy = material.clone();
        ownedMaterials.add(copy);
        return copy;
      });
      object.material = Array.isArray(object.material) ? copies : copies[0];
      originalLooks.set(object, copies.map(material => ({ color: material.color?.clone(), emissive: material.emissive?.clone() })));
    });

    // Frame the union of the extreme poses so the raised hand always has room and the camera
    // never moves once the lesson starts.
    framing = new THREE.Box3();
    for (const pose of [REST, { arm: ARM_LIMITS[0], wrist: 0 }, { arm: ARM_LIMITS[1], wrist: WRIST_LIMITS[0] }, { arm: ARM_LIMITS[1], wrist: WRIST_LIMITS[1] }]) {
      Object.assign(current, pose);
      applyPose();
      robot.updateWorldMatrix(true, true);
      framing.union(new THREE.Box3().setFromObject(robot));
    }
    Object.assign(current, REST);
    applyPose();
    robot.updateWorldMatrix(true, true);
    // Arms down is the symmetric pose, so its centre is the one to keep the camera on.
    bodyCentreX = new THREE.Box3().setFromObject(robot).getCenter(new THREE.Vector3()).x;

    floor.position.y = framing.min.y - 0.015;
    grid.position.y = floor.position.y + 0.002;
    resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(viewport);
    resize();
  } catch (error) {
    dispose();
    throw error;
  }

  return { setPose, selectJoint, resetView, render, dispose, getJointPositions };
}
