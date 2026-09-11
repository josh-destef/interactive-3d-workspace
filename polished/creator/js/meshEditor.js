import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { primitiveToMesh, triangulateMesh, extrudeFace, insetFace, moveVertex, subdivideMesh, validateMesh } from './mesh.js';

const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
const editable = entity => Boolean(entity && !entity.locked && entity.type !== 'group' && entity.type !== 'gizmobot' && (entity.components?.mesh || entity.components?.geometry));
const centroid = (mesh, face) => face.reduce((sum, index) => sum.map((value, axis) => value + mesh.vertices[index][axis]), [0, 0, 0]).map(value => value / face.length);

function field(label, axis) {
  const wrap = document.createElement('label'); wrap.className = `mesh-field mesh-axis-${axis.toLowerCase()}`;
  const caption = document.createElement('span'); caption.textContent = `${label} ${axis}`;
  const input = document.createElement('input'); input.type = 'number'; input.step = '.05'; input.setAttribute('aria-label', `${label} ${axis}`);
  wrap.append(caption, input); return { wrap, input };
}

/** Contextual mesh-edit controls and selectable vertex/face feedback. */
export function createMeshEditor({ project, tools, viewport, root, onStatus = () => {} } = {}) {
  if (!project || !tools || !viewport || !root) throw new Error('createMeshEditor requires project, tools, viewport and root');
  const stage = viewport.stage, canvas = stage?.renderer?.domElement || document.getElementById('cv');
  if (!stage || !canvas) throw new Error('Mesh editing needs an active viewport');
  let entityId = null, selectedFace = null, selectedVertex = null, selectionKind = 'face', enabled = true, disposed = false;
  const interceptedPointers = new Set();
  let overlay = null, overlayObject = null;
  const moveAnchor = new THREE.Object3D(); moveAnchor.name = 'CreatorMeshMoveAnchor';
  const moveControl = new TransformControls(stage.camera, canvas);
  moveControl.setMode('translate'); moveControl.space = 'world'; moveControl.size = .72;
  stage.scene.add(moveControl); stage.scene.add(moveAnchor);
  let meshDrag = null;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();

  root.classList.add('mesh-editor');
  root.innerHTML = `<div class="mesh-editor-empty"><strong>Edit mesh</strong><p>Select a shape, then choose Edit mesh to work with its vertices and faces.</p></div>`;
  const getEntity = () => entityId && project.get(entityId);
  const getMesh = () => getEntity()?.components?.mesh || null;
  const inEdit = () => tools.getEditingMode?.() === 'edit' && Boolean(entityId);

  function discardOverlay() {
    overlay?.removeFromParent();
    overlay?.traverse(item => { item.geometry?.dispose?.(); item.material?.dispose?.(); });
    overlay = null; overlayObject = null;
  }
  function selectedPosition(mesh = getMesh()) {
    if (!mesh) return null;
    if (selectionKind === 'vertex' && selectedVertex !== null) return mesh.vertices[selectedVertex];
    if (selectionKind === 'face' && selectedFace !== null) return centroid(mesh, mesh.faces[selectedFace]);
    return null;
  }
  function syncMoveHandle() {
    if (meshDrag || !inEdit()) { moveControl.detach(); return; }
    const object = viewport.getObject(entityId), position = selectedPosition();
    if (!object || !position) { moveControl.detach(); return; }
    object.updateWorldMatrix(true, false); moveAnchor.position.copy(new THREE.Vector3(...position).applyMatrix4(object.matrixWorld));
    moveControl.camera = stage.camera; moveControl.attach(moveAnchor); moveControl.enabled = true;
  }
  function makeOverlay() {
    discardOverlay();
    const mesh = getMesh(), object = viewport.getObject(entityId);
    if (!mesh || !object) return;
    overlay = new THREE.Group(); overlay.name = 'CreatorMeshEditOverlay'; overlay.renderOrder = 10;
    const positions = new Float32Array(mesh.vertices.flat());
    const dots = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)), new THREE.PointsMaterial({ color: 0xff8b22, size: .085, sizeAttenuation: true, depthTest: false }));
    dots.name = 'MeshVertices'; dots.renderOrder = 11; overlay.add(dots);
    const edges = [];
    mesh.faces.forEach(face => face.forEach((index, i) => edges.push(...mesh.vertices[index], ...mesh.vertices[face[(i + 1) % face.length]])));
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(edges), 3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75, depthTest: false }));
    lines.name = 'MeshEdges'; lines.renderOrder = 10; overlay.add(lines);
    object.add(overlay); overlayObject = object;
  }
  function showFace() {
    if (!overlay) return;
    const old = overlay.getObjectByName('MeshFaceSelection'); if (old) { overlay.remove(old); old.geometry.dispose(); old.material.dispose(); }
    const oldPoint = overlay.getObjectByName('MeshVertexSelection'); if (oldPoint) { overlay.remove(oldPoint); oldPoint.geometry.dispose(); oldPoint.material.dispose(); }
    const mesh = getMesh(); if (!mesh) return;
    if (selectedVertex !== null && mesh.vertices[selectedVertex]) {
      const point = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.vertices[selectedVertex]), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: .13, sizeAttenuation: true, depthTest: false }));
      point.name = 'MeshVertexSelection'; point.renderOrder = 13; overlay.add(point);
    }
    if (selectedFace === null || !mesh.faces[selectedFace]) return;
    const face = mesh.faces[selectedFace], tri = triangulateMesh({ vertices: mesh.vertices, faces: [face] });
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.vertices.flat()), 3)); geometry.setIndex(tri.indices);
    const faceView = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: .38, side: THREE.DoubleSide, depthTest: false }));
    faceView.name = 'MeshFaceSelection'; faceView.renderOrder = 12; overlay.add(faceView);
    const selectedVertices = face;
    const points = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(selectedVertices.flatMap(index => mesh.vertices[index])), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: .13, sizeAttenuation: true, depthTest: false }));
    points.name = 'MeshVertexSelection'; points.renderOrder = 13; overlay.add(points);
  }
  function render({ force = false } = {}) {
    moveControl.camera = stage.camera;
    if (!force && root.contains(document.activeElement) && document.activeElement?.matches('input, select')) return;
    const entity = getEntity(), mesh = getMesh();
    if (!inEdit() || !entity || !mesh) { root.innerHTML = `<div class="mesh-editor-empty"><strong>Edit mesh</strong><p>Select a shape, then choose Edit mesh to work with its vertices and faces.</p></div>`; discardOverlay(); moveControl.detach(); return; }
    if (selectedFace !== null && !mesh.faces[selectedFace]) selectedFace = null;
    if (selectedVertex !== null && !mesh.vertices[selectedVertex]) selectedVertex = null;
    if (!overlay || overlayObject !== viewport.getObject(entityId)) makeOverlay();
    showFace();
    const index = selectionKind === 'vertex' ? selectedVertex : selectedFace;
    const count = selectionKind === 'vertex' ? mesh.vertices.length : mesh.faces.length;
    const selected = index !== null ? `${selectionKind[0].toUpperCase() + selectionKind.slice(1)} ${index + 1}` : `Choose a ${selectionKind}`;
    const choices = `<option value="" ${index === null ? 'selected' : ''}>Choose…</option>${Array.from({ length: count }, (_, i) => `<option value="${i}">${selectionKind[0].toUpperCase() + selectionKind.slice(1)} ${i + 1}</option>`).join('')}`;
    root.innerHTML = `<div class="mesh-editor-head"><span class="mesh-kicker">EDIT MODE</span><strong class="mesh-entity-name"></strong></div><p class="mesh-editor-intro"><b>Choose a face or vertex, then pick it in the viewport.</b> This editable version uses a clear low-poly mesh.</p><div class="mesh-stats"><span>${mesh.vertices.length} vertices</span><span>${mesh.faces.length} faces</span></div><section class="mesh-selection"><h3>${selected}</h3><div class="mesh-selector"><label>Element <select class="mesh-selection-kind"><option value="face">Faces</option><option value="vertex">Vertices</option></select></label><label>Selected <select class="mesh-selection-index">${choices}</select></label></div><div class="mesh-coordinates"></div><p class="mesh-selection-hint">${selectionKind === 'vertex' ? 'Drag a move handle or enter a coordinate.' : 'Drag a move handle or enter a coordinate to move this face.'}</p></section><section class="mesh-actions"><h3>Face actions</h3><label class="mesh-action-field">Extrude distance <input class="mesh-extrude-distance" type="number" value=".25" min="-100" max="100" step=".05"></label><div><button type="button" class="mesh-extrude" ${selectedFace === null ? 'disabled' : ''}>Extrude face</button><button type="button" class="mesh-inset" ${selectedFace === null ? 'disabled' : ''}>Inset face</button></div><button type="button" class="mesh-subdivide">Subdivide mesh</button><p>Extrude adds depth. Inset creates a smaller face. Subdivide adds detail across the whole mesh.</p></section>`;
    root.querySelector('.mesh-entity-name').textContent = entity.name;
    const kindControl = root.querySelector('.mesh-selection-kind'), indexControl = root.querySelector('.mesh-selection-index');
    kindControl.value = selectionKind; indexControl.value = index === null ? '' : String(index);
    kindControl.onchange = () => { selectionKind = kindControl.value; selectedFace = selectedVertex = null; render({ force: true }); };
    indexControl.onchange = () => { const value = indexControl.value; if (selectionKind === 'face') { selectedFace = value === '' ? null : Number(value); selectedVertex = null; } else { selectedVertex = value === '' ? null : Number(value); selectedFace = null; } render({ force: true }); };
    const target = selectionKind === 'vertex' && selectedVertex !== null ? mesh.vertices[selectedVertex] : selectionKind === 'face' && selectedFace !== null ? centroid(mesh, mesh.faces[selectedFace]) : null;
    if (target) {
      const host = root.querySelector('.mesh-coordinates'); const fields = ['X','Y','Z'].map((axis, i) => ({ ...field('Position', axis), i }));
      fields.forEach(({ wrap, input, i }) => { input.value = target[i].toFixed(3); input.onchange = () => { const value = number(input.value); if (value === null) { onStatus('Enter a finite coordinate'); return; } const point = [...target]; point[i] = value; try { applyPosition(point); } catch (error) { onStatus(error.message); } }; host.append(wrap); });
    }
    root.querySelector('.mesh-extrude').onclick = () => { try { const d = number(root.querySelector('.mesh-extrude-distance').value); if (d === null) throw new TypeError('Enter a finite extrude distance'); applyMesh(extrudeFace(mesh, selectedFace, d), 'Extruded face'); } catch (error) { onStatus(error.message); } };
    root.querySelector('.mesh-inset').onclick = () => { try { applyMesh(insetFace(mesh, selectedFace, .2), 'Inset face'); } catch (error) { onStatus(error.message); } };
    root.querySelector('.mesh-subdivide').onclick = () => { try { applyMesh(subdivideMesh(mesh), 'Subdivided mesh'); selectedFace = selectedVertex = null; } catch (error) { onStatus(error.message); } };
    syncMoveHandle();
  }
  function applyMesh(next, message) { validateMesh(next); project.setMesh(entityId, next); onStatus(message); queueMicrotask(render); }
  function applyPosition(position) {
    const mesh = getMesh();
    if (selectedVertex !== null) applyMesh(moveVertex(mesh, selectedVertex, position), 'Moved vertex');
    else if (selectedFace !== null) {
      const before = centroid(mesh, mesh.faces[selectedFace]), delta = position.map((value, axis) => value - before[axis]);
      const next = { vertices: mesh.vertices.map(vertex => [...vertex]), faces: mesh.faces.map(face => [...face]) };
      mesh.faces[selectedFace].forEach(index => { next.vertices[index] = next.vertices[index].map((value, axis) => value + delta[axis]); });
      applyMesh(next, 'Moved face');
    }
  }
  function setPointer(event) { const r = canvas.getBoundingClientRect(); pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1); }
  function pick(event) {
    if (!inEdit()) return false;
    const mesh = getMesh(), object = viewport.getObject(entityId); if (!mesh || !object) return false;
    const rect = canvas.getBoundingClientRect(); let nearest = -1, distance = 13;
    object.updateWorldMatrix(true, false);
    if (selectionKind === 'vertex') mesh.vertices.forEach((vertex, index) => { const p = new THREE.Vector3(...vertex).applyMatrix4(object.matrixWorld).project(stage.camera); const x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2, d = Math.hypot(event.clientX - x, event.clientY - y); if (p.z > -1 && p.z < 1 && d < distance) { nearest = index; distance = d; } });
    if (nearest >= 0) { selectedVertex = nearest; selectedFace = null; render({ force: true }); onStatus(`Selected vertex ${nearest + 1}`); return true; }
    if (selectionKind === 'vertex') return false;
    raycaster.setFromCamera((setPointer(event), pointer), stage.camera);
    const hit = raycaster.intersectObject(object, true).find(item => item.object !== overlay && !item.object.name.startsWith('Mesh'));
    if (!hit || hit.faceIndex == null) return false;
    const tri = triangulateMesh(mesh); selectedFace = hit.object.geometry?.userData?.faceIndices?.[hit.faceIndex] ?? tri.faceIndices[hit.faceIndex] ?? null; selectedVertex = null;
    if (selectedFace === null) return false; selectionKind = 'face'; render({ force: true }); onStatus(`Selected face ${selectedFace + 1}`); return true;
  }
  function onPointerDown(event) { if (event.target !== canvas || event.button !== 0 || !inEdit()) return; moveControl.camera = stage.camera; if (moveControl.axis) return; if (pick(event)) { interceptedPointers.add(event.pointerId); event.preventDefault(); event.stopImmediatePropagation(); } }
  function onPointerUp(event) { if (interceptedPointers.delete(event.pointerId)) { event.preventDefault(); event.stopImmediatePropagation(); } }
  // Window capture fires before the viewport's canvas capture listener, so a
  // mesh click never leaks through to object selection or transform gizmos.
  window.addEventListener('pointerdown', onPointerDown, true); window.addEventListener('pointerup', onPointerUp, true);
  function onControlMouseDown() {
    const mesh = getMesh(), object = viewport.getObject(entityId), position = selectedPosition(mesh);
    if (!mesh || !object || !position) return;
    object.updateWorldMatrix(true, false); moveControl.camera = stage.camera;
    meshDrag = { mesh: structuredClone(mesh), object, startWorld: moveAnchor.position.clone(), inverse: object.matrixWorld.clone().invert() };
    project.beginTransaction('Move mesh element'); stage.orbitCtrl.enabled = false;
  }
  function onControlObjectChange() {
    if (!meshDrag) return;
    const start = meshDrag.startWorld.clone().applyMatrix4(meshDrag.inverse), now = moveAnchor.position.clone().applyMatrix4(meshDrag.inverse);
    const delta = now.sub(start), next = structuredClone(meshDrag.mesh);
    const indices = selectionKind === 'vertex' ? [selectedVertex] : next.faces[selectedFace];
    if (!indices?.length) return;
    indices.forEach(index => { next.vertices[index] = next.vertices[index].map((value, axis) => value + delta.getComponent(axis)); });
    try { project.setMesh(entityId, next); } catch (error) { onStatus(error.message); }
  }
  function finishControlDrag(cancel = false) {
    if (!meshDrag) return;
    meshDrag = null; stage.orbitCtrl.enabled = true;
    if (cancel) project.cancelTransaction(); else project.commitTransaction();
    queueMicrotask(() => render({ force: true }));
  }
  function onControlDragging(event) { stage.orbitCtrl.enabled = !event.value; }
  function onKeyDown(event) { if (event.key === 'Escape' && meshDrag) { event.preventDefault(); finishControlDrag(true); } }
  function onWindowBlur() { finishControlDrag(true); }
  function onPointerCancel() { finishControlDrag(true); }
  moveControl.addEventListener('mouseDown', onControlMouseDown); moveControl.addEventListener('objectChange', onControlObjectChange); moveControl.addEventListener('mouseUp', () => finishControlDrag(false)); moveControl.addEventListener('dragging-changed', onControlDragging);
  window.addEventListener('keydown', onKeyDown); window.addEventListener('blur', onWindowBlur); window.addEventListener('pointercancel', onPointerCancel, true);
  const unsubscribeProject = project.subscribe(() => { if (!inEdit() || meshDrag) return; if (!getEntity() || !getMesh() || project.selection.activeId !== entityId) { exit(); return; } queueMicrotask(render); });
  const unsubscribeTools = tools.subscribe(() => { if (!meshDrag) queueMicrotask(render); });
  function enter(id = project.selection.activeId) {
    const entity = project.get(id); if (!enabled || !editable(entity)) { onStatus('Select a primitive to edit its mesh'); return false; }
    entityId = id; if (!entity.components.mesh) project.setMesh(id, primitiveToMesh(entity));
    selectedFace = selectedVertex = null; selectionKind = 'face'; tools.setEditingMode?.('edit'); render({ force: true }); onStatus('Edit mode: choose Faces or Vertices, then click the mesh'); return true;
  }
  function exit() { selectedFace = selectedVertex = null; tools.setEditingMode?.('object'); entityId = null; render({ force: true }); onStatus('Object mode'); }
  function setAllowed(value) { enabled = Boolean(value); if (!enabled && inEdit()) exit(); render(); }
  function dispose() { if (disposed) return; disposed = true; finishControlDrag(true); window.removeEventListener('pointerdown', onPointerDown, true); window.removeEventListener('pointerup', onPointerUp, true); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('blur', onWindowBlur); window.removeEventListener('pointercancel', onPointerCancel, true); moveControl.dispose(); moveControl.removeFromParent(); moveAnchor.removeFromParent(); unsubscribeProject(); unsubscribeTools(); discardOverlay(); root.replaceChildren(); }
  render();
  return { enter, exit, setAllowed, dispose, refresh() { render({ force: true }); }, canEdit: editable, get editingId() { return entityId; } };
}
