"""Create the teaching-focused Gizmobot used by Material Lab.

The source remains untouched. Atlas colours and connected mesh components are
used to assign four opaque semantic regions. Face marks and the chest logo live
in two tightly cropped, normal-offset masked overlays so Shell Paint can change
without tinting either detail.
"""

import bpy
import bmesh
import colorsys
import hashlib
import json
import math
import os
import sys
from array import array
from collections import Counter, deque


def cli_arg(name):
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    try:
        return args[args.index(name) + 1]
    except (ValueError, IndexError):
        raise SystemExit(f"missing {name}")


source = os.path.abspath(cli_arg("--source"))
output = os.path.abspath(cli_arg("--output"))
report_path = os.path.abspath(cli_arg("--report"))
texture_dir = os.path.abspath(cli_arg("--textures"))
os.makedirs(os.path.dirname(output), exist_ok=True)
os.makedirs(os.path.dirname(report_path), exist_ok=True)
os.makedirs(texture_dir, exist_ok=True)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


source_hash_before = sha256(source)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)

objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if len(objects) != 1:
    raise RuntimeError(f"expected one mesh, found {len(objects)}")
robot = objects[0]
robot.name = "Gizmobot_MaterialLab"
robot.data.name = "Gizmobot_SemanticRegions"

base_image = next((img for img in bpy.data.images if "BaseColor" in img.name), None)
emissive_image = next((img for img in bpy.data.images if "Emissive" in img.name), None)
if not base_image or not emissive_image:
    raise RuntimeError("source atlas is missing BaseColor or Emissive")

base_pixels = array("f", base_image.pixels[:])
emissive_pixels = array("f", emissive_image.pixels[:])
width, height = base_image.size


def linear_to_srgb(value):
    if value <= 0.0031308:
        return value * 12.92
    return 1.055 * (value ** (1 / 2.4)) - 0.055


def sample_rgb(image_pixels, uv):
    u, v = uv
    x = min(width - 1, max(0, int((u % 1.0) * width)))
    y = min(height - 1, max(0, int((v % 1.0) * height)))
    offset = 4 * (y * width + x)
    return tuple(linear_to_srgb(float(image_pixels[offset + i])) for i in range(3))


def classify(rgb):
    r, g, b = rgb
    hue, saturation, value = colorsys.rgb_to_hsv(r, g, b)
    if saturation > 0.22 and 0.20 <= hue <= 0.46 and g > 0.26:
        return "Green_Accents"
    if saturation > 0.18 and (hue <= 0.15 or hue >= 0.97) and r > 0.40 and g > 0.12:
        return "Orange_Accents"
    # The atlas' rubber and joint grey sits near sRGB 0.68, while painted shell
    # components are consistently above 0.82. Classifying the whole connected
    # component prevents shaded shell edge pixels from becoming material leaks.
    if value < 0.80 or (value < 0.84 and saturation > 0.10):
        return "Dark_Parts"
    return "Shell_Paint"


mesh = robot.data
uv_data = mesh.uv_layers.active.data
poly_samples = []
poly_regions = []
for poly in mesh.polygons:
    loops = list(poly.loop_indices)
    uvs = [uv_data[index].uv.copy() for index in loops]
    center = sum(uvs, uvs[0] * 0) / len(uvs)
    sample_uvs = [center]
    sample_uvs.extend(center.lerp(uv, 0.62) for uv in uvs)
    votes = Counter(classify(sample_rgb(base_pixels, uv)) for uv in sample_uvs)
    region = votes.most_common(1)[0][0]
    poly_samples.append(votes)
    poly_regions.append(region)

# Connected components keep each physical part semantically clean even where
# atlas padding or a painted edge crosses one triangle sample.
vertex_polys = [[] for _ in mesh.vertices]
for poly in mesh.polygons:
    for vertex_index in poly.vertices:
        vertex_polys[vertex_index].append(poly.index)
adjacency = [set() for _ in mesh.polygons]
for linked in vertex_polys:
    for poly_index in linked:
        adjacency[poly_index].update(linked)

components = []
seen = set()
for start in range(len(mesh.polygons)):
    if start in seen:
        continue
    queue = deque([start])
    seen.add(start)
    members = []
    while queue:
        current = queue.popleft()
        members.append(current)
        for neighbour in adjacency[current]:
            if neighbour not in seen:
                seen.add(neighbour)
                queue.append(neighbour)
    weights = Counter()
    for poly_index in members:
        for region, votes in poly_samples[poly_index].items():
            weights[region] += votes * max(mesh.polygons[poly_index].area, 0.000001)
    component_region = weights.most_common(1)[0][0]
    for poly_index in members:
        poly_regions[poly_index] = component_region
    components.append({
        "index": len(components),
        "polygons": len(members),
        "area": round(sum(mesh.polygons[p].area for p in members), 6),
        "region": component_region,
    })


def clear_emission(material):
    if not material.use_nodes:
        return
    tree = material.node_tree
    principled = next((node for node in tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if not principled:
        return
    for socket_name in ("Emission Color", "Emission Strength"):
        socket = principled.inputs.get(socket_name)
        if socket:
            for link in list(socket.links):
                tree.links.remove(link)
    if principled.inputs.get("Emission Color"):
        principled.inputs["Emission Color"].default_value = (0, 0, 0, 1)
    if principled.inputs.get("Emission Strength"):
        principled.inputs["Emission Strength"].default_value = 0


source_material = mesh.materials[0]


def fixed_material(name):
    material = source_material.copy()
    material.name = name
    material["semantic_region"] = name
    clear_emission(material)
    return material


def shell_material():
    material = bpy.data.materials.new("Shell_Paint")
    material.use_nodes = True
    material["semantic_region"] = "learner-controlled"
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.48, 0.48, 0.46, 1)
    principled.inputs["Roughness"].default_value = 0.5
    principled.inputs["Metallic"].default_value = 0.0
    return material


materials = {
    "Shell_Paint": shell_material(),
    "Dark_Parts": fixed_material("Dark_Parts"),
    "Orange_Accents": fixed_material("Orange_Accents"),
    "Green_Accents": fixed_material("Green_Accents"),
}

mesh.materials.clear()
region_order = ["Shell_Paint", "Dark_Parts", "Orange_Accents", "Green_Accents"]
for name in region_order:
    mesh.materials.append(materials[name])
for poly, region in zip(mesh.polygons, poly_regions):
    poly.material_index = region_order.index(region)


def make_overlay_image(name, source_pixels, roi, mode):
    """Create an atlas-compatible RGBA image with transparency outside the detail."""
    u0, u1, v0, v1 = roi
    result = array("f", [0.0]) * len(source_pixels)
    x0, x1 = int(u0 * width), min(width, int(math.ceil(u1 * width)))
    y0, y1 = int(v0 * height), min(height, int(math.ceil(v1 * height)))
    nonzero = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            offset = 4 * (y * width + x)
            r, g, b = (float(source_pixels[offset + i]) for i in range(3))
            if mode == "logo":
                srgb = tuple(linear_to_srgb(c) for c in (r, g, b))
                rr, gg, bb = srgb
                hue, saturation, value = colorsys.rgb_to_hsv(rr, gg, bb)
                is_green = saturation > 0.20 and 0.18 <= hue <= 0.47 and gg > 0.20
                is_orange = saturation > 0.16 and (hue <= 0.16 or hue >= 0.97) and rr > 0.34
                alpha = 1.0 if (is_green or is_orange) else 0.0
            else:
                alpha = max(r, g, b)
                alpha = max(0.0, min(1.0, (alpha - 0.002) / 0.055))
            if alpha <= 0:
                continue
            result[offset] = r
            result[offset + 1] = g
            result[offset + 2] = b
            result[offset + 3] = alpha
            nonzero += 1
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(result)
    image.file_format = "PNG"
    image.filepath_raw = os.path.join(texture_dir, name + ".png")
    image.save()
    image.pack()
    return image, nonzero


logo_roi = (0.120, 0.270, 0.350, 0.560)
face_roi = (0.075, 0.225, 0.500, 0.735)
logo_image, logo_pixels = make_overlay_image("Logo_Decal", base_pixels, logo_roi, "logo")
face_image, face_pixels = make_overlay_image("Face_Glow", emissive_pixels, face_roi, "face")
if logo_pixels < 100 or face_pixels < 100:
    raise RuntimeError(f"overlay masks unexpectedly sparse: logo={logo_pixels}, face={face_pixels}")


def overlay_material(name, image, emissive=False):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material["semantic_region"] = name
    # Blender 4.1 renders through surface_render_method, while its glTF exporter
    # still reads blend_method to author alphaMode. Set both deliberately.
    material.blend_method = "BLEND"
    material.surface_render_method = "DITHERED"
    material.shadow_method = "NONE"
    material.use_transparent_shadow = True
    tree = material.node_tree
    principled = tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (1, 1, 1, 1)
    principled.inputs["Roughness"].default_value = 0.42
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.name = name + "_Texture"
    texture.image = image
    tree.links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    tree.links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
    if emissive:
        tree.links.new(texture.outputs["Color"], principled.inputs["Emission Color"])
        principled.inputs["Emission Strength"].default_value = 1.0
    return material


logo_material = overlay_material("Logo_Decal", logo_image, emissive=False)
face_material = overlay_material("Face_Glow", face_image, emissive=True)


def roi_polygons(roi, allowed_region):
    u0, u1, v0, v1 = roi
    selected = set()
    for poly in mesh.polygons:
        if poly_regions[poly.index] != allowed_region:
            continue
        uvs = [uv_data[index].uv for index in poly.loop_indices]
        min_u, max_u = min(uv.x for uv in uvs), max(uv.x for uv in uvs)
        min_v, max_v = min(uv.y for uv in uvs), max(uv.y for uv in uvs)
        if max_u >= u0 and min_u <= u1 and max_v >= v0 and min_v <= v1:
            selected.add(poly.index)
    return selected


def make_overlay(name, keep_indices, material, offset):
    overlay = robot.copy()
    overlay.name = name
    overlay.data = robot.data.copy()
    overlay.data.name = name + "_Geometry"
    bpy.context.scene.collection.objects.link(overlay)
    bm = bmesh.new()
    bm.from_mesh(overlay.data)
    bm.faces.ensure_lookup_table()
    remove = [face for face in bm.faces if face.index not in keep_indices]
    bmesh.ops.delete(bm, geom=remove, context="FACES")
    bm.to_mesh(overlay.data)
    bm.free()
    overlay.data.materials.clear()
    overlay.data.materials.append(material)
    overlay.data.update()
    for vertex in overlay.data.vertices:
        vertex.co += vertex.normal * offset
    for poly in overlay.data.polygons:
        poly.material_index = 0
    return overlay


logo_keep = roi_polygons(logo_roi, "Shell_Paint")
face_keep = roi_polygons(face_roi, "Dark_Parts")
logo_overlay = make_overlay("Logo_Decal_Overlay", logo_keep, logo_material, 0.0025)
face_overlay = make_overlay("Face_Glow_Overlay", face_keep, face_material, 0.0025)

# Bake the source transform and face the robot toward Three.js cameras on +Z.
# Blender +Y exports toward Three.js -Z, so a 180-degree Z rotation is baked.
for obj in (robot, logo_overlay, face_overlay):
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0, 0, math.pi)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for other in bpy.context.selected_objects:
        if other != obj:
            other.select_set(False)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Center all three objects together and place the soles exactly on the floor.
coords = [robot.matrix_world @ vertex.co for vertex in robot.data.vertices]
min_x, max_x = min(v.x for v in coords), max(v.x for v in coords)
min_y, max_y = min(v.y for v in coords), max(v.y for v in coords)
min_z = min(v.z for v in coords)
shift = ((min_x + max_x) / 2, (min_y + max_y) / 2, min_z)
for obj in (robot, logo_overlay, face_overlay):
    for vertex in obj.data.vertices:
        vertex.co.x -= shift[0]
        vertex.co.y -= shift[1]
        vertex.co.z -= shift[2]
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)

# Parent under one clean node; geometry and materials remain reusable when the
# loader clones this node for the challenge.
root = bpy.data.objects.new("Gizmobot_Teaching_Asset", None)
bpy.context.scene.collection.objects.link(root)
for obj in (robot, logo_overlay, face_overlay):
    obj.parent = root

for obj in bpy.context.scene.objects:
    obj.select_set(obj in (root, robot, logo_overlay, face_overlay))
bpy.context.view_layer.objects.active = root

bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_materials="EXPORT",
    export_image_format="AUTO",
)

source_hash_after = sha256(source)
if source_hash_before != source_hash_after:
    raise RuntimeError("source GLB changed during export")

region_counts = Counter(poly_regions)
report = {
    "source": source,
    "source_sha256": source_hash_before,
    "output": output,
    "output_sha256": sha256(output),
    "blender": bpy.app.version_string,
    "source_counts": {
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "connected_components": len(components),
        "uv_layers": len(mesh.uv_layers),
    },
    "regions": {
        name: {
            "polygons": region_counts[name],
            "components": sum(1 for comp in components if comp["region"] == name),
        }
        for name in region_order
    },
    "overlays": {
        "Face_Glow": {"polygons": len(face_overlay.data.polygons), "mask_pixels": face_pixels},
        "Logo_Decal": {"polygons": len(logo_overlay.data.polygons), "mask_pixels": logo_pixels},
    },
    "materials": region_order + ["Face_Glow", "Logo_Decal"],
    "transform": {"location": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
}
with open(report_path, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)

print(json.dumps(report, indent=2))
