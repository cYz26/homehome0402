"""Build editable architecture from JSON. Does not render/export."""
import bpy, json, pathlib, hashlib, sys
from mathutils import Matrix, Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import architecture_geometry as geometry
import furniture_geometry as furniture
spec=json.loads((ROOT/'model/apartment.json').read_text())
library=ROOT/spec['sourceLibrary']['path']
if hashlib.sha256(library.read_bytes()).hexdigest()!=spec['sourceLibrary']['sha256']:
    raise RuntimeError('Detail library changed; reconcile its version before building.')
bpy.ops.wm.open_mainfile(filepath=str(library))
collection=next(c for c in bpy.data.collections if c.name.startswith('Apartment_'))
collection.name='Apartment_'+spec['version']
extent=spec['coordinateSystem']['planSouthExtent']
for config in spec['materials']:
    m=bpy.data.materials.get(config['id'])
    if m is None:
        m=bpy.data.materials.new(config['id']);m.use_nodes=True
    bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for key,name in [('baseColor','Base Color'),('roughness','Roughness'),('metallic','Metallic'),('alpha','Alpha'),('emissionStrength','Emission Strength'),('emissionColor','Emission Color')]:
        bs.inputs[name].default_value=config[key]
    if config.get('tint'):
        mix=next(n for n in m.node_tree.nodes if n.type=='MIX' and n.blend_type=='MULTIPLY')
        mix.inputs[7].default_value=config['tint']
    for key,name in [('transmission','Transmission Weight'),('ior','IOR')]:
        if key in config:bs.inputs[name].default_value=config[key]
parametric=[e for e in spec['entities'] if any(k in e for k in ['wallId','windowId','doorId'])]
for entity in parametric:
    for name in entity['sourceNodes']:
        ob=bpy.data.objects.get(name)
        if ob:bpy.data.objects.remove(ob,do_unlink=True)
geometry.configure(spec,collection)
for w in spec['walls']:geometry.wall(w['id'],w['a'],w['b'],w['thickness'],w['openings'])
for w in spec['windowDefinitions']:geometry.window(w['id'],w['x'],w['t'],w['width'],w['sill'],w['head'],w['count'],w['orientation'])
for d in spec['doors']:geometry.door(d['id'],d['hinge'],d['width'],d['openAngle'],d['closedDirection'],d['room'],d.get('leafOffset',(0,0)))
furniture.configure(spec,collection,ROOT)
def blender_point(p):return Vector((p[0],extent-p[1],p[2]))
assigned=set()
for entity in spec['entities']:
    template_entity=entity not in parametric and not entity.get('furnitureId')
    if template_entity:
        old=entity['templatePlacement'];new=entity['placement']
        scale=[b/a if abs(a)>1e-8 else 1 for a,b in zip(old['size'],new['size'])]
        transform=Matrix.Translation(blender_point(new['center'])) @ Matrix.Diagonal((*scale,1)) @ Matrix.Translation(-blender_point(old['center']))
    for name in entity['sourceNodes']:
        ob=bpy.data.objects.get(name)
        if ob is None:raise RuntimeError('Missing semantic part '+name)
        if name in assigned:raise RuntimeError('Part assigned twice '+name)
        assigned.add(name)
        if template_entity:ob.matrix_world=transform @ ob.matrix_world
        ob['entityId']=entity['id'];ob['kind']=entity['type'];ob['roomIds']=entity['roomIds']
        ob['room']=entity['roomIds'][0] if len(entity['roomIds'])==1 else ''
        ob['modelVersion']=spec['version'];ob.hide_render=False;ob.hide_viewport=False
unassigned=[o.name for o in collection.objects if o.type=='MESH' and o.name not in assigned]
if unassigned:raise RuntimeError('Unbound geometry '+str(unassigned))
bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
if '--verify-existing' in sys.argv:
    # Rebuild in memory to verify a generator refactor without replacing source
    # artifacts whose geometry has not changed.
    bpy.context.view_layer.update()
    expected=json.loads((ROOT/'model/validation.json').read_text())['objects']
    deps=bpy.context.evaluated_depsgraph_get();errors=[];maximum=0
    if assigned!=set(expected):errors.append('Part names changed')
    for name in assigned:
        ob=bpy.data.objects[name];ev=ob.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles()
        points=[ev.matrix_world@v.co for v in mesh.vertices]
        bounds=[[min(p[a] for p in points) for a in range(3)],[max(p[a] for p in points) for a in range(3)]]
        previous=expected.get(name)
        if previous:
            error=max(abs(a-b) for ba,bb in zip(bounds,previous['bounds']) for a,b in zip(ba,bb));maximum=max(maximum,error)
            if error>.00001 or len(mesh.loop_triangles)!=previous['triangles'] or ob['entityId']!=previous['entityId']:errors.append(name)
        ev.to_mesh_clear()
    print('REBUILD_EQUIVALENCE',json.dumps({'version':spec['version'],'parts':len(assigned),'maximumBoundsErrorMeters':maximum,'errors':errors}),flush=True)
    if errors:raise RuntimeError('Rebuild differs from validated source')
    sys.exit(0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art_src'/f"{spec['assetStem']}.blend"))
furniture_record={'version':spec['version'],'specSha256':hashlib.sha256((ROOT/'model/apartment.json').read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256((ROOT/'art_src'/f"{spec['assetStem']}.blend").read_bytes()).hexdigest(),'components':furniture.RECORDS}
(ROOT/'model/furniture-measurements.json').write_text(json.dumps(furniture_record,ensure_ascii=False,indent=2)+'\n')
baseline=json.loads((ROOT/'model/baseline-v05/measurements.json').read_text())
baseline.update(version=spec['version'],spec_sha256=hashlib.sha256((ROOT/'model/apartment.json').read_bytes()).hexdigest(),object_count=len(assigned))
baseline['components']=[*geometry.RECORDS,*[c for c in baseline['components'] if c['type'] not in ['wall','window','door']]]
baseline['furnishings']=[{'id':c['id'],'recipe':c['recipe'],'node':c['node'],'position':c['position'],'front':c['front'],'dimensions':c.get('dimensions'),'dimensionBasis':c['basis']} for c in spec.get('furnishings',[])]
(ROOT/'model/measurements.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2)+'\n')
print('SEMANTIC_SOURCE_READY',spec['version'],len(assigned),'parts')
