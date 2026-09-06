"""Render the exploded assembly asset for inspection and the WIP card.

blender -b -t 2 --python scripts/render-assembly-gizmobot.py
"""
from pathlib import Path
import bpy
import json
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
LAB=ROOT/'polished/labs/robot-assembly'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(LAB/'assets/gizmobot-assembly.glb'))
manifest=json.loads((LAB/'assets/assembly-manifest.json').read_text())
for p in manifest['parts']:
    # Blender imports glTF's Y up coordinates as Z up.
    x,y,z=p['explodedOffset']
    bpy.data.objects[p['node']].location+=Vector((x,-z,y))
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=800
scene.render.resolution_y=600
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Studio')
scene.world.color=(.6,.6,.6)
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy in [('Key',(-3,5,7),1100),('Fill',(4,3,4),850),('Rim',(0,-4,6),1300)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.size=5
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,1.5))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.45))
floor=bpy.context.object
mat=bpy.data.materials.new('Warm grey studio');mat.diffuse_color=(.62,.65,.60,1);floor.data.materials.append(mat)
data=bpy.data.cameras.new('Camera');camera=bpy.data.objects.new('Camera',data);scene.collection.objects.link(camera)
camera.location=(0,12,3.6);aim(camera,(0,0,1.65));data.type='ORTHO';data.ortho_scale=8.0;scene.camera=camera
scene.render.filepath=str(ROOT/'polished/assets/robot-assembly.png')
bpy.ops.render.render(write_still=True)
camera.location=(4,12,3.6);aim(camera,(0,0,1.65))
scene.render.filepath=str(LAB/'qa/exploded-perspective.png')
bpy.ops.render.render(write_still=True)
