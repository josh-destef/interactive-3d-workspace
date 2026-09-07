"""Bake Gizmobot's LOD ladder for the topology lab.

Quadric-error edge collapse over the position-welded mesh, snapshotted at seven
densities into one GLB. Boundary and UV-seam edges carry constraint quadrics, so
the texture layout and the open rims outlive the silhouette detail.

The original BIN chunk is copied verbatim and appended to, never rewritten, so
the three embedded textures survive byte for byte and LOD0 points at the
source's own accessors -- the top rung of the ladder is the untouched asset.

Run from anywhere with Python 3. Needs numpy, nothing else.
"""
from pathlib import Path
import collections
import copy
import hashlib
import heapq
import json
import math
import struct

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/models/gizmobot.glb'
OUT = ROOT / 'polished/labs/topology-gizmobot/assets'

# Each rung roughly halves the one above. LOD0 is the source mesh untouched.
# Gizmobot is 55 separate shells, so a ladder cannot go below 55 * SHELL_FLOOR
# triangles without shattering into confetti. It stops where it stays honest.
RATIOS = [1, .5, .25, .125, .0625, .035]
SEAM_WEIGHT = 240.0     # how much harder a seam edge is to collapse than a face
FLIP_LIMIT = .12        # reject a collapse that swings a face normal past this
WANDER = 1.5            # how far past the edge the merged vertex may be placed
SLIVER = .02            # reject a collapse that makes a face this much thinner
SHELL_FLOOR = 8         # a shell is never decimated below this many triangles
SMOOTH_ANGLE = 40.0     # normals split across an edge sharper than this

original = SOURCE.read_bytes()
n = struct.unpack_from('<I', original, 12)[0]
doc = json.loads(original[20:20 + n])
binary = original[28 + n:]
primitive = doc['meshes'][0]['primitives'][0]


def rows(index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    fmt = '<' + {5126: 'f', 5123: 'H', 5125: 'I'}[a['componentType']] * size
    width = struct.calcsize(fmt)
    stride = v.get('byteStride', width)
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from(fmt, binary, start + i * stride) for i in range(a['count'])]


src_pos = np.array(rows(primitive['attributes']['POSITION']), dtype=np.float64)
src_uv = np.array(rows(primitive['attributes']['TEXCOORD_0']), dtype=np.float64)
src_nrm = np.array(rows(primitive['attributes']['NORMAL']), dtype=np.float64)
flat = [r[0] for r in rows(primitive['indices'])]
src_tris = [tuple(flat[i:i + 3]) for i in range(0, len(flat), 3)]

# -- weld --
# Seam copies share a position exactly, so an exact key is enough. The split
# lives in UV and normal, and those stay attached to the corners below.
weld = {}
wid = np.empty(len(src_pos), dtype=np.int64)
for i, p in enumerate(map(tuple, src_pos)):
    wid[i] = weld.setdefault(p, len(weld))
W = len(weld)
P = np.zeros((W, 3))
for i, w in enumerate(wid):
    P[w] = src_pos[i]

faces = [[int(wid[a]), int(wid[b]), int(wid[c])] for a, b, c in src_tris]
corner = list(src_tris)          # original vertex per corner, fixed forever
alive_f = [True] * len(faces)
alive_v = np.ones(W, dtype=bool)

adj_f = collections.defaultdict(set)
adj_v = collections.defaultdict(set)
for f, (a, b, c) in enumerate(faces):
    for x in (a, b, c):
        adj_f[x].add(f)
    for x, y in ((a, b), (b, c), (c, a)):
        adj_v[x].add(y)
        adj_v[y].add(x)


def cross_of(a, b, c):
    return np.cross(P[b] - P[a], P[c] - P[a])


# -- quadrics --
Q = np.zeros((W, 4, 4))
Aq = np.zeros(W)          # the surface area each quadric was built from
for a, b, c in faces:
    cr = cross_of(a, b, c)
    area = np.linalg.norm(cr)
    if area < 1e-14:
        continue
    nrm = cr / area
    plane = np.array([nrm[0], nrm[1], nrm[2], -nrm @ P[a]])
    K = np.outer(plane, plane) * (area * .5)
    Q[a] += K
    Q[b] += K
    Q[c] += K
    Aq[a] += area * .5
    Aq[b] += area * .5
    Aq[c] += area * .5

# An edge is constrained when it bounds the surface, or when the two faces
# meeting along it disagree about UV. Both get a plane through the edge and
# perpendicular to the face, weighted heavily: the solver may still cross a
# seam, but only once everything cheaper has already gone.
edge_faces = collections.defaultdict(list)
for f, tri in enumerate(faces):
    for x, y in ((0, 1), (1, 2), (2, 0)):
        edge_faces[(min(tri[x], tri[y]), max(tri[x], tri[y]))].append(f)

# Keyed by welded id, which is safe here and only here: seams are measured
# before the first collapse, while a face's corners still name their own
# vertices. Everything after this point goes through corner slots instead.
uv_at = {}
for f, tri in enumerate(faces):
    for slot, w in enumerate(tri):
        uv_at[(f, w)] = tuple(src_uv[corner[f][slot]])


def uv_corner(f, slot):
    return tuple(src_uv[corner[f][slot]])

seam_edges = 0
for (a, b), fs in edge_faces.items():
    if len(fs) == 2:
        f1, f2 = fs
        seam = uv_at[(f1, a)] != uv_at[(f2, a)] or uv_at[(f1, b)] != uv_at[(f2, b)]
    else:
        seam = True          # an open rim, or a non-manifold junction
    if not seam:
        continue
    seam_edges += 1
    cr = cross_of(*faces[fs[0]])
    d = P[b] - P[a]
    length = np.linalg.norm(d)
    if np.linalg.norm(cr) < 1e-14 or length < 1e-12:
        continue
    perp = np.cross(d / length, cr / np.linalg.norm(cr))
    plane = np.array([perp[0], perp[1], perp[2], -perp @ P[a]])
    K = np.outer(plane, plane) * (SEAM_WEIGHT * length)
    Q[a] += K
    Q[b] += K


def error_at(Qs, x):
    v = np.array([x[0], x[1], x[2], 1.])
    return float(v @ Qs @ v)


def target_for(u, v):
    """Where the merged vertex should sit, and what putting it there costs.

    On a thin tube the quadric is nearly singular along the axis, and the exact
    solve happily parks the merged vertex somewhere off in space -- which is how
    an arm turns into a spike. Anything that lands further from the edge than
    the edge is long gets thrown away for the best of the three safe choices."""
    Qs = Q[u] + Q[v]
    mid = (P[u] + P[v]) * .5
    reach = np.linalg.norm(P[v] - P[u]) * WANDER + 1e-9
    A = Qs[:3, :3]
    if abs(np.linalg.det(A)) > 1e-10:
        try:
            x = np.linalg.solve(A, -Qs[:3, 3])
            if np.all(np.isfinite(x)) and np.linalg.norm(x - mid) <= reach:
                return x, max(error_at(Qs, x), 0.)
        except np.linalg.LinAlgError:
            pass
    best, cost = P[u], math.inf
    for x in (P[u], P[v], mid):
        e = error_at(Qs, x)
        if e < cost:
            best, cost = x, e
    return best, max(cost, 0.)


version = np.zeros(W, dtype=np.int64)
heap = []


def cost_of(u, v):
    """Quadric error per unit of the surface it was measured over.

    Raw quadric error is absolute, so a thin arm is always cheaper to flatten
    than a big smooth head and the limbs go first -- Gizmobot loses both arms
    while the head is still round. Dividing by the area behind the quadric puts
    a small feature and a large one on the same footing: what counts is how far
    the surface moves relative to how big it is."""
    return target_for(u, v)[1] / (Aq[u] + Aq[v] + 1e-12)


def push(u, v):
    if u != v:
        heapq.heappush(heap, (cost_of(u, v), u, v, int(version[u]), int(version[v])))


for a, b in edge_faces:
    push(a, b)


def quality(tri):
    """1 for equilateral, 0 for a degenerate needle."""
    e = [tri[1] - tri[0], tri[2] - tri[1], tri[0] - tri[2]]
    total = sum(float(v @ v) for v in e)
    if total < 1e-20:
        return 0.
    return float(2 * math.sqrt(3) * np.linalg.norm(np.cross(e[0], -e[2])) / total)


def collapsible(u, v):
    """The link condition plus a normal-flip check: the two guards that stop an
    edge collapse from tearing a hole or turning a face inside out."""
    shared = adj_f[u] & adj_f[v]
    if not shared or len(shared) > 2:
        return None
    if len(adj_v[u] & adj_v[v]) != len(shared):
        return None
    x, _ = target_for(u, v)
    for f in (adj_f[u] | adj_f[v]) - shared:
        a, b, c = faces[f]
        before = cross_of(a, b, c)
        area = np.linalg.norm(before)
        if area < 1e-14:
            continue
        moved = [x if vert in (u, v) else P[vert] for vert in (a, b, c)]
        after = np.cross(moved[1] - moved[0], moved[2] - moved[0])
        scale = np.linalg.norm(after)
        if scale < 1e-14 or (before / area) @ (after / scale) < FLIP_LIMIT:
            return None
        # A collapse is allowed to make a face worse, but not to grind it down
        # into a sliver that contributes nothing but a shading artifact.
        if quality(moved) < SLIVER <= quality([P[a], P[b], P[c]]):
            return None
    return x, shared


def collapse(u, v, x, shared):
    P[v] = x
    for f in shared:
        alive_f[f] = False
        for vert in faces[f]:
            adj_f[vert].discard(f)
    for f in list(adj_f[u]):
        faces[f] = [v if vert == u else vert for vert in faces[f]]
        adj_f[v].add(f)
    adj_f[u].clear()
    for w in list(adj_v[u]):
        adj_v[w].discard(u)
        if w != v:
            adj_v[w].add(v)
            adj_v[v].add(w)
    adj_v[u].clear()
    adj_v[v].discard(v)
    Q[v] = Q[u] + Q[v]
    Aq[v] += Aq[u]
    alive_v[u] = False
    # Only the two endpoints changed, so only their heap entries go stale. A
    # neighbour's other edges keep their quadrics and stay valid -- bumping
    # those too would strand them in the heap with nothing left to re-push them.
    version[u] += 1
    version[v] += 1
    for w in adj_v[v]:
        push(v, w)


# -- snapshot --
# Normals are rebuilt per level rather than carried through the collapses: the
# surface genuinely changed, and a normal inherited from a vertex that has since
# moved is a lie. Faces are grouped into smoothing islands by dihedral angle, so
# Gizmobot's hard panel edges stay hard at every density.
COS_SMOOTH = math.cos(math.radians(SMOOTH_ANGLE))


def snapshot():
    live = [f for f in range(len(faces)) if alive_f[f]]
    normals = {}
    for f in live:
        cr = cross_of(*faces[f])
        normals[f] = cr

    parent = {}

    def find(k):
        while parent.setdefault(k, k) != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    live_edges = collections.defaultdict(list)
    for f in live:
        tri = faces[f]
        for x, y in ((0, 1), (1, 2), (2, 0)):
            live_edges[(min(tri[x], tri[y]), max(tri[x], tri[y]))].append(f)
    for (a, b), fs in live_edges.items():
        if len(fs) != 2:
            continue
        f1, f2 = fs
        n1, n2 = normals[f1], normals[f2]
        s1, s2 = np.linalg.norm(n1), np.linalg.norm(n2)
        if s1 < 1e-14 or s2 < 1e-14:
            continue
        if (n1 / s1) @ (n2 / s2) >= COS_SMOOTH:
            union((a, f1), (a, f2))
            union((b, f1), (b, f2))

    accum = collections.defaultdict(lambda: np.zeros(3))
    for f in live:
        for w in faces[f]:
            accum[find((w, f))] += normals[f]      # cross length == area weight

    out, order, tris = {}, [], []
    for f in live:
        tri = []
        for slot, w in enumerate(faces[f]):
            key = (find((w, f)), uv_corner(f, slot))
            if key not in out:
                out[key] = len(order)
                order.append((w, key[0], key[1]))
            tri.append(out[key])
        tris.append(tri)

    pos = np.array([P[w] for w, _, _ in order])
    uvs = np.array([uv for _, _, uv in order])
    nrm = np.zeros((len(order), 3))
    for i, (_, group, _) in enumerate(order):
        v = accum[group]
        s = np.linalg.norm(v)
        nrm[i] = v / s if s > 1e-14 else np.array([0., 1., 0.])
    return pos, nrm, uvs, tris


# -- shells --
# A floor, not a budget: the heap still spends the triangles wherever the error
# is lowest, but no single shell is allowed to dissolve into a few slivers while
# it does. Forcing every shell to the same ratio instead was much worse -- it
# ground down the small dark joint rings, which are cheap to keep and the first
# thing you notice missing.
parent_c = list(range(W))


def find_c(i):
    while parent_c[i] != i:
        parent_c[i] = parent_c[parent_c[i]]
        i = parent_c[i]
    return i


for a, b, c in faces:
    parent_c[find_c(b)] = find_c(a)
    parent_c[find_c(c)] = find_c(a)
shell_live = collections.Counter(find_c(tri[0]) for tri in faces)
shells = len(shell_live)

# -- run the ladder --
levels = ['source'] + [None] * (len(RATIOS) - 1)
targets = [max(8, int(round(len(faces) * r))) for r in RATIOS]
remaining = len(faces)
while heap and any(l is None for l in levels):
    cost, u, v, vu, vv = heapq.heappop(heap)
    if not (alive_v[u] and alive_v[v]) or version[u] != vu or version[v] != vv:
        continue
    shell = find_c(u)
    if shell_live[shell] <= SHELL_FLOOR:
        continue
    ok = collapsible(u, v)
    if not ok:
        continue
    x, shared = ok
    collapse(u, v, x, shared)
    shell_live[shell] -= len(shared)
    remaining -= len(shared)
    for i, t in enumerate(targets):
        if levels[i] is None and remaining <= t:
            levels[i] = snapshot()
for i, level in enumerate(levels):
    if level is None:          # the guards ran out of legal collapses first
        levels[i] = snapshot()

# -- write --
result = copy.deepcopy(doc)
data = bytearray(binary)
result['meshes'] = []
result['nodes'] = [dict(
    name='Gizmobot',
    scale=doc['nodes'][0]['scale'],
    translation=doc['nodes'][0]['translation'],
    children=[],
)]
result['scenes'] = [dict(nodes=[0])]
result['scene'] = 0


def accessor(payload, template):
    while len(data) % 4:
        data.append(0)
    view = len(result['bufferViews'])
    result['bufferViews'].append(dict(buffer=0, byteOffset=len(data), byteLength=len(payload)))
    data.extend(payload)
    result['accessors'].append(dict(template, bufferView=view))
    return len(result['accessors']) - 1


report_levels = []
for i, level in enumerate(levels):
    if level == 'source':
        attrs = dict(primitive['attributes'])
        indices = primitive['indices']
        verts, tri_count = len(src_pos), len(src_tris)
    else:
        pos, nrm, uvs, tris = level
        verts, tri_count = len(pos), len(tris)
        assert verts < 65536, 'a level outgrew 16-bit indices'
        attrs = {
            'POSITION': accessor(
                b''.join(struct.pack('<3f', *p) for p in pos),
                dict(componentType=5126, type='VEC3', count=verts,
                     min=[float(pos[:, k].min()) for k in range(3)],
                     max=[float(pos[:, k].max()) for k in range(3)])),
            'NORMAL': accessor(
                b''.join(struct.pack('<3f', *v) for v in nrm),
                dict(componentType=5126, type='VEC3', count=verts)),
            'TEXCOORD_0': accessor(
                b''.join(struct.pack('<2f', *v) for v in uvs),
                dict(componentType=5126, type='VEC2', count=verts)),
        }
        indices = accessor(
            b''.join(struct.pack('<3H', *t) for t in tris),
            dict(componentType=5123, type='SCALAR', count=tri_count * 3))
    mesh = len(result['meshes'])
    result['meshes'].append(dict(
        name=f'LOD{i}Geometry',
        primitives=[dict(attributes=attrs, indices=indices, material=primitive['material'])]))
    result['nodes'][0]['children'].append(len(result['nodes']))
    result['nodes'].append(dict(name=f'LOD{i}', mesh=mesh))
    report_levels.append(dict(level=i, triangles=tri_count, vertices=verts,
                              ratio=round(tri_count / len(src_tris), 5)))

while len(data) % 4:
    data.append(0)
result['buffers'] = [dict(byteLength=len(data))]
js = json.dumps(result, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
glb = (struct.pack('<III', 0x46546c67, 2, 28 + len(js) + len(data))
       + struct.pack('<II', len(js), 0x4e4f534a) + js
       + struct.pack('<II', len(data), 0x004e4942) + data)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'gizmobot-topology.glb').write_bytes(glb)

assert data[:len(binary)] == binary, 'the source BIN chunk was disturbed'
assert SOURCE.read_bytes() == original, 'the source file was written to'
assert [l['triangles'] for l in report_levels] == sorted(
    (l['triangles'] for l in report_levels), reverse=True), 'the ladder is not monotonic'

report = dict(
    source=str(SOURCE.relative_to(ROOT)).replace('\\', '/'),
    sourceSha256=hashlib.sha256(original).hexdigest(),
    sourceTriangles=len(src_tris),
    sourceVertices=len(src_pos),
    weldedPositions=W,
    shells=shells,
    shellFloorTriangles=SHELL_FLOOR,
    seamAndBoundaryEdges=seam_edges,
    smoothingAngleDegrees=SMOOTH_ANGLE,
    seamWeight=SEAM_WEIGHT,
    levels=report_levels,
    lod0IsSourceGeometry=True,
    originalEmbeddedTexturesPreserved=True,
    sourceUnchanged=True,
    bytes=len(glb),
)
(OUT / 'topology-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
