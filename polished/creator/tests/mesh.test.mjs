import assert from 'node:assert/strict';
import { primitiveToMesh, validateMesh, triangulateMesh, extrudeFace, insetFace, moveVertex, subdivideMesh } from '../js/mesh.js';

const cube = primitiveToMesh({ type: 'cube', components: { geometry: { width: 2, height: 2, depth: 2 } } });
assert.equal(cube.vertices.length, 8); assert.equal(cube.faces.length, 6); assert.equal(validateMesh(cube), true);
const triangles = triangulateMesh(cube);
assert.equal(triangles.indices.length, 36); assert.equal(triangles.faceIndices.length, 12); assert.deepEqual(triangles.faceIndices.slice(0, 2), [0, 0]);
const extruded = extrudeFace(cube, 0, .5);
assert.equal(extruded.vertices.length, 12); assert.equal(extruded.faces.length, 10); assert.deepEqual(cube.faces[0], [0,1,2,3], 'operations are immutable');
assert.deepEqual(extruded.vertices[8], [-1,-1,1.5], 'cap follows the selected face normal');
const inset = insetFace(cube, 0, .25);
assert.equal(inset.vertices.length, 12); assert.equal(inset.faces.length, 10); assert.deepEqual(inset.faces[0], [8,9,10,11]);
const moved = moveVertex(cube, 0, [4, 5, 6]); assert.deepEqual(moved.vertices[0], [4,5,6]); assert.deepEqual(cube.vertices[0], [-1,-1,1]);
const divided = subdivideMesh(cube); assert.equal(divided.faces.length, 24); assert.equal(divided.vertices.length, 26); validateMesh(divided);
assert.throws(() => validateMesh({ vertices: [[0,0,0]], faces: [[0,1,2]] }));
assert.throws(() => insetFace(cube, 0, 1));
assert.throws(() => validateMesh({ vertices: Array.from({ length: 20001 }, () => [0,0,0]), faces: [[0,1,2]] }), /20,000/);
const normal = (mesh, face) => {
  const n = [0,0,0];
  face.forEach((index, i) => { const a = mesh.vertices[index], b = mesh.vertices[face[(i + 1) % face.length]]; n[0] += (a[1]-b[1])*(a[2]+b[2]); n[1] += (a[2]-b[2])*(a[0]+b[0]); n[2] += (a[0]-b[0])*(a[1]+b[1]); }); return n;
};
for (const type of ['sphere', 'cylinder', 'cone']) {
  const mesh = primitiveToMesh({ type, components: { geometry: { radius: 1, height: 2 } } });
  mesh.faces.forEach(face => { const c = face.reduce((sum, index) => sum.map((value, axis) => value + mesh.vertices[index][axis]), [0,0,0]); const n = normal(mesh, face); assert.ok(n.reduce((sum, value, axis) => sum + value * c[axis], 0) > 0, `${type} face winds outward`); });
}
console.log('PASS mesh primitives, triangulation, immutable face edits and shared-edge subdivision');
