"""Independent Blender source/GLB reimport check for this architectural scene.
Preserves the original plan origin and transparent glass. Does not claim the plugin's
opaque/bottom-center generic-prop contract or user artistic acceptance.
"""
import bpy, json, pathlib, hashlib, math, sys
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from model_packages import packages
SPEC=json.loads((ROOT/'model/apartment.json').read_text())
STEM=SPEC['assetStem']
SOURCE_PATH=ROOT/'art_src'/f'{STEM}.blend'
GLB_PATH=ROOT/'asset_exchange'/f'{STEM}.glb'

def inspect():
    result={};deps=bpy.context.evaluated_depsgraph_get()
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH':continue
        ev=ob.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles()
        points=[ev.matrix_world@v.co for v in mesh.vertices]
        bounds=[[min(p[a] for p in points) for a in range(3)],[max(p[a] for p in points) for a in range(3)]]
        degenerate=sum(1 for tri in mesh.loop_triangles if tri.area<1e-12)
        result[ob.name]={'bounds':bounds,'triangles':len(mesh.loop_triangles),'degenerate':degenerate,'layer':ob.get('layer'),'entityId':ob.get('entityId'),'uv':bool(mesh.uv_layers),'materials':[m.name for m in ob.data.materials]}
        ev.to_mesh_clear()
    return result

bpy.ops.wm.open_mainfile(filepath=str(SOURCE_PATH))
source=inspect()
bpy.ops.wm.read_factory_settings(use_empty=True)
package_hashes=[]
for pack in packages(SPEC):
    path=ROOT/'asset_exchange'/f"{pack['assetStem']}.glb"
    bpy.ops.import_scene.gltf(filepath=str(path))
    package_hashes.append({'id':pack['id'],'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size})
imported=inspect()
trough_samples=[]
if 'Master_double_stone_trough' in imported:
    deps=bpy.context.evaluated_depsgraph_get()
    for x in [1.40,1.90,2.40]:
        hit,location,normal,index,ob,matrix=bpy.context.scene.ray_cast(deps,Vector((x,12.9-5.92,1.02)),Vector((0,0,-1)))
        trough_samples.append({'x':x,'hit':bool(hit),'object':ob.name if hit else None,'height':location.z if hit else None})
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
    if expected['entityId']!=actual['entityId']:errors.append('semantic owner '+name)
for name in imported.keys()-source.keys():errors.append('unexpected '+name)
report={'version':SPEC['version'],'spec_sha256':hashlib.sha256((ROOT/'model/apartment.json').read_bytes()).hexdigest(),
 'source_sha256':hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest(),
 'glb_sha256':hashlib.sha256(GLB_PATH.read_bytes()).hexdigest(),'model_packages':package_hashes,
 'source_objects':len(source),'reimport_objects':len(imported),'max_bound_error_m':max_error,
 'source_triangles':sum(o['triangles'] for o in source.values()),'reimport_triangles':sum(o['triangles'] for o in imported.values()),
 'source_degenerate_triangles':sum(o['degenerate'] for o in source.values()),
 'reimport_degenerate_triangles':sum(o['degenerate'] for o in imported.values()),
 'roundtrip_errors':errors,'roundtrip_pass':not errors,
 'acceptance':'Technical roundtrip only; original drawing dimensions partly estimated, user visual review pending.',
 'trough_downward_ray_samples':trough_samples,'objects':imported}
(ROOT/'model/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='objects'},indent=2))
if errors:raise RuntimeError('Roundtrip errors; see model/validation.json')
