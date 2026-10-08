import bpy, json, pathlib, hashlib, collections
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[3]
PACKAGE = ROOT / 'asset_exchange/sofa-tripo-r1'
fbx = next((PACKAGE / 'original').glob('*.fbx'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(fbx), use_custom_normals=True)
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
report = {'original_fbx_sha256': hashlib.sha256(fbx.read_bytes()).hexdigest(), 'blender_version': bpy.app.version_string, 'objects': [], 'materials': [], 'images': [], 'armatures': [o.name for o in bpy.context.scene.objects if o.type == 'ARMATURE'], 'actions': [a.name for a in bpy.data.actions]}
all_points = []
for ob in objects:
    me = ob.data
    me.calc_loop_triangles()
    points = [ob.matrix_world @ v.co for v in me.vertices]
    all_points.extend(points)
    bounds = [[min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]]
    report['objects'].append({'name': ob.name, 'mesh_name': me.name, 'vertices': len(me.vertices), 'polygons': len(me.polygons), 'triangles': len(me.loop_triangles), 'polygon_sizes': dict(collections.Counter(len(p.vertices) for p in me.polygons)), 'uv_layers': [u.name for u in me.uv_layers], 'custom_normals': me.has_custom_normals, 'bounds': bounds, 'matrix_world': [list(row) for row in ob.matrix_world], 'materials': [m.name if m else None for m in me.materials]})
for m in bpy.data.materials:
    nodes = []
    if m.use_nodes:
        for n in m.node_tree.nodes:
            entry = {'type': n.type, 'name': n.name}
            if n.type == 'TEX_IMAGE': entry['image'] = n.image.name if n.image else None
            if n.type == 'BSDF_PRINCIPLED': entry['inputs'] = {s.name: {'linked': s.is_linked, 'value': list(s.default_value) if hasattr(s.default_value, '__len__') else s.default_value} for s in n.inputs if s.name in ['Base Color', 'Metallic', 'Roughness', 'Normal']}
            nodes.append(entry)
    report['materials'].append({'name': m.name, 'nodes': nodes, 'links': [{'from': l.from_node.name + '/' + l.from_socket.name, 'to': l.to_node.name + '/' + l.to_socket.name} for l in m.node_tree.links] if m.use_nodes else []})
for im in bpy.data.images:
    if im.name in ['Render Result', 'Viewer Node']: continue
    report['images'].append({'name': im.name, 'filepath': im.filepath, 'size': list(im.size), 'color_space': im.colorspace_settings.name, 'packed': bool(im.packed_file)})
    if im.size[0] > 0: im.pack()
report['bounds'] = [[min(p[i] for p in all_points) for i in range(3)], [max(p[i] for p in all_points) for i in range(3)]]
report['dimensions'] = [report['bounds'][1][i] - report['bounds'][0][i] for i in range(3)]
source = ROOT / 'art_src/furniture/sofa-tripo-r1-import.blend'
source.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
report['packed_import_source'] = str(source.relative_to(ROOT))
report['packed_import_sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
(PACKAGE / 'inspection-import.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('TRIPO_IMPORT_INSPECTED', json.dumps({'objects': report['objects'], 'dimensions': report['dimensions'], 'images': report['images'], 'armatures': report['armatures'], 'actions': report['actions']}, ensure_ascii=False), flush=True)
