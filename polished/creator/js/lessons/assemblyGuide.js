import * as THREE from 'three';

const ORANGE = 0xff9022;

function disposeMaterials(root) {
  root?.traverse(node => {
    if (Array.isArray(node.material)) node.material.forEach(material => material.dispose?.());
    else node.material?.dispose?.();
  });
}

/** Orange wireframe destination and labelled crosshair for the current part. */
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
  let raf = 0;
  const world = new THREE.Vector3();

  function clearGhost() {
    if (!ghost) return;
    ghost.removeFromParent();
    disposeMaterials(ghost);
    ghost = null;
  }

  function show(part) {
    clearGhost();
    current = part;
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
    }
    ring.position.fromArray(part.targetTransform.position);
    cross.position.set(part.targetTransform.position[0], .018, part.targetTransform.position[2]);
    ring.visible = true;
    cross.visible = true;
    layer.visible = true;
    label.textContent = `PLACE ${part.name.toUpperCase()} HERE`;
    label.hidden = false;
  }

  function hide() {
    current = null;
    clearGhost();
    layer.visible = false;
    label.hidden = true;
  }

  function frame(time) {
    raf = requestAnimationFrame(frame);
    if (!current || layer.visible === false) return;
    ring.scale.setScalar(1 + Math.sin(time * .004) * .08);
    ring.quaternion.copy(stage.camera.quaternion);
    world.fromArray(current.targetTransform.position).project(stage.camera);
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
