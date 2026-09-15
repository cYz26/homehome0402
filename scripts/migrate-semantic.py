"""One-time, lossless v05 -> semantic specification migration (Blender Python).

The immutable v05 blend is a library of detail meshes. Editable placements,
construction parameters and material values live in apartment.json, never here.
"""
import bpy, json, pathlib, hashlib, re, math
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec_path = ROOT / 'model/apartment.json'
spec = json.loads(spec_path.read_text())
if spec.get('schemaVersion'):
    raise RuntimeError('Migration already applied; edit the semantic spec and rebuild instead.')
baseline = ROOT / 'model/baseline-v05'
baseline.mkdir(exist_ok=True)
for name in ['apartment.json', 'measurements.json', 'validation.json', 'checks.json']:
    value = json.loads((ROOT / 'model' / name).read_text())
    (baseline / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n')
source = ROOT / 'art_src/apartment-v05.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
measure = json.loads((baseline / 'measurements.json').read_text())
walls = [x for x in measure['components'] if x['type'] == 'wall']
doors = [x for x in measure['components'] if x['type'] == 'door']
window_params = [
    ['NW_north', 2.6, 0, 1.7, .28, 2.55, 2, 0, 'northwest'],
    ['X_north', 4.885, 0, 1.73, .28, 2.55, 2, 0, 'xroom'],
    ['Kitchen_north', 7.625, 0, 1.25, .94, 2.48, 2, 0, 'kitchen'],
    ['Master_south', 1.86, 12.9, 2.28, .28, 2.55, 2, 0, 'master'],
    ['Living_south', 5.48, 12.9, 3.24, .035, 2.6, 4, 0, 'living'],
    ['SE_south', 8.915, 12.9, 2.03, .28, 2.55, 2, 0, 'southeast'],
    ['Bath_west', .9, 4.95, .8, .95, 2.35, 1, math.pi/2, 'commonbath'],
    ['Masterbath_north', .395, 5.5, .55, 1.35, 2.4, 1, 0, 'masterbath'],
]
spec.update(schemaVersion=2, version='metric-v06', assetStem='apartment-v06')
spec['coordinateSystem'] = {'unit': 'm', 'planSouthExtent': 12.9, 'planAxes': ['east', 'south'], 'webAxes': ['east', 'up', 'south']}
spec['sourceLibrary'] = {'path': str(source.relative_to(ROOT)), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'role': 'Immutable v05 detail-mesh templates; placements and materials overridden by this spec.'}
spec['project'] = {'name': 'Home 402', 'title': '把家的每一处，看清楚。', 'description': '从整体布局到一处材质，探索这套精装空房的空间、尺度与细节。', 'status': '基于图纸与实拍的米制模型 · 部分尺寸暂估', 'modelVisualAcceptance': 'pending'}
spec['construction'] = {'cutHeight': 1.15, 'skirtingHeight': .07, 'skirtingProjection': .008, 'skirtingBevel': .001, 'doorHeight': 2.18, 'openingHeight': 2.2}
spec['walls'] = walls
spec['doors'] = doors
spec['windowDefinitions'] = [dict(zip(['id','x','t','width','sill','head','count','orientation','room'],p)) for p in window_params]
# Reference-line polygons include the full living/circulation space. Clear polygons
# are derived by subtracting physical walls, not by treating bounds as net rooms.
polygons = {
 'living': [[3.5,7.4],[7.5,7.4],[7.5,12.9],[3.5,12.9]],
 'master': [[0,7.4],[3.5,7.4],[3.5,12.9],[0,12.9]],
 'southeast': [[7.5,7.55],[9.1,7.55],[9.1,8.6],[10.5,8.6],[10.5,12.9],[7.5,12.9]],
 'northwest': [[.9,0],[3.7,0],[3.7,3.4],[.9,3.4]],
 'xroom': [[3.7,0],[6.5,0],[6.5,3.4],[3.7,3.4]],
 'kitchen': [[6.5,0],[9.1,0],[9.1,3.4],[6.5,3.4]],
 'masterbath': [[0,5.5],[3,5.5],[3,7.4],[0,7.4]],
 'commonbath': [[.9,3.4],[3.7,3.4],[3.7,4.7],[3.5,4.7],[3.5,5.5],[.9,5.5]],
 'storage': [[7.5,6.3],[9.1,6.3],[9.1,7.55],[7.5,7.55]],
 'circulation': [[3.7,3.4],[8.3,3.4],[8.3,4.82],[9.1,4.82],[9.1,6.3],[7.5,6.3],[7.5,7.4],[3,7.4],[3,5.5],[3.5,5.5],[3.5,4.7],[3.7,4.7]],
 'utility': [[8.3,3.4],[9.1,3.4],[9.1,4.82],[8.3,4.82]],
}
spec['rooms'] += [
 {'id':'circulation','name':'入口与走廊','label':[5.6,5.5],'camera':[7.9,5.45],'look':[4.1,5.7],'drawing':'连接北侧空间、客厅与卧室','finish':'灰色石纹地面 · 保留通行空间'},
 {'id':'utility','name':'家政凹位','label':[8.7,4.1],'camera':[7.8,4.1],'look':[8.8,4.1],'drawing':'未标独立净尺寸 · 按图估读','finish':'内部空置'},
]
walk_points = {'living':[5.6,10.0], 'master':[1.8,9.5], 'southeast':[8.8,10.2], 'northwest':[2.4,2.2], 'xroom':[5.1,1.8], 'kitchen':[7.8,2.5], 'masterbath':[1.6,6.7], 'commonbath':[2.0,4.2], 'storage':[8.3,6.9], 'circulation':[5.7,5.7], 'utility':[8.65,4.0]}
for room in spec['rooms']:
    room['polygon'] = polygons[room['id']]
    room['areaBasis'] = 'model-estimate'
    room['walkEntry'] = walk_points[room['id']]
spec['navigation'] = {'eyeHeight':1.65,'minEyeHeight':1.25,'maxEyeHeight':1.9,'radius':.19,'bodyHeight':1.75,'speed':1.35,'fixedStep':1/60,'maxFrameDelta':.1,'stepHeight':.12,'start':[5.7,5.7],'gridSize':.12}
spec['lighting'] = {
 'environmentIntensity':.38, 'exposure':.96,
 'sun':{'position':[-3,1,16], 'target':[5,6,.1], 'intensity':1.85, 'color':'#fff5df'},
 'strips': [
 {'id':'hall-upper','position':[3.43,6.46,2.08],'size':[.28,1.42],'target':[3.7,6.46,1.43]},
 {'id':'hall-middle','position':[3.43,6.47,1.61],'size':[.28,1.36],'target':[3.7,6.47,.96]},
 {'id':'kitchen-east','position':[8.7,1.95,1.545],'size':[.055,2.4],'target':[8.45,1.95,.895]},
 {'id':'kitchen-west','position':[6.88,1.35,1.555],'size':[.055,1.18],'target':[7.02,1.35,.905]},
 {'id':'master-mirror','position':[1.9,5.72,1.385],'size':[1.7,.035],'target':[1.9,5.96,.735]},
 {'id':'master-underlight','position':[1.9,5.94,.183],'size':[1.65,.025],'target':[1.9,6.14,0]},
 ], 'roomLights':[{'room':r['id'],'position':[*r['label'],2.55],'intensity':8.0,'distance':6} for r in spec['rooms']],
 'render':{'samples':64,'width':1600,'height':1100,'worldStrength':.5,'sunPower':2.0},
}
def inside(p, poly):
    x,y=p; c=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: c=not c
    return c
def classify(name, layer):
    for w in walls:
        if name.startswith(('wall_'+w['id']+'_','skirting_'+w['id']+'_')):return 'wall_'+w['id'],'wall','墙体 '+w['id']
    for w in spec['windowDefinitions']:
        if name.startswith(w['id']+'_') and re.match(r'(?:(?:mullion|glass)_(?:lower|upper)|rail|stone_sill|handle)(?:\.\d+)?$',name[len(w['id'])+1:]): return 'window_'+w['id'],'window','窗 '+w['id']
    for d in doors:
        if any(name.startswith(prefix+d['id']) for prefix in ['door_','jamb_','jamb_far_','lintel_','handle_','hinge_']): return 'door_'+d['id'],'door','房门 '+d['id']
    groups = [
      ('Master_bath_', 'master-sliding-door','door','主卫推拉门'),('Common_bath_', 'common-sliding-door','door','次卫推拉门'),
      ('Master_double_', 'master-vanity','cabinet','主卫一体双人洗手台'),('Common_basin', 'common-vanity','cabinet','外置洗手台'),
      ('Master_shower','master-shower','fixture','主卫淋浴'),('Common_shower','common-shower','fixture','次卫淋浴'),
      ('Master_WC','master-toilet','fixture','主卫坐便器'),('Common_WC','common-toilet','fixture','次卫坐便器'),
      ('Fridge_','fridge','cabinet','嵌入式双开门冰箱'),('Kitchen_sink','kitchen-sink','fixture','厨房水槽'),
      ('Kitchen_north','kitchen-north','cabinet','北侧橱柜'),('Kitchen_east','kitchen-east','cabinet','东侧橱柜'),('Kitchen_west','kitchen-west','cabinet','西侧橱柜'),
      ('Hob_','hob','fixture','三眼灶具'),('Oven_','oven','fixture','嵌入式烤箱'),('Extractor_','extractor','fixture','斜面烟机'),
      ('Hall_','hall-joinery','cabinet','客厅壁龛展示柜'),('North_','north-surround','door','北侧门洞外围框'),
      ('X_retracted','north-sliding','door','X 空间推拉门'),('Kitchen_retracted','kitchen-sliding','door','厨房推拉门'),
    ]
    for prefix,ident,kind,label in groups:
        if name.startswith(prefix): return ident,kind,label
    if layer=='ceiling': return 'ceiling','ceiling','吊顶与灯具'
    if layer=='floor' or 'platform' in name.lower(): return 'floor_'+name,'slab','地面 '+name
    return 'detail_'+re.sub(r'[^a-zA-Z0-9_-]+','_',name),'detail','构件 '+name
entities={}; deps=bpy.context.evaluated_depsgraph_get()
for ob in sorted(bpy.context.scene.objects,key=lambda o:o.name):
    if ob.type!='MESH':continue
    ident,kind,label=classify(ob.name,ob.get('layer','fixed'))
    ev=ob.evaluated_get(deps); mesh=ev.to_mesh(); pts=[ev.matrix_world@v.co for v in mesh.vertices]
    points=[[p.x,12.9-p.y,p.z] for p in pts]; ev.to_mesh_clear()
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    ent=entities.setdefault(ident,{'id':ident,'type':kind,'name':label,'sourceNodes':[],'roomIds':[],'materials':[],'_lo':lo[:],'_hi':hi[:],'basis':'图纸定位 / 照片估读，非现场实测'})
    ent['sourceNodes'].append(ob.name)
    for i in range(3):ent['_lo'][i]=min(ent['_lo'][i],lo[i]);ent['_hi'][i]=max(ent['_hi'][i],hi[i])
    for m in ob.data.materials:
        if m.name not in ent['materials']:ent['materials'].append(m.name)
    p=[(lo[i]+hi[i])/2 for i in range(2)]
    for room in spec['rooms']:
        poly=room['polygon']
        if any(inside([p[0]+dx,p[1]+dy],poly) for dx,dy in [(0,0),(.15,0),(-.15,0),(0,.15),(0,-.15)]):
            if room['id'] not in ent['roomIds']:ent['roomIds'].append(room['id'])
for ent in entities.values():
    lo=ent.pop('_lo');hi=ent.pop('_hi')
    ent['placement']={'center':[round((a+b)/2,7) for a,b in zip(lo,hi)],'size':[round(b-a,7) for a,b in zip(lo,hi)]}
    ent['templatePlacement']=json.loads(json.dumps(ent['placement']))
    if not ent['roomIds']:ent['roomIds']=['circulation']
    if ent['type']=='wall':ent['wallId']=ent['id'][5:]
    if ent['type']=='window':ent['windowId']=ent['id'][7:]
    if ent['type']=='door' and ent['id'].startswith('door_'):ent['doorId']=ent['id'][5:]
spec['entities']=list(entities.values())
spec['materials']=[]
for m in bpy.data.materials:
    bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if m.use_nodes else None
    if not bs:continue
    mix=next((n for n in m.node_tree.nodes if n.type=='MIX' and n.blend_type=='MULTIPLY'),None)
    img=next((n.image for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image),None)
    spec['materials'].append({'id':m.name,'baseColor':list(bs.inputs['Base Color'].default_value),'roughness':bs.inputs['Roughness'].default_value,'metallic':bs.inputs['Metallic'].default_value,'alpha':bs.inputs['Alpha'].default_value,'emissionStrength':bs.inputs['Emission Strength'].default_value,'emissionColor':list(bs.inputs['Emission Color'].default_value),'tint':list(mix.inputs[7].default_value) if mix else None,'texture':img.name if img else None})
spec['annotations']=[
 {'id':'note-trough','entityId':'master-vanity','content':'一体连续宽槽、两组墙出龙头。1.80 m 为照片估算尺度。'},
 {'id':'note-fridge','entityId':'fridge','content':'双门冰箱使用内凹中央门缝，俯瞰时不再出现突出长杆。'},
 {'id':'note-hall','entityId':'hall-joinery','content':'灰褐木饰面、灰绿石材与暖色灯带，保留相邻长墙素面。'},
]
spec['renderViews']=[
 {'id':'hero','name':'全屋轴测','mode':'cutaway','camera':[17,26,25],'target':[5.3,6.3,.5],'orthoScale':18.5},
 {'id':'reference','name':'当前模型俯瞰','mode':'cutaway','camera':[5.5,25,30],'target':[5.3,6.4,0],'orthoScale':16,'width':1400,'height':1600},
 *[{'id':r['id'],'name':r['name'],'mode':'interior','camera':[*r['camera'],1.58],'target':[*r['look'],1.3],'fov':72} for r in spec['rooms'] if r['id'] in ['living','kitchen','master']],
 {'id':'masterbath','name':'主卫','mode':'interior','camera':[1.79,7.28,1.33],'target':[1.9,5.83,1.18],'fov':90},
]
spec_path.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
print('SEMANTIC_MIGRATION',len(spec['entities']),'entities',sum(len(e['sourceNodes']) for e in spec['entities']),'meshes')
