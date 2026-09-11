import * as THREE from 'three';

/** Semantic material roles hide GLTF mesh names from the editor's object model. */
export const MATERIAL_MODEL_URL = new URL('../../labs/material-lab/assets/gizmobot-material-lab.glb', import.meta.url);

export function applyModelMaterial(root, values = {}) {
  root.traverse(node => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material.name !== 'Shell_Paint') continue;
      material.color.set(values.color ?? '#b8b8b4');
      material.roughness = values.roughness ?? .5;
      material.metalness = values.metalness ?? 0;
      material.emissive.set(values.color ?? '#b8b8b4');
      material.emissiveIntensity = values.emissiveIntensity ?? 0;
    }
  });
}

/** Each clone owns geometry and material instances; source textures remain shared. */
export function cloneMaterialModel(template, values) {
  const instance = template.clone(true);
  instance.scale.setScalar(.72);
  const materials = new Map();
  instance.traverse(node => {
    if (!node.isMesh) return;
    node.geometry = node.geometry.clone();
    const source = Array.isArray(node.material) ? node.material : [node.material];
    const assigned = source.map(original => {
      if (!materials.has(original)) {
        const material = original.name === 'Shell_Paint'
          ? new THREE.MeshPhysicalMaterial({ name: 'Shell_Paint', envMapIntensity: .24 })
          : original.clone();
        material.envMapIntensity = .24;
        if (material.name === 'Face_Glow') {
          material.emissive.set(0xc8f2ff);
          material.emissiveIntensity = 1.6;
          material.depthWrite = false;
          material.transparent = true;
        }
        materials.set(original, material);
      }
      return materials.get(original);
    });
    node.material = Array.isArray(node.material) ? assigned : assigned[0];
    const overlay = assigned.some(material => ['Face_Glow', 'Logo_Decal'].includes(material.name));
    node.castShadow = node.receiveShadow = !overlay;
    if (overlay) node.renderOrder = 2;
  });
  applyModelMaterial(instance, values);
  return instance;
}
