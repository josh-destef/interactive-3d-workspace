/* ═══════════════════════════════════════════════
   SUBJECT
   Saving the student's work.

   The export path is the one the slider version of this lab already used and
   is kept verbatim: a binary GLB under one identity-transform root, with
   glTF extras naming what the thing is. The mount plug goes in, since it is
   part of what the student modelled; Gizmobot and his port stay out.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { state } from './model.js';

/** A detached copy at the origin, so the file opens sensibly anywhere. */
function buildExportRoot() {
    const out = new THREE.Group();
    out.name = 'Gizmo_BackModule';
    out.userData = {
        accessoryType: 'back-module',
        suggestedSlot: 'back',
        primitiveLesson: true,
    };

    const centre = new THREE.Vector3();
    state.root.updateWorldMatrix(true, true);
    new THREE.Box3().setFromObject(state.root).getCenter(centre);

    const copy = state.root.clone(true);
    copy.position.sub(centre);
    out.add(copy);

    return out;
}

export function saveModule() {
    const root = buildExportRoot();
    return new GLTFExporter().parseAsync(root, { binary: true }).then(data => {
        const blob = new Blob([data], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gizmo-back-module.glb';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
}
