import * as THREE from 'three';

// The four-piece back module from the original lab, shown as a reference only.
// It never enters project/history, so a demonstration cannot satisfy practice.
export function createAccessoryExample(creator) {
  const { stage } = creator.viewport;
  const root = new THREE.Group();
  root.name = 'Back module example';
  const specs = [
    ['body', new THREE.BoxGeometry(1, 1, 1), [0, 1.8, -.74], [.84, .94, .34], '#3a91b8', [-.7, 0, 0]],
    ['detail', new THREE.BoxGeometry(1, 1, 1), [0, 1.46, -.95], [.48, .2, .14], '#25303c', [.65, -.35, -.3]],
    ['antenna', new THREE.CylinderGeometry(.5, .5, 1, 24), [.26, 2.46, -.83], [.05, .58, .05], '#f2f0eb', [.4, .25, 0]],
    ['beacon', new THREE.SphereGeometry(.5, 24, 16), [.26, 2.79, -.83], [.22, .22, .22], '#ff9022', [.4, .55, 0]],
  ];
  const pieces = specs.map(([name, geometry, position, scale, color, offset]) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .48 }));
    mesh.name = name;
    mesh.position.fromArray(position); mesh.scale.fromArray(scale);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.raycast = () => {};
    root.add(mesh);
    return { mesh, home: mesh.position.clone(), offset: new THREE.Vector3(...offset) };
  });
  let frame = 0, transitionFrame = 0, shown = false, savedCamera = null, cancelSeparation = null, cancelTransition = null;
  const pose = amount => pieces.forEach(({ mesh, home, offset }) => mesh.position.copy(home).addScaledVector(offset, amount));
  const opacity = value => pieces.forEach(({ mesh }) => {
    const transparent = value < 1;
    if (mesh.material.transparent !== transparent) {
      mesh.material.transparent = transparent;
      mesh.material.needsUpdate = true;
    }
    mesh.material.opacity = value;
  });
  function separate() {
    if (!shown) return Promise.resolve(false);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { pose(1); return Promise.resolve(true); }
    return new Promise(resolve => {
      cancelSeparation = () => resolve(false);
      const start = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - start) / 1400);
        pose(t * t * (3 - 2 * t));
        if (t < 1 && shown) frame = requestAnimationFrame(tick);
        else { cancelSeparation = null; resolve(shown); }
      }
      frame = requestAnimationFrame(tick);
    });
  }
  function show() {
    if (shown) return;
    shown = true; pose(0);
    const bot = creator.viewport.getObject('gizmobot');
    if (bot) {
      bot.updateWorldMatrix(true, false);
      // Creation Studio displays the GLB in its native orientation; the old lab turned
      // its model around. Align that lab's reference coordinates to the back.
      root.matrix.copy(bot.matrixWorld).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
      root.matrixAutoUpdate = false;
    }
    stage.scene.add(root);
    savedCamera = { position: stage.camera.position.clone(), target: stage.orbitCtrl.target.clone() };
    const origin = new THREE.Vector3().setFromMatrixPosition(root.matrix);
    stage.camera.position.copy(origin).add(new THREE.Vector3(3.2, 2.8, -4.8));
    stage.orbitCtrl.target.copy(origin).add(new THREE.Vector3(0, 1.65, -.2));
    stage.orbitCtrl.update();
  }
  function detach(restoreCamera = true) {
    if (!shown) return;
    shown = false;
    cancelAnimationFrame(frame); cancelAnimationFrame(transitionFrame);
    root.removeFromParent(); cancelSeparation?.(); cancelSeparation = null;
    if (restoreCamera && savedCamera) {
      stage.camera.position.copy(savedCamera.position); stage.orbitCtrl.target.copy(savedCamera.target); stage.orbitCtrl.update();
    }
    opacity(1);
  }
  function hide() {
    cancelTransition?.(); cancelTransition = null;
    detach(true);
  }
  function transitionOut() {
    if (!shown) return Promise.resolve(false);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !savedCamera) { hide(); return Promise.resolve(true); }
    cancelAnimationFrame(frame); cancelSeparation?.(); cancelSeparation = null;
    const fromPosition = stage.camera.position.clone();
    const fromTarget = stage.orbitCtrl.target.clone();
    return new Promise(resolve => {
      let settled = false;
      const finish = value => { if (settled) return; settled = true; resolve(value); };
      cancelTransition = () => finish(false);
      const start = performance.now();
      function tick(now) {
        if (!shown) { finish(false); return; }
        const t = Math.min(1, (now - start) / 720);
        const eased = t * t * (3 - 2 * t);
        pose(1 - eased);
        opacity(1 - Math.max(0, (eased - .45) / .55));
        stage.camera.position.lerpVectors(fromPosition, savedCamera.position, eased);
        stage.orbitCtrl.target.lerpVectors(fromTarget, savedCamera.target, eased);
        stage.orbitCtrl.update();
        if (t < 1) transitionFrame = requestAnimationFrame(tick);
        else {
          transitionFrame = 0; cancelTransition = null;
          detach(true); finish(true);
        }
      }
      transitionFrame = requestAnimationFrame(tick);
    });
  }
  return { show, hide, separate, transitionOut, dispose() { hide(); pieces.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.dispose(); }); } };
}
