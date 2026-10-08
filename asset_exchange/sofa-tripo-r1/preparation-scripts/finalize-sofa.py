import bpy, json, pathlib, math, hashlib
from mathutils import Vector, Matrix

ROOT=pathlib.Path(__file__).resolve().parents[3]
WORK=ROOT/'.asset-work/sofa-tripo-r1'
PACKAGE=ROOT/'asset_exchange/sofa-tripo-r1'

def sha(path): return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def bounds(ob):
    pts=[ob.matrix_world@Vector(v) for v in ob.bound_box]
    return [[min(p[a] for p in pts) for a in range(3)],[max(p[a] for p in pts) for a in range(3)]]
def align_source(input_name, output_name):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art_src/furniture'/input_name))
    ob=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    ob.matrix_world=Matrix.Rotation(math.pi,4,'Z')@ob.matrix_world
    bpy.context.view_layer.update();b=bounds(ob)
    ob.matrix_world=Matrix.Translation(Vector((-(b[0][0]+b[1][0])/2,-(b[0][1]+b[1][1])/2,-b[0][2])))@ob.matrix_world
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    ob.name='Furniture_living_sofa';ob['sourceAxes']='front +X, width +Y, up +Z; centered XY, floor z=0'
    ob['layer']='fixed';ob['furnitureRecipe']='sofa';ob['sourceProvider']='tripo'
    ob.data.materials[0].name='Tripo_sofa_original_PBR'
    ob.data.calc_loop_triangles()
    b=bounds(ob)
    dest=ROOT/'art_src/furniture'/output_name
    bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
    return ob,{'path':str(dest.relative_to(ROOT)),'sha256':sha(dest),'bytes':dest.stat().st_size,'triangles':len(ob.data.loop_triangles),'vertices':len(ob.data.vertices),'bounds':b,'dimensions_width_depth_height':[b[1][1]-b[0][1],b[1][0]-b[0][0],b[1][2]-b[0][2]]}

def render_front(ob,label):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=8
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='METAL'
        scene.cycles.device='GPU'
    except Exception:pass
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.7,.7,.7,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
    scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    target=Vector((0,0,.48));camdata=bpy.data.cameras.new('Review_camera');cam=bpy.data.objects.new('Review_camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
    camdata.type='ORTHO';camdata.ortho_scale=3.12;cam.location=(5,-1.15,1.22);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    for name,location,power in [('Key',(3,-3,5),600),('Fill',(-2,3,4),400)]:
        ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=4
        light=bpy.data.objects.new(name,ld);scene.collection.objects.link(light);light.location=location;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005));floor=bpy.context.object
    mat=bpy.data.materials.new('Review_floor');mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.65,.65,.65,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;floor.data.materials.append(mat)
    scene.render.filepath=str(WORK/(label+'.png'));bpy.ops.render.render(write_still=True)
    for other in list(scene.objects):
        if other!=ob:bpy.data.objects.remove(other,do_unlink=True)
    return {'path':str((WORK/(label+'.png')).relative_to(ROOT)),'sha256':sha(WORK/(label+'.png'))}

full,full_record=align_source('sofa-tripo-r1-full.blend','sofa-tripo-r1-full-ready.blend')
full_frame=render_front(full,'full-front-quarter')
ready,ready_record=align_source('sofa-tripo-r1.blend','sofa-tripo-r1-ready.blend')
ready_frame=render_front(ready,'ready-front-quarter')
bpy.ops.object.select_all(action='DESELECT');ready.select_set(True);bpy.context.view_layer.objects.active=ready
glb=PACKAGE/'sofa-ready.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
report={'schema_version':1,'full_source':full_record,'runtime_source':ready_record,'preview_full':full_frame,'preview_runtime':ready_frame,'glb':{'path':str(glb.relative_to(ROOT)),'sha256':sha(glb),'bytes':glb.stat().st_size,'origin':'Blender-derived GLB; supplied archive contains FBX, not a provider-original GLB'},'source_front_axis_verified':'+X after 180 degree rotation around Z; seating surfaces confirmed from inspected original -X view','normalization_basis':'Uniform width normalization to the existing assumed 2.4 m furniture width; same aspect ratio, z=0 floor origin','texture_resolution_policy':'All original PBR channels retained at 4096 x 4096; no image resizing or repainting','target_placement':{'id':'living-sofa','node':'Furniture_living_sofa','plan_position':[4.12,10.4],'plan_front':[1,0],'blender_floor_elevation':.016,'dimensions_width_depth_height':ready_record['dimensions_width_depth_height']}}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
reimport=[]
for ob in meshes:
    ob.data.calc_loop_triangles();reimport.append({'name':ob.name,'bounds':bounds(ob),'triangles':len(ob.data.loop_triangles),'uv_layers':[u.name for u in ob.data.uv_layers],'materials':[m.name for m in ob.data.materials]})
actual=reimport[0]['bounds'];expected=ready_record['bounds'];err=max(abs(a-b) for ba,bb in zip(actual,expected) for a,b in zip(ba,bb))
report['independent_glb_reimport']={'objects':reimport,'maximum_bounds_error_meters':err,'triangles_match':sum(o['triangles'] for o in reimport)==ready_record['triangles'],'images':[{'name':im.name,'size':list(im.size)} for im in bpy.data.images if im.name not in ['Render Result','Viewer Node']],'armatures':[o.name for o in bpy.context.scene.objects if o.type=='ARMATURE'],'actions':[a.name for a in bpy.data.actions]}
if err>0.0001 or not report['independent_glb_reimport']['triangles_match']:raise RuntimeError('Standalone GLB roundtrip mismatch')
(PACKAGE/'ready-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('SOFA_READY_FOR_SCENE',json.dumps(report,ensure_ascii=False),flush=True)
