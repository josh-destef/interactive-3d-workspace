import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyModelMaterial } from '../materialModel.js';

const SPREAD = 1.72;

/** Material Lab's lighting and comparison scenario in Creation Studio. */
export function createMaterialStudio(creator) {
  const { viewport } = creator;
  const { scene, renderer, camera, orbitCtrl, lights } = viewport.stage;
  const canvas = renderer.domElement;
  const priorEnvironment = scene.environment;
  const priorBackground = scene.background?.clone();
  const priorReset = viewport.resetView;
  const priorView = camera.view ? { ...camera.view } : null;
  const priorOutline = viewport.getSelectionOutline();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(renderer);
  const environment = pmrem.fromScene(room, .04);
  room.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  const key = lights.key;
  const priorKey = { position: key.position.clone(), color: key.color.clone(), intensity: key.intensity };
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xb9bec5, roughness: .95, metalness: 0, envMapIntensity: .16 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const orb = new THREE.Group();
  orb.name = 'Scene light';
  const orbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(.23, 24, 16), orbMaterial));
  orb.visible = false;
  scene.add(orb);
  let reference = null;
  let matching = false;
  let angle = 35;
  let disposed = false;
  let comparisonPose = null;
  let roomLights = true;
  const learner = () => viewport.getObject('gizmobot');
  const model = () => learner()?.children.find(child => !child.userData.creatorEntityId);
  const labelRoot = canvas.parentElement;
  const labels = ['reference', 'learner'].map((name, index) => {
    const label = document.createElement('span');
    label.className = 'material-model-label';
    label.dataset.model = name;
    label.textContent = index === 0 ? 'Reference' : 'Your material';
    label.hidden = true;
    Object.assign(label.style, { position: 'absolute', transform: 'translate(-50%, -100%)', pointerEvents: 'none' });
    labelRoot.append(label);
    return label;
  });
  function updateLabels() {
    if (disposed) return;
    const canvasRect = canvas.getBoundingClientRect();
    const wrapperRect = labelRoot.getBoundingClientRect();
    camera.updateMatrixWorld();
    [reference, model()].forEach((object, index) => {
      const label = labels[index];
      if (!matching || !object) { label.hidden = true; return; }
      object.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(object);
      const position = box.getCenter(new THREE.Vector3());
      position.y = box.max.y + .18;
      position.project(camera);
      label.hidden = position.z < -1 || position.z > 1 || Math.abs(position.x) > 1 || Math.abs(position.y) > 1;
      label.style.left = `${canvasRect.left - wrapperRect.left + (position.x + 1) * canvasRect.width / 2}px`;
      label.style.top = `${canvasRect.top - wrapperRect.top + (1 - position.y) * canvasRect.height / 2}px`;
    });
  }
  function updateFraming() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (window.innerWidth <= 900) {
      camera.clearViewOffset();
    } else {
      // Keep the model out of the fixed lower-left instruction home. Projection
      // offsets move the composition without changing project transforms or orbit.
      const card = document.querySelector('.lesson-guidance-card')?.getBoundingClientRect();
      const overlap = card ? Math.max(0, rect.top + rect.height - card.top) : 280;
      const shiftRight = matching ? 0 : orb.visible ? Math.min(80, rect.width * .08) : Math.min(110, rect.width * .105);
      const shiftUp = matching ? Math.min(120, overlap * .4) : orb.visible ? Math.min(16, rect.height * .025) : Math.min(70, rect.height * .095);
      camera.setViewOffset(rect.width, rect.height, -shiftRight, shiftUp, rect.width, rect.height);
    }
    updateLabels();
  }
  orbitCtrl.addEventListener('change', updateLabels);
  let framedWidth = 0, framedHeight = 0;
  const labelResize = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    const viewportChanged = rect.width !== framedWidth || rect.height !== framedHeight;
    framedWidth = rect.width; framedHeight = rect.height;
    if (orb.visible && viewportChanged) resetView();
    else updateFraming();
  });
  labelResize.observe(labelRoot);
  const instructionCard = document.querySelector('.lesson-guidance-card');
  if (instructionCard) labelResize.observe(instructionCard);
  const unsubscribeLabels = creator.project.subscribe(updateLabels);

  function setLightAngle(degrees) {
    angle = Number(degrees);
    const azimuth = THREE.MathUtils.degToRad(angle);
    key.position.set(Math.sin(azimuth) * 3.4, 3.05, Math.cos(azimuth) * 3.4);
    orb.position.copy(key.position);
  }
  function setRoomLights(on) {
    roomLights = Boolean(on);
    viewport.setSelectionOutline(roomLights && !matching);
    // Removing the environment is essential: dark means no reflected room light.
    scene.environment = on ? environment.texture : null;
    key.intensity = on ? 85 : 0;
    scene.background = new THREE.Color(on ? 0xd6d9de : 0x14141d);
    floorMaterial.color.set(on ? 0xb9bec5 : 0x1c1c26);
  }
  function setLightVisible(on) {
    const changed = orb.visible !== Boolean(on);
    orb.visible = Boolean(on);
    if (changed) resetView();
  }

  function resetView() {
    // Fit the complete light orbit, including the forgiving hit sphere. Narrow
    // viewports need more distance because their horizontal field of view is small.
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const horizontalHalfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
    const lightDistance = Math.max(10, 3.8 / Math.tan(horizontalHalfFov) * 1.25);
    viewport.stage.flyTo({
      pos: new THREE.Vector3(...(matching ? [0, 3, 10.2] : orb.visible ? [0, 4.6, lightDistance] : [2.5, 2.6, 6.1])),
      look: new THREE.Vector3(0, 1.35, 0),
    });
    updateFraming();
  }
  function showReference(material) {
    if (!reference) {
      reference = viewport.cloneModel(material);
      if (!reference) throw new Error('Wait for Gizmobot before starting a comparison');
      reference.name = 'Reference Gizmobot';
      scene.add(reference);
    }
    applyModelMaterial(reference, { ...material, emissiveIntensity: 0 });
    reference.position.set(-SPREAD, 0, 0);
    reference.rotation.set(0, 0, 0);
    reference.visible = true;
    const student = model();
    if (student && !comparisonPose) comparisonPose = { position: student.position.clone(), quaternion: student.quaternion.clone(), scale: student.scale.clone() };
    if (student) { student.position.x = SPREAD; student.rotation.set(0, 0, 0); }
    viewport.refreshSelection();
    matching = true;
    setLightAngle(0);
    setRoomLights(true);
    setLightVisible(false);
    resetView();
  }
  function hideReference() {
    if (reference) reference.visible = false;
    restoreComparisonPose();
    viewport.refreshSelection();
    matching = false;
    viewport.setSelectionOutline(roomLights);
    resetView();
  }
  function restoreComparisonPose() {
    const student = model();
    if (student && comparisonPose) {
      student.position.copy(comparisonPose.position);
      student.quaternion.copy(comparisonPose.quaternion);
      student.scale.copy(comparisonPose.scale);
    }
    comparisonPose = null;
  }
  async function capture({ download = true } = {}) {
    if (disposed) throw new Error('The studio is closed');
    const outline = scene.getObjectByName('CreatorSelectionOutline');
    const outlineVisible = outline?.visible;
    const orbVisible = orb.visible;
    try {
      if (outline) outline.visible = false;
      orb.visible = false;
      renderer.render(scene, camera);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Photo could not be captured')), 'image/png'));
      if (download) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'my-gizmobot.png';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return blob;
    } finally {
      if (outline) outline.visible = outlineVisible;
      orb.visible = orbVisible;
    }
  }
  function disposeTree(root) {
    root?.traverse(node => {
      node.geometry?.dispose();
      if (node.material) for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
    });
    root?.removeFromParent();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    orbitCtrl.removeEventListener('change', updateLabels);
    labelResize.disconnect();
    unsubscribeLabels();
    labels.forEach(label => label.remove());
    restoreComparisonPose();
    viewport.refreshSelection();
    viewport.setSelectionOutline(priorOutline);
    disposeTree(reference); disposeTree(orb); disposeTree(floor);
    scene.environment = priorEnvironment;
    scene.background = priorBackground;
    key.position.copy(priorKey.position);
    key.color.copy(priorKey.color);
    key.intensity = priorKey.intensity;
    environment.dispose();
    if (priorView?.enabled) camera.setViewOffset(priorView.fullWidth, priorView.fullHeight, priorView.offsetX, priorView.offsetY, priorView.width, priorView.height);
    else camera.clearViewOffset();
    viewport.resetView = priorReset;
  }
  viewport.resetView = resetView;
  key.color.set(0xffffff);
  setLightAngle(angle);
  setRoomLights(true);
  resetView();
  return { setLightAngle, getLightAngle: () => angle, setRoomLights, setLightVisible, showReference, hideReference, resetView, capture, dispose };
}
