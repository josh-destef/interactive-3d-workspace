"""Render a GLB turntable for visual QA with Blender 4.1."""

import bpy
import math
import os
import sys
from mathutils import Vector


def cli_arg(name, default=None):
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    try:
        return args[args.index(name) + 1]
    except (ValueError, IndexError):
        if default is not None:
            return default
        raise SystemExit(f"missing {name}")


source = os.path.abspath(cli_arg("--source"))
output_dir = os.path.abspath(cli_arg("--output"))
prefix = cli_arg("--prefix", "gizmobot")
os.makedirs(output_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.look = "AgX - Medium High Contrast"
world = bpy.data.worlds.new("QA_World")
world.color = (0.035, 0.04, 0.055)
scene.world = world

for obj in scene.objects:
    if obj.type == "MESH":
        obj.select_set(True)
        obj.data.materials.foreach_set if False else None
        if "Overlay" in obj.name:
            # Decal geometry is transparent. It should receive light but must
            # not cast an opaque shadow in Blender's turntable QA render.
            obj.visible_shadow = False


def point_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


# Seamless cyclorama-style ground and a controlled three-light studio rig.
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.005))
floor = bpy.context.object
floor.name = "QA_Floor"
floor_mat = bpy.data.materials.new("QA_Floor")
floor_mat.diffuse_color = (0.12, 0.135, 0.17, 1)
floor_mat.use_nodes = True
floor_bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
floor_bsdf.inputs["Base Color"].default_value = (0.12, 0.135, 0.17, 1)
floor_bsdf.inputs["Roughness"].default_value = 0.82
floor.data.materials.append(floor_mat)


def area(name, location, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    light.location = location
    point_at(light, (0, 0, 1.35))
    scene.collection.objects.link(light)


area("Key", (-3.6, -4.8, 6.2), 900, 4.0, (1.0, 0.88, 0.76))
area("Fill", (4.5, -2.0, 3.5), 650, 4.5, (0.66, 0.78, 1.0))
area("Rim", (1.8, 4.0, 5.0), 1000, 3.0, (0.82, 0.93, 1.0))

camera_data = bpy.data.cameras.new("QA_Camera")
camera = bpy.data.objects.new("QA_Camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.lens = 58

views = {
    "front": (3.7, -7.8, 3.05),
    "front-left": (-4.0, -7.4, 3.0),
    "side": (7.4, -0.2, 2.9),
    "rear": (-3.5, 7.7, 3.1),
}
for name, location in views.items():
    camera.location = location
    point_at(camera, (0, 0, 1.38))
    scene.render.filepath = os.path.join(output_dir, f"{prefix}-{name}.png")
    bpy.ops.render.render(write_still=True)
    print(scene.render.filepath)
