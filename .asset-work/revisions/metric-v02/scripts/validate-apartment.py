"""Independent Blender source/GLB reimport check for this architectural scene.
Preserves the original plan origin and transparent glass. Does not claim the plugin's
opaque/bottom-center generic-prop contract or user artistic acceptance.
"""
import bpy, json, pathlib, hashlib, math
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
STEM=json.loads((ROOT/'model/apartment.json').read_text())['assetStem']
SOURCE_PATH=ROOT/'art_src'/f'{STEM}.blend'
GLB_PATH=ROOT/'public/models'/f'{STEM}.glb'

def inspect():
    result={};deps=bpy.context.evaluated_depsgraph_get()
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH':continue
        ev=ob.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles()
        points=[ev.matrix_world@v.co for v in mesh.vertices]
        bounds=[[min(p[a] for p in points) for a in range(3)],[max(p[a] for p in points) for a in range(3)]]
        degenerate=sum(1 for tri in mesh.loop_triangles if tri.area<1e-12)
        result[ob.name]={'bounds':bounds,'triangles':len(mesh.loop_triangles),'degenerate':degenerate,'layer':ob.get('layer'),'uv':bool(mesh.uv_layers)}
        ev.to_mesh_clear()
    return result

bpy.ops.wm.open_mainfile(filepath=str(SOURCE_PATH))
source=inspect()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))
imported=inspect()
# Material primitives may be imported as one object or as child pieces; names are
# compared at the original object prefix and per-object bounds, not vertex ordering.
errors=[];max_error=0
for name,expected in source.items():
    actual=imported.get(name)
    if actual is None:errors.append('missing '+name);continue
    error=max(abs(a-b) for ba,bb in zip(expected['bounds'],actual['bounds']) for a,b in zip(ba,bb))
    max_error=max(max_error,error)
    if error>.0001:errors.append(f'bounds {name} {error}')
    if expected['triangles']!=actual['triangles']:errors.append('triangle count '+name)
report={'source_sha256':hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest(),
 'glb_sha256':hashlib.sha256(GLB_PATH.read_bytes()).hexdigest(),
 'source_objects':len(source),'reimport_objects':len(imported),'max_bound_error_m':max_error,
 'source_triangles':sum(o['triangles'] for o in source.values()),'reimport_triangles':sum(o['triangles'] for o in imported.values()),
 'source_degenerate_triangles':sum(o['degenerate'] for o in source.values()),
 'reimport_degenerate_triangles':sum(o['degenerate'] for o in imported.values()),
 'roundtrip_errors':errors,'roundtrip_pass':not errors,
 'acceptance':'Technical roundtrip only; original drawing dimensions partly estimated, user visual review pending.',
 'objects':imported}
(ROOT/'model/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='objects'},indent=2))
if errors:raise RuntimeError('Roundtrip errors; see model/validation.json')
