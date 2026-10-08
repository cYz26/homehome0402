"""Same-source neutral furniture shape review; never modifies the saved scene."""
import bpy,json,pathlib,math,hashlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=json.loads((ROOT/'model/apartment.json').read_text())
source=ROOT/'art_src'/f"{spec['assetStem']}.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=500;scene.render.resolution_y=380;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='METAL'
    scene.cycles.device='GPU'
except Exception:pass
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.65,.65,1)
gray=bpy.data.materials.new('Review_clay');gray.use_nodes=True
bs=gray.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.38,.38,.38,1);bs.inputs['Roughness'].default_value=.7
for ob in scene.objects:
    if ob.type=='MESH':
        ob.hide_render=True
        if ob.get('furnitureRecipe'):
            for i in range(len(ob.data.materials)):ob.data.materials[i]=gray
camdata=bpy.data.cameras.new('Review_camera');cam=bpy.data.objects.new('Review_camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.clip_start=.02;camdata.clip_end=100
data=bpy.data.lights.new('Review_key','AREA');data.energy=500;data.shape='DISK';data.size=5
key=bpy.data.objects.new('Review_key',data);scene.collection.objects.link(key)
out=ROOT/'.asset-work/visual-review'/spec['version'];out.mkdir(parents=True,exist_ok=True)
record={'version':spec['version'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'engine':'Cycles neutral shape review','views':[]}
groups={'sofa':['living-sofa'],'table':['dining-work-table'],'cabinet':['living-modular-cabinet'],'chair':['living-reading-chair']}
for label,ids in groups.items():
    objects=[o for o in scene.objects if o.get('entityId') in ids]
    points=[o.matrix_world@Vector(v) for o in objects for v in o.bound_box]
    lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    center=(lo+hi)/2
    item=next(c for c in spec['furnishings'] if c['id']==ids[0]);fx,ft=item['front'];front=Vector((fx,-ft,0)).normalized();width=Vector((ft,fx,0)).normalized()
    extent=max(hi.x-lo.x,hi.y-lo.y)
    for view,direction in [('front',front),('side',width),('quarter',(front+width*.72).normalized())]:
        for o in objects:o.hide_render=False
        z=.08 if view!='quarter' else .4
        direction=(direction+Vector((0,0,z))).normalized()
        cam.location=center+direction*8;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=extent*1.28
        key.location=center+Vector((-3,-4,6));key.rotation_euler=(center-key.location).to_track_quat('-Z','Y').to_euler()
        path=out/f'{label}-{view}.png';scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        record['views'].append({'asset':label,'view':view,'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        print('SHAPE_REVIEW_READY',label,view,flush=True)
    for o in objects:o.hide_render=True
(out/'provenance.json').write_text(json.dumps(record,indent=2)+'\n')
