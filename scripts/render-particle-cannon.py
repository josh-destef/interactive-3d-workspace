"""Render the exported assets (not the authoring scene) for visual review.
blender -b -t 4 --python scripts/render-particle-cannon.py
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/qa/particle-cannon'
OUT.mkdir(parents=True,exist_ok=True)

def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def prepare(attached=False, posed=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if attached:
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/gizmobot-accessory-rig.glb'))
        bpy.data.objects['LeftForearmSurface'].hide_render=True
        def hide_tree(ob):
            ob.hide_render=True
            for child in ob.children:hide_tree(child)
        hide_tree(bpy.data.objects['LeftHand'])
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/particle-cannon.glb'))
    if attached:
        cannon=bpy.data.objects['ParticleCannon']
        cannon.parent=bpy.data.objects['LeftForearm']
        cannon.matrix_parent_inverse=Matrix.Identity(4)
        cannon.location=(0,0,0)
        if posed:
            # glTF Y elbow bend becomes Blender Z; shoulder glTF Z becomes -Y.
            for name in ('LeftForearm','LeftUpperArm','RightUpperArm'):
                bpy.data.objects[name].rotation_mode='XYZ'
            bpy.data.objects['LeftForearm'].rotation_euler.z=math.radians(40)
            bpy.data.objects['LeftUpperArm'].rotation_euler.y=math.radians(16)
            bpy.data.objects['RightUpperArm'].rotation_euler.y=math.radians(-65)
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=48
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1100;scene.render.resolution_y=850
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.world=bpy.data.worlds.new('Studio')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.70,.76,.84,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    target=(.4,0,0) if not attached else (.15,0,1.65)
    lights=[('Key',(1,3,5),380,4),('Fill',(-3,1,2),160,3),('Rim',(1,-3,4),500,3)]
    for name,loc,power,size in lights:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;aim(ob,target)
    data=bpy.data.cameras.new('ReviewCamera');camera=bpy.data.objects.new('ReviewCamera',data)
    scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO'
    if attached:camera.location=(4.2,7.8,3.7);data.ortho_scale=4.8
    else:camera.location=(1.45,1.8,1.0);data.ortho_scale=1.15
    aim(camera,target)
    return scene,camera

for name,attached,posed in [('standalone',False,False),('attached-rest',True,False),('attached-posed',True,True)]:
    scene,camera=prepare(attached,posed)
    scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    if name=='attached-rest':
        camera.location=(2.5,2.7,2.6);camera.data.ortho_scale=1.6
        aim(camera,(1.05,0,1.87))
        scene.render.filepath=str(OUT/'elbow-fit.png')
        bpy.ops.render.render(write_still=True)
print('Rendered standalone, attached rest, elbow fit and attached posed from exported GLBs.')
