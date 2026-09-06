"""Inspect the source Gizmobot GLB without modifying it.

Run with Blender 4.1 in background mode. The report is intentionally JSON so
the remodelling script and QA can use the same facts later.
"""

import bpy
import json
import math
import os
import sys
from collections import Counter, deque


def cli_arg(name):
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    try:
        return args[args.index(name) + 1]
    except (ValueError, IndexError):
        raise SystemExit(f"missing {name}")


source = os.path.abspath(cli_arg("--source"))
report_path = os.path.abspath(cli_arg("--report"))
texture_dir = os.path.abspath(cli_arg("--textures"))
os.makedirs(os.path.dirname(report_path), exist_ok=True)
os.makedirs(texture_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)


def node_value(node, input_name):
    sock = node.inputs.get(input_name)
    value = getattr(sock, "default_value", None) if sock else None
    if hasattr(value, "__len__"):
        return [round(float(x), 6) for x in value]
    return round(float(value), 6) if isinstance(value, (float, int)) else value


materials = []
images = {}
for material in bpy.data.materials:
    entry = {
        "name": material.name,
        "blend_method": material.surface_render_method,
        "double_sided": not material.use_backface_culling,
        "nodes": [],
    }
    if material.use_nodes:
        for node in material.node_tree.nodes:
            n = {"name": node.name, "type": node.bl_idname}
            if node.type == "BSDF_PRINCIPLED":
                n["values"] = {
                    key: node_value(node, key)
                    for key in (
                        "Base Color",
                        "Metallic",
                        "Roughness",
                        "IOR",
                        "Alpha",
                        "Emission Color",
                        "Emission Strength",
                    )
                }
            if node.type == "TEX_IMAGE" and node.image:
                image = node.image
                safe_name = os.path.basename(image.name).replace("/", "_").replace("\\", "_")
                export_path = os.path.join(texture_dir, safe_name)
                if not os.path.splitext(export_path)[1]:
                    export_path += ".png"
                image.save_render(export_path)
                n["image"] = {
                    "name": image.name,
                    "size": list(image.size),
                    "colorspace": image.colorspace_settings.name,
                    "alpha_mode": image.alpha_mode,
                    "source": image.source,
                    "exported": export_path,
                }
                images[image.name] = image
            entry["nodes"].append(n)
        entry["links"] = [
            {
                "from": link.from_node.name + "." + link.from_socket.name,
                "to": link.to_node.name + "." + link.to_socket.name,
            }
            for link in material.node_tree.links
        ]
    materials.append(entry)


def srgb_channel(linear):
    if linear <= 0.0031308:
        return linear * 12.92
    return 1.055 * (linear ** (1 / 2.4)) - 0.055


def sample_image(image, pixels, uv):
    width, height = image.size
    u = uv[0] % 1.0
    v = uv[1] % 1.0
    x = min(width - 1, max(0, int(u * width)))
    y = min(height - 1, max(0, int(v * height)))
    idx = 4 * (y * width + x)
    rgba = pixels[idx : idx + 4]
    return [round(max(0, min(1, srgb_channel(float(c)))) * 255) for c in rgba[:3]] + [round(float(rgba[3]) * 255)]


def quantize(rgb, step=24):
    return tuple(min(255, int(round(c / step) * step)) for c in rgb[:3])


mesh_entries = []
for obj in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv_layer = mesh.uv_layers.active.data if mesh.uv_layers.active else None
    image = next((value for name, value in images.items() if "BaseColor" in name), None)
    image_pixels = list(image.pixels[:]) if image else None

    vertex_polys = [[] for _ in mesh.vertices]
    for poly in mesh.polygons:
        for vertex_index in poly.vertices:
            vertex_polys[vertex_index].append(poly.index)

    adjacency = [set() for _ in mesh.polygons]
    for linked in vertex_polys:
        for poly_index in linked:
            adjacency[poly_index].update(linked)
    seen = set()
    components = []
    poly_component = {}
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
        comp_index = len(components)
        for poly_index in members:
            poly_component[poly_index] = comp_index
        vertices = {v for p in members for v in mesh.polygons[p].vertices}
        coords = [mesh.vertices[v].co for v in vertices]
        area = sum(mesh.polygons[p].area for p in members)
        comp = {
            "index": comp_index,
            "polygons": len(members),
            "vertices": len(vertices),
            "area": round(area, 6),
            "bounds_min": [round(min(c[i] for c in coords), 6) for i in range(3)],
            "bounds_max": [round(max(c[i] for c in coords), 6) for i in range(3)],
        }
        components.append(comp)

    color_counts = Counter()
    component_colors = [Counter() for _ in components]
    samples = []
    if image and uv_layer:
        for tri in mesh.loop_triangles:
            u = sum(uv_layer[loop_index].uv.x for loop_index in tri.loops) / 3
            v = sum(uv_layer[loop_index].uv.y for loop_index in tri.loops) / 3
            rgba = sample_image(image, image_pixels, (u, v))
            bucket = quantize(rgba)
            color_counts[bucket] += 1
            component_colors[poly_component[tri.polygon_index]][bucket] += 1
            if len(samples) < 12:
                samples.append({"polygon": tri.polygon_index, "uv": [round(u, 6), round(v, 6)], "rgba": rgba})

    for i, comp in enumerate(components):
        comp["top_colors"] = [
            {"rgb": list(rgb), "triangles": count}
            for rgb, count in component_colors[i].most_common(8)
        ]

    local_bounds = [obj.bound_box[i] for i in range(8)]
    mesh_entries.append(
        {
            "object": obj.name,
            "mesh": mesh.name,
            "transform": {
                "location": [round(v, 6) for v in obj.location],
                "rotation_euler": [round(v, 6) for v in obj.rotation_euler],
                "scale": [round(v, 6) for v in obj.scale],
            },
            "counts": {
                "vertices": len(mesh.vertices),
                "edges": len(mesh.edges),
                "polygons": len(mesh.polygons),
                "triangles": len(mesh.loop_triangles),
                "materials": len(mesh.materials),
                "uv_layers": len(mesh.uv_layers),
                "components": len(components),
            },
            "material_slots": [slot.name if slot else None for slot in mesh.materials],
            "uv_layers": [layer.name for layer in mesh.uv_layers],
            "bounds_min": [round(min(v[i] for v in local_bounds), 6) for i in range(3)],
            "bounds_max": [round(max(v[i] for v in local_bounds), 6) for i in range(3)],
            "components": sorted(components, key=lambda c: c["area"], reverse=True),
            "top_colors": [
                {"rgb": list(rgb), "triangles": count}
                for rgb, count in color_counts.most_common(24)
            ],
            "sample_triangles": samples,
        }
    )

report = {
    "source": source,
    "blender": bpy.app.version_string,
    "scene": {
        "objects": len(bpy.context.scene.objects),
        "meshes": len([o for o in bpy.context.scene.objects if o.type == "MESH"]),
        "materials": len(bpy.data.materials),
        "images": len(bpy.data.images),
    },
    "materials": materials,
    "meshes": mesh_entries,
}

with open(report_path, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)

print(json.dumps({"report": report_path, "scene": report["scene"], "meshes": [m["counts"] for m in mesh_entries]}, indent=2))
