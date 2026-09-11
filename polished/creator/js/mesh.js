/** Small, serialisable polygon meshes used by Creation Studio's edit mode. */
const finite = value => typeof value === 'number' && Number.isFinite(value);
const copy = mesh => ({ vertices: mesh.vertices.map(vertex => [...vertex]), faces: mesh.faces.map(face => [...face]) });
const keyForEdge = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

export function validateMesh(mesh) {
  if (!mesh || !Array.isArray(mesh.vertices) || !Array.isArray(mesh.faces))
    throw new TypeError('A mesh needs vertices and faces');
  if (!mesh.vertices.length || !mesh.faces.length)
    throw new RangeError('A mesh needs at least one vertex and one face');
  if (mesh.vertices.length > 20000 || mesh.faces.length > 20000)
    throw new RangeError('Mesh exceeds Creation Studio’s 20,000 vertex or face limit');
  mesh.vertices.forEach((vertex, index) => {
    if (!Array.isArray(vertex) || vertex.length !== 3 || !vertex.every(finite))
      throw new TypeError(`Vertex ${index} must contain three finite coordinates`);
  });
  mesh.faces.forEach((face, index) => {
    if (!Array.isArray(face) || face.length < 3 || face.length > 64 || !face.every(Number.isInteger))
      throw new TypeError(`Face ${index} needs at least three vertex indices`);
    if (new Set(face).size !== face.length || face.some(vertex => vertex < 0 || vertex >= mesh.vertices.length))
      throw new RangeError(`Face ${index} has invalid vertex indices`);
  });
  return true;
}

export function triangulateMesh(mesh) {
  validateMesh(mesh);
  const indices = [], faceIndices = [];
  mesh.faces.forEach((face, faceIndex) => {
    for (let i = 1; i < face.length - 1; i++) {
      indices.push(face[0], face[i], face[i + 1]);
      faceIndices.push(faceIndex);
    }
  });
  return { indices, faceIndices };
}

function box(width = 1, height = 1, depth = 1) {
  const x = width / 2, y = height / 2, z = depth / 2;
  return { vertices: [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z],[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z]],
    faces: [[0,1,2,3],[1,5,6,2],[5,4,7,6],[4,0,3,7],[3,2,6,7],[4,5,1,0]] };
}
function radial(type, radius, height, segments = 12) {
  const vertices = [], faces = [], y = height / 2;
  if (type === 'cone') {
    for (let i = 0; i < segments; i++) { const a = i * Math.PI * 2 / segments; vertices.push([radius * Math.sin(a), -y, radius * Math.cos(a)]); }
    const tip = vertices.push([0, y, 0]) - 1;
    faces.push([...Array(segments).keys()].reverse());
    for (let i = 0; i < segments; i++) faces.push([i, (i + 1) % segments, tip]);
  } else {
    for (const yy of [-y, y]) for (let i = 0; i < segments; i++) { const a = i * Math.PI * 2 / segments; vertices.push([radius * Math.sin(a), yy, radius * Math.cos(a)]); }
    faces.push([...Array(segments).keys()].reverse());
    faces.push([...Array(segments).keys()].map(i => segments + i));
    for (let i = 0; i < segments; i++) faces.push([i, (i + 1) % segments, segments + (i + 1) % segments, segments + i]);
  }
  return { vertices, faces };
}
function sphere(radius, segments = 12, rings = 8) {
  const vertices = [[0, radius, 0]], faces = [];
  for (let row = 1; row < rings; row++) {
    const phi = row * Math.PI / rings;
    for (let i = 0; i < segments; i++) { const theta = i * Math.PI * 2 / segments; vertices.push([radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.cos(theta)]); }
  }
  const bottom = vertices.push([0, -radius, 0]) - 1;
  for (let i = 0; i < segments; i++) faces.push([0, 1 + (i + 1) % segments, 1 + i]);
  for (let row = 0; row < rings - 2; row++) for (let i = 0; i < segments; i++) { const a = 1 + row * segments + i, b = 1 + row * segments + (i + 1) % segments; faces.push([a, b, b + segments, a + segments]); }
  const start = 1 + (rings - 2) * segments;
  for (let i = 0; i < segments; i++) faces.push([start + i, start + (i + 1) % segments, bottom]);
  return { vertices, faces: faces.map(face => face.reverse()) };
}

export function primitiveToMesh(entity) {
  const g = entity?.components?.geometry || {};
  let mesh;
  switch (entity?.type) {
    case 'cube': mesh = box(g.width ?? 1, g.height ?? 1, g.depth ?? 1); break;
    case 'plane': { const x = (g.width ?? 1) / 2, y = (g.height ?? 1) / 2; mesh = { vertices: [[-x,-y,0],[x,-y,0],[x,y,0],[-x,y,0]], faces: [[0,1,2,3]] }; break; }
    case 'cylinder': mesh = radial('cylinder', g.radius ?? .5, g.height ?? 1); break;
    case 'cone': mesh = radial('cone', g.radius ?? .5, g.height ?? 1); break;
    case 'sphere': mesh = sphere(g.radius ?? .6); break;
    default: throw new TypeError('Only primitives can be converted to editable meshes');
  }
  validateMesh(mesh);
  return mesh;
}

function faceNormal(mesh, face) {
  // Newell's method is stable for convex and mildly non-planar polygons.
  const normal = [0, 0, 0];
  for (let i = 0; i < face.length; i++) {
    const a = mesh.vertices[face[i]], b = mesh.vertices[face[(i + 1) % face.length]];
    normal[0] += (a[1] - b[1]) * (a[2] + b[2]); normal[1] += (a[2] - b[2]) * (a[0] + b[0]); normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const length = Math.hypot(...normal);
  if (length < 1e-9) throw new RangeError('Cannot edit a face with no area');
  return normal.map(value => value / length);
}

export function extrudeFace(mesh, faceIndex, distance = .25) {
  validateMesh(mesh);
  if (!Number.isInteger(faceIndex) || !mesh.faces[faceIndex]) throw new RangeError('Unknown face');
  if (!finite(distance)) throw new TypeError('Extrude distance must be finite');
  const next = copy(mesh), face = next.faces[faceIndex], normal = faceNormal(next, face);
  const cap = face.map(index => next.vertices.push(next.vertices[index].map((value, axis) => value + normal[axis] * distance)) - 1);
  next.faces.splice(faceIndex, 1, cap);
  for (let i = 0; i < face.length; i++) next.faces.push([face[i], face[(i + 1) % face.length], cap[(i + 1) % face.length], cap[i]]);
  validateMesh(next); return next;
}

export function insetFace(mesh, faceIndex, amount = .2) {
  validateMesh(mesh);
  if (!Number.isInteger(faceIndex) || !mesh.faces[faceIndex]) throw new RangeError('Unknown face');
  if (!finite(amount) || amount <= 0 || amount >= 1) throw new RangeError('Inset amount must be between 0 and 1');
  const next = copy(mesh), face = next.faces[faceIndex];
  const centre = face.reduce((sum, index) => sum.map((value, axis) => value + next.vertices[index][axis]), [0,0,0]).map(value => value / face.length);
  const inner = face.map(index => next.vertices.push(next.vertices[index].map((value, axis) => centre[axis] + (value - centre[axis]) * (1 - amount))) - 1);
  next.faces.splice(faceIndex, 1, inner);
  for (let i = 0; i < face.length; i++) next.faces.push([face[i], face[(i + 1) % face.length], inner[(i + 1) % face.length], inner[i]]);
  validateMesh(next); return next;
}

export function moveVertex(mesh, vertexIndex, position) {
  validateMesh(mesh);
  if (!Number.isInteger(vertexIndex) || !mesh.vertices[vertexIndex]) throw new RangeError('Unknown vertex');
  if (!Array.isArray(position) || position.length !== 3 || !position.every(finite)) throw new TypeError('Position must have three finite coordinates');
  const next = copy(mesh); next.vertices[vertexIndex] = [...position]; return next;
}

export function subdivideMesh(mesh, maxVertices = 20000) {
  validateMesh(mesh);
  const next = { vertices: mesh.vertices.map(vertex => [...vertex]), faces: [] }, midpoints = new Map();
  const midpoint = (a, b) => { const key = keyForEdge(a, b); if (midpoints.has(key)) return midpoints.get(key); if (next.vertices.length >= maxVertices) throw new RangeError('Subdivision would create too many vertices'); const p = mesh.vertices[a].map((value, axis) => (value + mesh.vertices[b][axis]) / 2); const index = next.vertices.push(p) - 1; midpoints.set(key, index); return index; };
  for (const face of mesh.faces) {
    if (next.vertices.length >= maxVertices) throw new RangeError('Subdivision would create too many vertices');
    const centre = next.vertices.push(face.reduce((sum, index) => sum.map((value, axis) => value + mesh.vertices[index][axis]), [0,0,0]).map(value => value / face.length)) - 1;
    for (let i = 0; i < face.length; i++) next.faces.push([face[i], midpoint(face[i], face[(i + 1) % face.length]), centre, midpoint(face[(i - 1 + face.length) % face.length], face[i])]);
  }
  validateMesh(next); return next;
}
