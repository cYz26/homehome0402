"""Export full-height source independently of presentation cameras."""
import bpy,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=json.loads((ROOT/'model/apartment.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art_src'/f"{spec['assetStem']}.blend"))
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.context.scene.objects:
    ob.select_set(ob.type=='MESH' and 'entityId' in ob)
out=ROOT/'asset_exchange';out.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out/f"{spec['assetStem']}.glb"),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
