"""Lossless semantic GLB splitter. Run from any directory with Python 3."""
from pathlib import Path
import collections
import copy
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'polished/labs/navigate-and-transform/assets/gizmobot.glb'
OUT = ROOT / 'polished/labs/robot-assembly/assets'
original = SOURCE.read_bytes()
n = struct.unpack_from('<I', original, 12)[0]
doc = json.loads(original[20:20+n])
binary = original[28+n:]
primitive = doc['meshes'][0]['primitives'][0]

def rows(index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    fmt = '<' + {5126: 'f', 5123: 'H', 5125: 'I'}[a['componentType']] * size
    width = struct.calcsize(fmt)
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [binary[start+i*v.get('byteStride', width):start+i*v.get('byteStride', width)+width] for i in range(a['count'])], fmt

posbytes, fmt = rows(primitive['attributes']['POSITION'])
positions = [struct.unpack(fmt, b) for b in posbytes]
ir, fmt = rows(primitive['indices'])
indices = [struct.unpack(fmt, b)[0] for b in ir]
parents = list(range(len(positions)))

def root(i):
    while parents[i] != i:
        parents[i] = parents[parents[i]]
        i = parents[i]
    return i

triangles = list(zip(indices[::3], indices[1::3], indices[2::3]))
for a, b, c in triangles:
    parents[root(b)] = root(a)
    parents[root(c)] = root(a)
components = collections.defaultdict(list)
for index, triangle in enumerate(triangles):
    components[root(triangle[0])].append(index)

groups = collections.defaultdict(list)
assignments = []
for members in components.values():
    vertices = {v for t in members for v in triangles[t]}
    lo = [min(positions[v][i] for v in vertices) for i in range(3)]
    hi = [max(positions[v][i] for v in vertices) for i in range(3)]
    x, y, z = [(a+b)/2 for a, b in zip(lo, hi)]
    side = 'Left' if x > 0 else 'Right'
    if y > 1.85:
        name = 'Head'
    elif abs(x) > .47 and y > 1.3:
        name = side + ('UpperArm' if abs(x) < .88 else 'Forearm' if abs(x) < 1.24 else 'Hand')
    elif hi[1] < .49:
        name = side + 'Foot'
    elif y < 1.13 and abs(x) > .1:
        name = side + ('UpperLeg' if lo[1] > .79 else 'LowerLeg')
    else:
        name = 'Torso'
    groups[name].extend(members)
    assignments.append(dict(part=name, triangles=len(members), boundsMin=lo, boundsMax=hi))

# Pivots follow the anatomical connections, in original mesh coordinates.
spec = [
    ('Torso', 'Body', [0,1.09,.13], [0,0,0], None, 'The body is your starting object.'),
    ('Head', 'Head', [0,1.85,.13], [0,1.05,0], 'Torso', 'Bring the head down to the neck.'),
    ('LeftUpperArm', 'Left upper arm', [.49,1.574,.148], [.7,.48,0], 'Torso', 'Join the arm to the shoulder.'),
    ('RightUpperArm', 'Right upper arm', [-.49,1.574,.148], [-.7,.48,0], 'Torso', 'Use the other shoulder.'),
    ('LeftForearm', 'Left forearm', [.88,1.574,.148], [1.05,0,0], 'LeftUpperArm', 'Connect the forearm at the elbow.'),
    ('RightForearm', 'Right forearm', [-.88,1.574,.148], [-1.05,0,0], 'RightUpperArm', 'Connect the other elbow.'),
    ('LeftHand', 'Left hand', [1.24,1.574,.148], [1.5,-.55,0], 'LeftForearm', 'The fingers move together as one part.'),
    ('RightHand', 'Right hand', [-1.24,1.574,.148], [-1.5,-.55,0], 'RightForearm', 'Bring the hand to the wrist.'),
    ('LeftUpperLeg', 'Left upper leg', [.25,1.09,.13], [.6,-.25,0], 'Torso', 'Connect the thigh at the hip.'),
    ('RightUpperLeg', 'Right upper leg', [-.25,1.09,.13], [-.6,-.25,0], 'Torso', 'Connect the other thigh at the hip.'),
    ('LeftLowerLeg', 'Left lower leg', [.25,.73,.135], [.8,-.7,0], 'LeftUpperLeg', 'Join the shin at the knee. This joint will bend later.'),
    ('RightLowerLeg', 'Right lower leg', [-.25,.73,.135], [-.8,-.7,0], 'RightUpperLeg', 'Add the other shin. Keep the knee between the two leg parts.'),
    ('LeftFoot', 'Left foot', [.26,.29,.13], [1,-1.25,-.12], 'LeftLowerLeg', 'Connect the foot at the ankle.'),
    ('RightFoot', 'Right foot', [-.26,.29,.13], [-1,-1.25,-.12], 'RightLowerLeg', 'One last ankle connection. Next, bring Gizmobot to life.'),
]
assert set(groups) == {s[0] for s in spec}
result = copy.deepcopy(doc)
result['nodes'] = [dict(name='Gizmobot', scale=doc['nodes'][0]['scale'], translation=doc['nodes'][0]['translation'], children=[])]
result['scenes'] = [dict(nodes=[0])]
result['scene'] = 0
result['meshes'] = []
data = bytearray(binary)

def accessor(payload, template):
    while len(data) % 4: data.append(0)
    view = len(result['bufferViews'])
    result['bufferViews'].append(dict(buffer=0, byteOffset=len(data), byteLength=len(payload)))
    data.extend(payload)
    entry = dict(template, bufferView=view)
    result['accessors'].append(entry)
    return len(result['accessors'])-1

parts = []
for order, (name, label, pivot, offset, requires, instruction) in enumerate(spec):
    tids = sorted(groups[name])
    vids = sorted({v for t in tids for v in triangles[t]})
    mapping = {v:i for i,v in enumerate(vids)}
    attrs = {}
    for semantic, old in primitive['attributes'].items():
        raw, _ = rows(old)
        template = {k:v for k,v in doc['accessors'][old].items() if k in ('componentType','type','normalized')}
        template['count'] = len(vids)
        if semantic == 'POSITION':
            template['min'] = [min(positions[v][i] for v in vids) for i in range(3)]
            template['max'] = [max(positions[v][i] for v in vids) for i in range(3)]
        attrs[semantic] = accessor(b''.join(raw[v] for v in vids), template)
    packed = b''.join(struct.pack('<H', mapping[v]) for t in tids for v in triangles[t])
    ia = accessor(packed, dict(componentType=5123, type='SCALAR', count=len(tids)*3))
    mi = len(result['meshes'])
    result['meshes'].append(dict(name=name+'Geometry', primitives=[dict(attributes=attrs, indices=ia, material=primitive['material'])]))
    ni = len(result['nodes'])
    result['nodes'][0]['children'].append(ni)
    result['nodes'].extend([dict(name=name, translation=pivot, children=[ni+1]), dict(name=name+'Surface', mesh=mi, translation=[-v for v in pivot])])
    parts.append(dict(node=name,label=label,order=order,requires=requires,assembledPosition=pivot,assembledQuaternion=[0,0,0,1],assembledScale=[1,1,1],explodedOffset=offset,snapDistance=.24,instruction=instruction))

while len(data)%4: data.append(0)
result['buffers'] = [dict(byteLength=len(data))]
js = json.dumps(result,separators=(',',':')).encode()
js += b' ' * (-len(js)%4)
glb = struct.pack('<III',0x46546c67,2,28+len(js)+len(data)) + struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'gizmobot-assembly.glb').write_bytes(glb)
(OUT/'assembly-manifest.json').write_text(json.dumps(dict(version=2,parent='Gizmobot',coordinateSpace='Gizmobot-local, Y up',parts=parts),indent=2)+'\n')
rig = copy.deepcopy(result)
by_name = {node['name']: i for i, node in enumerate(rig['nodes'])}
for part in parts:
    if not part['requires']: continue
    node_index = by_name[part['node']]
    parent_index = by_name[part['requires']]
    rig['nodes'][0]['children'].remove(node_index)
    rig['nodes'][parent_index]['children'].append(node_index)
    parent_pivot = next(p['assembledPosition'] for p in parts if p['node']==part['requires'])
    rig['nodes'][node_index]['translation'] = [a-b for a,b in zip(part['assembledPosition'],parent_pivot)]
rj=json.dumps(rig,separators=(',',':')).encode();rj+=b' '*(-len(rj)%4)
(OUT/'gizmobot-rigged.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(rj)+len(data))+struct.pack('<II',len(rj),0x4e4f534a)+rj+struct.pack('<II',len(data),0x004e4942)+data)
assert sorted(t for g in groups.values() for t in g)==list(range(len(triangles)))
assert data[:len(binary)]==binary
assert SOURCE.read_bytes()==original
report=dict(sourceSha256=hashlib.sha256(original).hexdigest(),components=len(components),triangles=len(triangles),parts={name:len(ts) for name,ts in groups.items()},allTrianglesAssignedExactlyOnce=True,originalAttributesCopiedExactly=True,originalEmbeddedTexturesPreserved=True,sourceUnchanged=True,assignments=assignments)
(OUT/'assembly-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='assignments'},indent=2))
