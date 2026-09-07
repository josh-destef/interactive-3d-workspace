"""Extract Gizmobot's left arm, preserving source surfaces and three fingers.

Uses the assembly builder's lossless component reader/writer without executing
its output stage. This writes only the new hierarchy lab's asset.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
builder = (ROOT / 'scripts/build-assembly-gizmobot.py').read_text()
scope = {'__file__': str(ROOT / 'scripts/build-assembly-gizmobot.py')}
exec(builder.split('# Pivots follow')[0], scope)
groups = scope['groups']
arm = {name: groups[name] for name in ('LeftUpperArm', 'LeftForearm')}
for name in ('LeftHand', 'Mitt', 'Pointer', 'Thumb'):
    arm[name] = []
for members in scope['components'].values():
    if members[0] not in set(groups['LeftHand']):
        continue
    vertices = {v for t in members for v in scope['triangles'][t]}
    lo = [min(scope['positions'][v][i] for v in vertices) for i in range(3)]
    hi = [max(scope['positions'][v][i] for v in vertices) for i in range(3)]
    # Both shell and inset travel together. The broad finger is intentionally
    # ONE mitt; the narrow forward finger and side thumb are separate siblings.
    name = 'Thumb' if hi[2] < .01 else ('Mitt' if lo[2] > .07 else 'Pointer') if lo[0] > 1.54 else 'LeftHand'
    arm[name].extend(members)
scope['groups'] = arm
scope['OUT'] = ROOT / 'polished/labs/hierarchy-gizmobot/assets'
scope['spec'] = [
    ('LeftUpperArm', 'Shoulder', [.49,1.574,.148], [0,0,0], None, ''),
    ('LeftForearm', 'Elbow', [.88,1.574,.148], [0,0,0], 'LeftUpperArm', ''),
    ('LeftHand', 'Wrist', [1.24,1.574,.148], [0,0,0], 'LeftForearm', ''),
    ('Mitt', 'Mitt', [1.55,1.56,.22], [0,0,0], 'LeftHand', ''),
    ('Pointer', 'Pointer', [1.55,1.56,.02], [0,0,0], 'LeftHand', ''),
    ('Thumb', 'Thumb', [1.35,1.56,-.005], [0,0,0], 'LeftHand', ''),
]
writer = builder[builder.index('assert set(groups)'):builder.index('assert sorted(t for g')]
# Only keep the articulated output and a compact provenance report.
writer = writer.replace("(OUT/'gizmobot-assembly.glb').write_bytes(glb)", '')
writer = writer.replace("(OUT/'assembly-manifest.json').write_text(json.dumps(dict(version=2,parent='Gizmobot',coordinateSpace='Gizmobot-local, Y up',parts=parts),indent=2)+'\\n')", '')
writer = writer.replace('gizmobot-rigged.glb', 'gizmobot-arm.glb')
exec(writer, scope)
assigned = [t for group in arm.values() for t in group]
expected = groups['LeftUpperArm'] + groups['LeftForearm'] + groups['LeftHand']
assert sorted(assigned) == sorted(expected) and len(set(assigned)) == len(assigned)
assert all(arm.values())
assert scope['SOURCE'].read_bytes() == scope['original']
report = dict(source='navigate-and-transform/assets/gizmobot.glb',
              sourceSha256=scope['hashlib'].sha256(scope['original']).hexdigest(),
              triangles={key:len(value) for key,value in arm.items()},
              fingerCount=3, originalAttributesCopiedExactly=True,
              originalEmbeddedTexturesPreserved=True, allArmTrianglesAssignedExactlyOnce=True)
(scope['OUT'] / 'arm-report.json').write_text(scope['json'].dumps(report, indent=2)+'\n')
print(scope['json'].dumps(report, indent=2))
