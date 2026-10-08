"""Export full-height source independently of presentation cameras."""
import bpy,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from model_packages import packages,entity_ids
spec=json.loads((ROOT/'model/apartment.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art_src'/f"{spec['assetStem']}.blend"))
out=ROOT/'asset_exchange';out.mkdir(exist_ok=True)
assigned=set()
for pack in packages(spec):
    ids=entity_ids(spec,pack)
    if assigned.intersection(ids):raise RuntimeError('Duplicate package entity ownership')
    assigned.update(ids)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bpy.context.scene.objects:
        ob.select_set(ob.type=='MESH' and ob.get('entityId') in ids)
    bpy.ops.export_scene.gltf(filepath=str(out/f"{pack['assetStem']}.glb"),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
if assigned!={e['id'] for e in spec['entities']}:raise RuntimeError('Incomplete package coverage')
