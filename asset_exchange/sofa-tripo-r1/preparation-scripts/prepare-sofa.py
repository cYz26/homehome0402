import bpy, json, pathlib, math, hashlib
from mathutils import Vector, Matrix

ROOT = pathlib.Path(__file__).resolve().parents[3]
PACKAGE = ROOT / 'asset_exchange/sofa-tripo-r1'
WORK = ROOT / '.asset-work/sofa-tripo-r1'
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'art_src/furniture/sofa-tripo-r1-import.blend'))
sofa = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
points = [sofa.matrix_world @ v.co for v in sofa.data.vertices]
lo = Vector(tuple(min(p[a] for p in points) for a in range(3)))
hi = Vector(tuple(max(p[a] for p in points) for a in range(3)))
scale = 2.4 / (hi.y - lo.y)
normalization = Matrix.Diagonal((scale, scale, scale, 1)) @ Matrix.Translation(Vector((-(lo.x+hi.x)/2, -(lo.y+hi.y)/2, -lo.z)))
sofa.matrix_world = normalization @ sofa.matrix_world
bpy.ops.object.select_all(action='DESELECT')
sofa.select_set(True)
bpy.context.view_layer.objects.active = sofa
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
sofa.name = 'Sofa_Tripo_r1'
sofa['sourceProvider'] = 'tripo'
sofa['sourceFbxSha256'] = hashlib.sha256(next((PACKAGE/'original').glob('*.fbx')).read_bytes()).hexdigest()
sofa['sourceAxes'] = 'width +Y, provisional front +X, up +Z'
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1
for im in bpy.data.images:
    if im.size[0] > 0 and im.name not in ['Render Result','Viewer Node']: im.pack()
full = ROOT / 'art_src/furniture/sofa-tripo-r1-full.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(full), compress=True)

def bounds(ob):
    pts = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
    return [[min(p[a] for p in pts) for a in range(3)], [max(p[a] for p in pts) for a in range(3)]]

before = bounds(sofa)
sofa.data.calc_loop_triangles()
original_triangles = len(sofa.data.loop_triangles)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = d.type == 'METAL'
    scene.cycles.device = 'GPU'
except Exception: pass
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.7,.7,.7,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'
scene.render.resolution_percentage = 100
camdata = bpy.data.cameras.new('Inspection_camera')
cam = bpy.data.objects.new('Inspection_camera', camdata)
scene.collection.objects.link(cam); scene.camera = cam
camdata.type = 'ORTHO'; camdata.ortho_scale = 3.25
camdata.clip_start = .01; camdata.clip_end = 100
for name, location, power, size in [('Key',(3,-3,5),600,4),('Fill',(-2,3,4),400,4)]:
    ld = bpy.data.lights.new(name,'AREA'); ld.energy=power; ld.shape='DISK';ld.size=size
    ob = bpy.data.objects.new(name,ld);scene.collection.objects.link(ob);ob.location=location
    ob.rotation_euler=(Vector((0,0,.45))-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.005))
floor = bpy.context.object;floor.name='Inspection_floor'
floor_mat=bpy.data.materials.new('Inspection_floor_material');floor_mat.use_nodes=True
floor_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.65,.65,.65,1)
floor_mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8
floor.data.materials.append(floor_mat)
target=Vector((0,0,.48))
def render(label, location, width=960, height=720):
    cam.location=location;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=width;scene.render.resolution_y=height
    scene.render.filepath=str(WORK/(label+'.png'))
    bpy.ops.render.render(write_still=True)
    print('SOFA_REVIEW_FRAME',label,flush=True)

render('source-positive-x',(5,0,.55),640,480)
render('source-negative-x',(-5,0,.55),640,480)
render('source-quarter',(4,-4,2.45))
bpy.ops.object.select_all(action='DESELECT');sofa.select_set(True);bpy.context.view_layer.objects.active=sofa
mod=sofa.modifiers.new('Web_surface_reduction','DECIMATE')
mod.decimate_type='COLLAPSE';mod.ratio=150000/original_triangles;mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=mod.name)
sofa.data.calc_loop_triangles()
after=bounds(sofa)
render('web-quarter',(4,-4,2.45))
render('web-positive-x',(5,0,.55),640,480)
report={'schema_version':1,'original_triangles':original_triangles,'derivative_triangles':len(sofa.data.loop_triangles),'original_vertices':970976,'derivative_vertices':len(sofa.data.vertices),'uniform_scale':scale,'source_bounds':before,'derivative_bounds':after,'bounds_max_error_meters':max(abs(a-b) for ba,bb in zip(before,after) for a,b in zip(ba,bb)),'dimensions_width_depth_height':[after[1][1]-after[0][1],after[1][0]-after[0][0],after[1][2]-after[0][2]],'provisional_front_axis':'+X','normalization_basis':'Uniform scale to existing assumed 2.4 m width; center XY and rest on z=0, not a measured furniture dimension','textures':[{'name':im.name,'size':list(im.size),'color_space':im.colorspace_settings.name} for im in bpy.data.images if im.size[0]>0 and im.name not in ['Render Result','Viewer Node']]}
for ob in list(scene.objects):
    if ob != sofa: bpy.data.objects.remove(ob,do_unlink=True)
derivative=ROOT/'art_src/furniture/sofa-tripo-r1.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(derivative), compress=True)
report['full_source']={'path':str(full.relative_to(ROOT)),'sha256':hashlib.sha256(full.read_bytes()).hexdigest()}
report['derivative_source']={'path':str(derivative.relative_to(ROOT)),'sha256':hashlib.sha256(derivative.read_bytes()).hexdigest()}
bpy.ops.object.select_all(action='DESELECT');sofa.select_set(True);bpy.context.view_layer.objects.active=sofa
glb=PACKAGE/'sofa-derived.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
report['derived_glb']={'path':str(glb.relative_to(ROOT)),'sha256':hashlib.sha256(glb.read_bytes()).hexdigest(),'bytes':glb.stat().st_size,'role':'Blender-derived runtime candidate, not a provider-original GLB'}
(PACKAGE/'preparation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('SOFA_DERIVATIVE_READY',json.dumps(report,ensure_ascii=False),flush=True)
