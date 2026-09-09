"""Lossless accessory-ready variant of the canonical Gizmobot.

python scripts/build-accessory-rig.py
Uses the existing semantic splitter/writer, including its original pivots.
The original elbow components become separate surfaces under the SAME elbow
pivots. No changes are made to the canonical model or assembly-lab assets.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'scripts/build-assembly-gizmobot.py').read_text()
scope = {'__file__': str(ROOT / 'scripts/build-assembly-gizmobot.py')}
exec(source[:source.index('result = copy.deepcopy(doc)')], scope)
groups, positions, triangles = (scope[k] for k in ('groups', 'positions', 'triangles'))
connections = {}
for side in ('Left', 'Right'):
    forearm = side + 'Forearm'
    elbow = side + 'ElbowJoint'
    candidates = set(groups[forearm])
    selected = []
    for members in scope['components'].values():
        if members[0] not in candidates:
            continue
        vertices = {v for t in members for v in triangles[t]}
        lo = [min(positions[v][i] for v in vertices) for i in range(3)]
        hi = [max(positions[v][i] for v in vertices) for i in range(3)]
        # The original ball comprises two hemispheres and two end patches.
        # Separate whole components; do not crop/reconstruct their geometry.
        if max(abs(lo[0]), abs(hi[0])) < 1.0 and hi[1] - lo[1] < .09:
            selected.extend(members)
    assert len(selected) == 212, (side, len(selected))
    groups[elbow] = selected
    groups[forearm] = [t for t in groups[forearm] if t not in set(selected)]
    pivot = next(s[2] for s in scope['spec'] if s[0] == forearm)
    scope['spec'].append((elbow, side + ' original elbow ball', pivot, [0,0,0], forearm, ''))
    vids = {v for t in selected for v in triangles[t]}
    lo = [min(positions[v][i] for v in vids) for i in range(3)]
    hi = [max(positions[v][i] for v in vids) for i in range(3)]
    connections[side] = dict(pivot=pivot, boundsMin=lo, boundsMax=hi,
        center=[(a+b)/2 for a,b in zip(lo,hi)],
        halfExtents=[(b-a)/2 for a,b in zip(lo,hi)], triangles=len(selected))

scope['OUT'] = ROOT / 'assets/models'
writer = source[source.index('assert set(groups)'):source.index('assert sorted(t for g')]
writer = writer.replace("(OUT/'gizmobot-assembly.glb').write_bytes(glb)", '')
writer = writer.replace("(OUT/'assembly-manifest.json').write_text(json.dumps(dict(version=2,parent='Gizmobot',coordinateSpace='Gizmobot-local, Y up',parts=parts),indent=2)+'\\n')", '')
writer = writer.replace('gizmobot-rigged.glb', 'gizmobot-accessory-rig.glb')
exec(writer, scope)
assigned = [t for group in groups.values() for t in group]
assert sorted(assigned) == list(range(len(triangles)))
assert len(assigned) == len(set(assigned))
assert scope['data'][:len(scope['binary'])] == scope['binary']
assert scope['SOURCE'].read_bytes() == scope['original']
report = dict(source='assets/models/gizmobot.glb',
    sourceSha256=hashlib.sha256(scope['original']).hexdigest(),
    coordinateSpace='Gizmobot local; +Y up, +X left arm outward, -Z robot front',
    rootTransform=scope['doc']['nodes'][0], connections=connections,
    allTrianglesAssignedExactlyOnce=True, originalAttributesAndTexturesPreserved=True,
    sourceUnchanged=True, triangles=len(triangles))
(scope['OUT'] / 'gizmobot-accessory-rig.report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
