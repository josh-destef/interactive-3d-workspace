import * as THREE from 'three';

const ORANGE = 0xff9022;

function disposeMaterials(root) {
  root?.traverse(node => {
    if (Array.isArray(node.material)) node.material.forEach(material => material.dispose?.());
    else node.material?.dispose?.();
  });
}

/**
 * Orange wireframe destination and labelled crosshair for the current part.
 * `match` lists transform fields ('rotation', 'scale') the outline copies from
 * the live part, so a step that only asks for Position shows where the part
 * goes as it is now, not a finished shape the learner has not reached yet.
 * `floor: false` hides the ground crosshair; `marker: false` hides the
 * pulsing ring and "place here" label, leaving only the outline.
 */
export function createAssemblyGuide(creator) {
  const { stage } = creator.viewport;
  const wrap = document.getElementById('canvas-wrap');
  const layer = new THREE.Group();
  layer.name = 'AssemblyTargetGuide';
  stage.scene.add(layer);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(.17, .018, 8, 48),
    new THREE.MeshBasicMaterial({ color: ORANGE, depthTest: false, transparent: true, opacity: .95 }),
  );
  ring.renderOrder = 12;
  layer.add(ring);

  const cross = new THREE.GridHelper(.72, 4, ORANGE, ORANGE);
  cross.material.transparent = true;
  cross.material.opacity = .58;
  cross.material.depthTest = false;
  cross.renderOrder = 11;
  layer.add(cross);

  const label = document.createElement('div');
  label.className = 'assembly-target-label';
  label.setAttribute('aria-hidden', 'true');
  wrap.append(label);

  let ghost = null;
  let current = null;
  let match = [];
  let raf = 0;
  const world = new THREE.Vector3();

  function clearGhost() {
    if (!ghost) return;
    ghost.removeFromParent();
    disposeMaterials(ghost);
    ghost = null;
  }

  function show(part, { match: fields = [], floor = true, marker = true } = {}) {
    clearGhost();
    current = part;
    match = fields;
    // Targets are local to the part's parent group; keep the guide in that space.
    const parentId = creator.project?.get(part.id)?.parentId;
    layer.position.fromArray(creator.project?.get(parentId)?.components.transform.position || [0, 0, 0]);
    const object = creator.viewport.getObject(part.id);
    if (object) {
      ghost = object.clone(true);
      ghost.userData = {};
      ghost.position.fromArray(part.targetTransform.position);
      ghost.rotation.set(...part.targetTransform.rotation, 'XYZ');
      ghost.scale.fromArray(part.targetTransform.scale);
      ghost.traverse(node => {
        node.userData = {};
        if (!node.isMesh) return;
        node.material = new THREE.MeshBasicMaterial({
          color: ORANGE, wireframe: true, transparent: true, opacity: .28,
          depthWrite: false, depthTest: false,
        });
        node.castShadow = false; node.receiveShadow = false; node.renderOrder = 10;
      });
      layer.add(ghost);
      followLivePart();
    }
    ring.position.fromArray(part.targetTransform.position);
    cross.position.set(part.targetTransform.position[0], .018 - layer.position.y, part.targetTransform.position[2]);
    ring.visible = marker;
    cross.visible = floor;
    layer.visible = true;
    label.textContent = `PLACE ${part.name.toUpperCase()} HERE`;
    label.hidden = !marker;
  }

  function followLivePart() {
    const transform = ghost && current && creator.project?.get(current.id)?.components.transform;
    if (!transform) return;
    if (match.includes('rotation')) ghost.rotation.set(...transform.rotation, 'XYZ');
    if (match.includes('scale')) ghost.scale.fromArray(transform.scale);
  }

  function hide() {
    current = null;
    match = [];
    clearGhost();
    layer.visible = false;
    label.hidden = true;
  }

  function frame(time) {
    raf = requestAnimationFrame(frame);
    if (!current || layer.visible === false) return;
    followLivePart();
    ring.scale.setScalar(1 + Math.sin(time * .004) * .08);
    ring.quaternion.copy(stage.camera.quaternion);
    world.fromArray(current.targetTransform.position).add(layer.position).project(stage.camera);
    const bounds = wrap.getBoundingClientRect();
    label.style.left = `${(world.x * .5 + .5) * bounds.width}px`;
    label.style.top = `${(-world.y * .5 + .5) * bounds.height}px`;
  }
  raf = requestAnimationFrame(frame);

  return {
    show, hide,
    dispose() {
      cancelAnimationFrame(raf);
      hide();
      ring.geometry.dispose(); ring.material.dispose();
      cross.geometry.dispose(); cross.material.dispose();
      layer.removeFromParent(); label.remove();
    },
  };
}
