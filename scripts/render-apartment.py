"""Cycles image production from the current source and versioned camera/lighting data."""
import bpy, json, pathlib, math, sys, hashlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=json.loads((ROOT/'model/apartment.json').read_text())
source=ROOT/'art_src'/f"{spec['assetStem']}.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene;extent=spec['coordinateSystem']['planSouthExtent']
def point(p):return Vector((p[0],extent-p[1],p[2]))
rig=bpy.data.collections.new('Presentation_rig');scene.collection.children.link(rig)
def light(name,kind,position,energy,size,target):
    data=bpy.data.lights.new(name,kind);data.energy=energy
    if kind=='AREA':data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);rig.objects.link(ob);ob.location=point(position)
    ob.rotation_euler=(point(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    ob.visible_glossy=False
    return ob
light('Daylight','AREA',[-3,5,14],1800,9,[5,6,0])
light('Soft_fill','AREA',[12,8,10],950,8,[5,6,0])
interior=[]
for c in spec['lighting']['roomLights']:
    ob=light('Fixture_'+c['id'],'AREA',c['position'],26,.10,[c['position'][0],c['position'][1],0]);interior.append(ob)
for c in spec['lighting']['strips']:
    ob=light(c['id'],'AREA',c['position'],8,max(c['size']),c['target']);ob.data.color=(1,.82,.58);interior.append(ob)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.82,.88,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=spec['lighting']['render']['worldStrength']
scene.render.engine='CYCLES';scene.cycles.samples=spec['lighting']['render']['samples'];scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=8
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    gpus=[d for d in prefs.devices if d.type=='METAL']
    if gpus:
        for d in prefs.devices:d.use=d.type=='METAL'
        scene.cycles.device='GPU'
except Exception as error:print('Using Cycles CPU:',error)
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.render.resolution_percentage=100
cam_data=bpy.data.cameras.new('Presentation_camera');cam=bpy.data.objects.new('Presentation_camera',cam_data);rig.objects.link(cam);scene.camera=cam
cam_data.clip_start=.025;cam_data.clip_end=200
out=ROOT/'.asset-work/renders'/spec['version'];out.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
spec_hash=hashlib.sha256((ROOT/'model/apartment.json').read_bytes()).hexdigest()
record_path=out/'provenance.json'
previous=json.loads(record_path.read_text()) if record_path.exists() else {}
images=previous.get('images',{})
# Preserve per-image provenance when a single camera is re-rendered. Upgrade
# records from the initial complete v06 render before overwriting any PNG.
for old in previous.get('views',[]):
    old_path=out/(old['id']+'.png')
    if old['id'] not in images and old_path.exists():
        images[old['id']]={'view':old,'sourceSha256':previous['sourceSha256'],'specSha256':previous['specSha256'],'sha256':hashlib.sha256(old_path.read_bytes()).hexdigest()}
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
views=[v for v in spec['renderViews'] if not args or v['id'] in args]
if args and set(args)-{v['id'] for v in views}:raise ValueError('Unknown render view')
for view in views:
    cut=view['mode']=='cutaway'
    for ob in scene.objects:
        if 'entityId' in ob:ob.hide_render=cut and ob.get('layer') in ['upper','ceiling']
    for ob in interior:ob.hide_render=cut
    cam.location=point(view['camera']);cam.rotation_euler=(point(view['target'])-cam.location).to_track_quat('-Z','Y').to_euler()
    cam_data.type='ORTHO' if cut else 'PERSP'
    if cut:cam_data.ortho_scale=view['orthoScale']
    else:cam_data.sensor_fit='VERTICAL';cam_data.sensor_height=24;cam_data.lens=12/math.tan(math.radians(view['fov'])/2)
    scene.render.resolution_x=view.get('width',spec['lighting']['render']['width']);scene.render.resolution_y=view.get('height',spec['lighting']['render']['height'])
    scene.render.filepath=str(out/(view['id']+'.png'));bpy.ops.render.render(write_still=True)
    images[view['id']]={'view':view,'sourceSha256':source_hash,'specSha256':spec_hash,'sha256':hashlib.sha256((out/(view['id']+'.png')).read_bytes()).hexdigest()}
    print('RENDER_READY',view['id'],flush=True)
report={'modelVersion':spec['version'],'sourceSha256':source_hash,'specSha256':spec_hash,'engine':'Cycles','blender':bpy.app.version_string,'views':[r['view'] for r in images.values()],'images':images,'role':'Same-model Cycles renders; not site photographs'}
record_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
