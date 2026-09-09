"""Inspect the exported GLB meshes in Blender, welding only glTF split seams.
blender -b --python scripts/qa-particle-cannon-mesh.py
"""
from pathlib import Path
import json
import bpy
import bmesh

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/particle-cannon.glb'))
report=[]
for obj in bpy.data.objects:
    if obj.type!='MESH':continue
    bm=bmesh.new();bm.from_mesh(obj.data)
    # glTF duplicates vertices at normals/UV seams. Weld solely for adjacency.
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
    nonmanifold=sum(not edge.is_manifold for edge in bm.edges)
    degenerate=sum(face.calc_area()<1e-12 for face in bm.faces)
    volume=bm.calc_volume(signed=True)
    report.append(dict(mesh=obj.name,nonManifoldEdges=nonmanifold,
                       degenerateFaces=degenerate,signedVolume=volume))
    assert nonmanifold==0,(obj.name,'nonmanifold',nonmanifold)
    assert degenerate==0,(obj.name,'degenerate',degenerate)
    assert volume>0,(obj.name,'inward or empty volume',volume)
    bm.free()
out=ROOT/'docs/qa/particle-cannon/mesh-checks.json'
out.write_text(json.dumps(dict(meshes=len(report),closedOutwardNondegenerate=True,parts=report),indent=2)+'\n')
print('PASS:',len(report),'closed, outward-facing, nondegenerate exported meshes')
