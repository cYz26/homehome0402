"""Author the metric apartment in Blender. No reference pixels are used as measurements.
Run: Blender --background --factory-startup --python scripts/build-apartment.py
The same editable source is exported to the browser; extras preserve display layers.
"""
import bpy, math, json, pathlib, hashlib, random
import numpy as np
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT/'model/apartment.json').read_text())
STEM = SPEC['assetStem']
H, CUT = SPEC['height'], SPEC['cutHeight']
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1
MODEL = bpy.data.collections.new('Apartment_'+SPEC['version']); scene.collection.children.link(MODEL)
PREVIEW = bpy.data.collections.new('Preview_only'); scene.collection.children.link(PREVIEW)
random.seed(240915)
RECORDS = []

def material(name, color, rough=.65, metal=0, alpha=1):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,alpha); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,alpha)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    bs.inputs['Alpha'].default_value=alpha
    if alpha<1: m.surface_render_method='DITHERED'
    return m

wallmat=material('Warm_white_plaster',(.67,.61,.53),.72)
ceilingmat=material('Warm_white_ceiling',(.84,.79,.71),.78)
capmat=material('Thin_graphite_cut_edge',(.075,.072,.066),.55)
oak=material('Taupe_wood_joinery',(.32,.25,.20),.42)
cabinet=material('Warm_ivory_cabinet',(.72,.66,.55),.32)
white=material('Porcelain',(.90,.91,.87),.23)
chrome=material('Brushed_steel',(.48,.53,.52),.28,.8)
black=material('Graphite_frame',(.018,.019,.018),.30,.3)
glass=material('Clear_glass',(.79,.86,.88),.08,0,.10)
smoked=material('Smoked_ribbed_sliding_glass',(.043,.039,.034),.19,.28,.93)
flutemat=material('Subtle_glass_fluting',(.036,.033,.030),.24,.2)
bathdoor=material('Charcoal_bath_privacy_glass',(.072,.069,.063),.28,.24)
hallwood=material('Muted_taupe_hall_panels',(.30,.23,.185),.46)
hallstone=material('Grey_olive_niche_stone',(.31,.30,.24),.38)
bathstone=material('Pale_sage_marble_vanity',(.59,.63,.49),.28)
crystal=material('Champagne_crystal_inlay',(.74,.70,.59),.26,.16)
mirror=material('Silver_mirror',(.84,.87,.85),.035,1)
appliance=material('Black_appliance_glass',(.014,.016,.017),.12,.28)
sinkmetal=material('Dark_stainless_sink',(.10,.115,.12),.26,.75)
fridge=material('Pearl_ivory_refrigerator',(.79,.77,.71),.22,.22)
stone=material('Grey_flowing_marble_floor',(.51,.48,.44),.25)
counter=material('Ivory_stone_counter',(.83,.80,.71),.3)
joineryback=material('Taupe_marble_niche',(.32,.27,.22),.32)
kitchenfloor=material('Kitchen_satin_stone',(.75,.72,.66),.48)
led=material('Warm_light',(.95,.83,.57),.4)
bs=led.node_tree.nodes.get('Principled BSDF'); bs.inputs['Emission Color'].default_value=(1,.72,.38,1); bs.inputs['Emission Strength'].default_value=2.5

def image_texture(name, kind):
    n=512; y,x=np.mgrid[0:n,0:n].astype(float)/n
    rng=np.random.default_rng(2026 if kind=='wood' else 42)
    if kind=='wood':
        warp=x*72+1.7*np.sin(y*9+x*5)+.7*np.sin(y*31+x*16)
        fine=(np.sin(warp*math.pi*2)+.28*np.sin(warp*math.pi*7))*.017
        growth=.012*np.sin(x*math.pi*18+.45*np.sin(y*7))
        noise=rng.normal(0,.006,(n,n))
        rgb=np.stack([.64+fine+growth+noise,.55+fine+growth+noise,.43+fine+growth+noise],axis=-1)
    else:
        field=np.zeros((n,n))
        for f,amp in [(2,.035),(5,.016),(13,.006),(39,.002)]:
            field+=amp*np.sin(x*f*6+y*f*3+2*np.sin(y*f*2))
        vein=np.exp(-np.abs(np.sin(x*11+y*7+1.3*np.sin(y*8)))*28)*.025
        noise=rng.normal(0,.004,(n,n)); f=field+vein+noise
        rgb=np.stack([.72+f,.69+f,.62+f],axis=-1)
    rgba=np.concatenate([np.clip(rgb,0,1),np.ones((n,n,1))],axis=-1).astype(np.float32)
    img=bpy.data.images.new(name,width=n,height=n); img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw=str(ROOT/'art_src'/f'{name}.png'); img.file_format='PNG'; img.save(); img.pack()
    return img

def load_or_generate(name,kind):
    path=ROOT/'references/generated'/f'material-{kind}.png'
    if path.exists():
        img=bpy.data.images.load(str(path));img.pack();return img
    return image_texture(name,kind)
woodimg=load_or_generate('oak-grain','oak'); stoneimg=load_or_generate('limestone-grain','stone')
def textured(m,img,factor=1):
    nodes=m.node_tree.nodes; t=nodes.new('ShaderNodeTexImage'); t.image=img
    mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    mix.inputs[7].default_value=(*factor,1) if isinstance(factor,tuple) else (factor,factor,factor,1)
    m.node_tree.links.new(t.outputs['Color'],mix.inputs[6])
    m.node_tree.links.new(mix.outputs[2],nodes.get('Principled BSDF').inputs['Base Color'])
floorimg=bpy.data.images.load(str(ROOT/'references/generated/material-stone-v03.png'));floorimg.pack()
counterimg=bpy.data.images.load(str(ROOT/'references/generated/material-counter-v03.png'));counterimg.pack()
textured(stone,floorimg,(.86,.88,.89));textured(counter,counterimg)
textured(joineryback,counterimg,(.40,.32,.25))
textured(hallstone,counterimg,(.32,.31,.255));textured(bathstone,counterimg,(.62,.69,.65))
hallpath=ROOT/'references/generated/material-hallwood-v04.png'
if hallpath.exists():
    hallimg=bpy.data.images.load(str(hallpath));hallimg.pack();textured(hallwood,hallimg,(.87,.79,.73))
crystalpath=ROOT/'references/generated/material-crystal-v04.png'
if crystalpath.exists():
    crystalimg=bpy.data.images.load(str(crystalpath));crystalimg.pack();textured(crystal,crystalimg)
    tex=next(n for n in crystal.node_tree.nodes if n.type=='TEX_IMAGE')
    crystal.node_tree.links.new(tex.outputs['Color'],crystal.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'])
    crystal.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=1.25
veneerpath=ROOT/'references/generated/material-veneer-v03.png'
if veneerpath.exists():
    veneerimg=bpy.data.images.load(str(veneerpath));veneerimg.pack();textured(oak,veneerimg,(.80,.76,.72))
else: textured(oak,woodimg,(.62,.53,.46))
textured(kitchenfloor,stoneimg,(1.03,1.02,1.0))
woods=[]
for i in range(6):
    m=material('Oak_plank_%02d'%i,(.6,.52,.4),.54)
    # A portable base-color image; plank UV offsets avoid identical adjacent grain.
    textured(m,woodimg,[.69,.71,.73,.75,.77,.79][i]); woods.append(m)

def objmesh(name,verts,faces,mat,layer='fixed',room=None,uv=None):
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    ob=bpy.data.objects.new(name,mesh); MODEL.objects.link(ob)
    for m in (mat if isinstance(mat,list) else [mat]): mesh.materials.append(m)
    ob['layer']=layer
    if room: ob['room']=room
    if uv:
        tex=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            for li in poly.loop_indices: tex.data[li].uv=uv[mesh.loops[li].vertex_index]
    return ob

def cube(name,x,t,z,w,d,h,mat,layer='fixed',room=None,bevel=.006,rot=0):
    verts=[(-w/2,-d/2,-h/2),(w/2,-d/2,-h/2),(w/2,d/2,-h/2),(-w/2,d/2,-h/2),(-w/2,-d/2,h/2),(w/2,-d/2,h/2),(w/2,d/2,h/2),(-w/2,d/2,h/2)]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    ob=objmesh(name,verts,faces,mat,layer,room); ob.location=(x,12.9-t,z); ob.rotation_euler.z=rot
    uv=ob.data.uv_layers.new()
    for poly in ob.data.polygons:
        axis=max(range(3),key=lambda k:abs(poly.normal[k]))
        for li in poly.loop_indices:
            co=ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv=(co.x,co.y) if axis==2 else ((-co.y,co.z) if axis==0 else (co.x,co.z))
    if bevel:
        mod=ob.modifiers.new('Subtle_edge','BEVEL'); mod.width=min(bevel,w/4,d/4,h/4); mod.segments=2
        ob.modifiers.new('Weighted_normals','WEIGHTED_NORMAL')
    return ob

def prism(name,poly,z,h,mat,layer='floor',room=None):
    # Ensure CCW in Blender XY (plan t is reversed).
    coords=[(x,12.9-t) for x,t in poly]
    if sum(coords[i][0]*coords[(i+1)%len(coords)][1]-coords[(i+1)%len(coords)][0]*coords[i][1] for i in range(len(coords)))<0: coords.reverse()
    n=len(coords); verts=[(x,y,z) for x,y in coords]+[(x,y,z+h) for x,y in coords]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    uv=[(x/2.4,y/2.4) for x,y in coords]*2
    return objmesh(name,verts,faces,mat,layer,room,uv)

def rect(name,b,z,h,mat,layer='fixed',room=None):
    x0,t0,x1,t1=b
    return cube(name,(x0+x1)/2,(t0+t1)/2,z+h/2,x1-x0,t1-t0,h,mat,layer,room)

def vertical(name,x,t,w,d,z0,z1,mat,room=None,rot=0,layer='fixed'):
    for a,b in [(z0,min(CUT,z1)),(max(CUT,z0),z1)]:
        if b-a>.0001:
            ob=cube(name+('_upper' if a>=CUT else '_lower'),x,t,(a+b)/2,w,d,b-a,mat,'upper' if a>=CUT else layer,room,bevel=0,rot=rot)
            if layer=='wall' and a<CUT and abs(b-CUT)<.0001:
                ob.data.materials.append(capmat);ob.data.polygons[1].material_index=1

def wall(name,a,b,thick=.16,holes=None,room=None):
    dx,dt=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dt); vx,vt=dx/L,dt/L
    holes=holes or []; points=sorted(set([0,L]+[p for h in holes for p in h[:2]]))
    rot=-math.atan2(dt,dx)
    for i,(s,e) in enumerate(zip(points,points[1:])):
        mid=(s+e)/2; x,t=a[0]+vx*mid,a[1]+vt*mid
        hole=next((q for q in holes if q[0]<=mid<=q[1]),None)
        zs=[(0,H)] if hole is None else [(0,hole[2]),(hole[3],H)]
        for j,(z0,z1) in enumerate(zs):
            if z1-z0<.0001: continue
            vertical(f'wall_{name}_{i}_{j}',x,t,e-s,thick,z0,z1,wallmat,room,rot,layer='wall')
        if not hole or hole[2]>.15:
            # Applied skirting projects only 8 mm. No decorative living-room wrapping.
            cube(f'skirting_{name}_{i}',x,t,.035,e-s,thick+.016,.07,capmat,'fixed',room,bevel=.001,rot=rot)
    RECORDS.append({'type':'wall','id':name,'a':a,'b':b,'thickness':thick,'openings':holes})

# Floor slab and finishes share the dimension-chain reference footprint.
prism('Apartment_floor_slab',SPEC['outline'],-.18,.18,counter)
prism('Continuous_public_stone',SPEC['outline'],.001,.015,stone)
prism('Ceiling_main',SPEC['outline'],H,.06,ceilingmat,'ceiling')

def clip(poly,axis,val,above):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ina=(a[axis]>=val) if above else (a[axis]<=val)
        inb=(b[axis]>=val) if above else (b[axis]<=val)
        if ina: out.append(a)
        if ina!=inb:
            k=(val-a[axis])/(b[axis]-a[axis]); out.append([a[0]+k*(b[0]-a[0]),a[1]+k*(b[1]-a[1])])
    return out

def woodfloor(name,b,herring=False):
    x0,t0,x1,t1=b; verts=[]; faces=[]; uvs=[]; L=.84; w=.14; polys=[]
    if herring:
        angle=math.pi/4; co,si=math.cos(angle),math.sin(angle)
        for i in range(-12,13):
            for j in range(-48,49):
                bx,by=i*L-j*w,i*L+j*w
                for q in [[(0,0),(L,0),(L,w),(0,w)],[(L,0),(L+w,0),(L+w,L),(L,L)]]:
                    polys.append([[(bx+a)*co-(by+b)*si+(x0+x1)/2,(bx+a)*si+(by+b)*co+(t0+t1)/2] for a,b in q])
    else:
        for i in range(int((x1-x0)/w)+1):
            for j in range(-1,int((t1-t0)/1.35)+1):
                x=x0+i*w; t=t0+j*1.35+(i%3)*.45
                polys.append([[x,t],[x+w,t],[x+w,t+1.35],[x,t+1.35]])
    for poly in polys:
        original=poly[:]
        for ax,val,above in [(0,x0,True),(0,x1,False),(1,t0,True),(1,t1,False)]:
            if poly: poly=clip(poly,ax,val,above)
        if len(poly)<3: continue
        area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1])))/2
        if area<.0001: continue
        center=np.mean(poly,axis=0); poly=[(center[0]+(p[0]-center[0])*.996,center[1]+(p[1]-center[1])*.996) for p in poly]
        base=len(verts); poly.reverse(); faces.append(tuple(range(base,base+len(poly))))
        origin=np.array(original[0]); va=np.array(original[1])-origin; vb=np.array(original[3])-origin
        off=random.random()
        for x,t in poly:
            verts.append((x,12.9-t,.024)); p=np.array([x,t])-origin
            ua=float(np.dot(p,va)/np.dot(va,va));ub=float(np.dot(p,vb)/np.dot(vb,vb))
            uvs.append((ub+off,ua) if np.dot(va,va)>np.dot(vb,vb) else (ua+off,ub))
    ob=objmesh('floor_'+name,verts,faces,woods,'floor',name,uvs)
    for face in ob.data.polygons: face.material_index=random.randrange(len(woods))

woodfloor('master',[.10,7.4,3.42,12.3],True)
woodfloor('southeast',[7.58,8.6,10.40,12.3]); woodfloor('southeast_entry',[7.58,7.63,9.02,8.61])
woodfloor('northwest',[1,.1,3.62,3.4]); woodfloor('xroom',[3.78,.1,6.42,3.4])
rect('Kitchen_floor',[6.58,.10,9.0,3.38],.017,.006,kitchenfloor,'floor','kitchen')

# Outer walls; hole dimensions are (distance along wall, end, sill, head).
WS,WH=SPEC['windows']['bedroomSill'],SPEC['windows']['bedroomHead']
LS,LH=SPEC['windows']['livingSill'],SPEC['windows']['livingHead']
wall('north',[.9,0],[9.1,0],.20,[[.85,2.55,WS,WH],[3.12,4.85,WS,WH],[6.1,7.35,.94,2.48]])
wall('west_north',[.9,0],[.9,5.5],.20,[[4.55,5.35,.95,2.35]])
wall('west_step',[0,5.5],[.9,5.5],.20,[[.12,.67,1.35,2.4]])
wall('west_south',[0,5.5],[0,12.9],.20)
wall('south',[0,12.9],[10.5,12.9],.20,[[.72,3.0,WS,WH],[3.86,7.1,LS,LH],[7.9,9.93,WS,WH]])
wall('east_south',[10.5,8.6],[10.5,12.9],.20)
wall('east_notch',[9.1,8.6],[10.5,8.6],.20)
wall('east_north',[9.1,0],[9.1,6.3],.20,[[4.98,6.18,0,2.30]])
wall('east_elevator',[9.1,6.3],[9.1,8.6],.20)
# Interior walls, including real door gaps (not floating door illustrations).
wall('northwest_x',[3.7,0],[3.7,3.4])
wall('x_kitchen',[6.5,0],[6.5,3.4])
wall('northwest_south',[.9,3.4],[3.7,3.4],.16,[[1.76,2.66,0,2.2]])
wall('kitchen_west_return',[6.5,3.4],[7.2,3.4])
wall('kitchen_east_return',[8.3,3.4],[9.1,3.4])
wall('utility_west',[8.3,3.4],[8.3,4.82],.12,[[.12,1.27,0,2.2]])
wall('utility_south',[8.3,4.82],[9.1,4.82],.12)
wall('common_bath_south',[.9,5.5],[3.5,5.5])
wall('common_bath_east',[2.4,3.4],[2.4,5.5],.12,[[.08,1.08,0,2.2]])
wall('basin_east',[3.5,4.7],[3.5,5.5],.12)
wall('masterbath_east',[3,5.5],[3,7.4])
wall('masterbath_south',[0,7.4],[3.5,7.4],.16,[[1.02,1.90,0,2.2]])
wall('master_living',[3.5,5.5],[3.5,12.9],.16,[[.15,1.79,0,2.48],[2.05,2.95,0,2.2]])
wall('living_se',[7.5,6.3],[7.5,12.9],.16,[[1.32,2.22,0,2.2]])
wall('closet_south',[7.5,7.55],[9.1,7.55])
wall('closet_north',[7.5,6.3],[9.1,6.3],.16,[[.28,1.23,0,2.2]])

def bar(name,a,b,r,mat=chrome,layer='fixed'):
    av=Vector((a[0],12.9-a[1],a[2])); bv=Vector((b[0],12.9-b[1],b[2])); delta=bv-av
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=delta.length,location=(av+bv)/2)
    ob=bpy.context.object; ob.name=name
    for c in list(ob.users_collection): c.objects.unlink(ob)
    MODEL.objects.link(ob); ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); ob.data.materials.append(mat); ob['layer']=layer
    for f in ob.data.polygons: f.use_smooth=True
    return ob

def window(name,x,t,width,sill,head,count=2,orientation=0):
    # Local u along opening, plan v normal. Rotation only needed for west openings.
    def pos(u,v): return (x+math.cos(orientation)*u-math.sin(orientation)*v,t+math.sin(orientation)*u+math.cos(orientation)*v)
    divisions=[0,.22,.78,1] if name=='Living_south' else ([0,.20,1] if name=='Kitchen_north' else [i/count for i in range(count+1)])
    for fraction in divisions:
        xx,tt=pos(-width/2+fraction*width,0)
        vertical(name+'_mullion',xx,tt,.052,.07,sill,head,black,rot=-orientation)
    for z in [sill,head]:
        xx,tt=pos(0,0); cube(name+'_rail',xx,tt,z,width,.07,.044,black,'upper' if z>CUT else 'fixed',rot=-orientation)
    for a,b in zip(divisions,divisions[1:]):
        xx,tt=pos(-width/2+(a+b)*width/2,0)
        vertical(name+'_glass',xx,tt,width*(b-a)-.055,.012,sill+.025,head-.025,glass,rot=-orientation)
    # The user requests clear glazing without any safety grille or guard bars.
    cube(name+'_stone_sill',x,t-.025,sill-.025,width+.10,.30,.04,counter,rot=-orientation)
    handlebase=1.66 if name=='Kitchen_north' else max(1.12,sill+.3)
    handlepositions=([-width*.28-.04,width*.28+.04] if name=='Living_south' else
        [-width*.30+.055] if name=='Kitchen_north' else [width/2-.055] if count==1 else [.045])
    for u in handlepositions:
        xx,tt=pos(u,-.06 if t>12 else .06)
        bar(name+'_handle',(xx,tt,handlebase),(xx,tt,handlebase+.15),.012,black,'upper')
    RECORDS.append({'type':'window','id':name,'sill':sill,'head':head,'width':width,'guards':False})

window('NW_north',2.60,0,1.70,WS,WH)
window('X_north',4.885,0,1.73,WS,WH)
window('Kitchen_north',7.625,0,1.25,.94,2.48)
cube('Kitchen_window_fixed_transom',7.750,0,1.32,1.0,.07,.045,black,'upper')
window('Master_south',1.86,12.9,2.28,WS,WH)
window('Living_south',5.48,12.9,3.24,LS,LH,4)
window('SE_south',8.915,12.9,2.03,WS,WH)
window('Bath_west',.9,4.95,.8,.95,2.35,1,math.pi/2)
window('Masterbath_north',.395,5.5,.55,1.35,2.4,1)
rect('Master_low_platform',[.1,12.3,3.42,12.80],.016,.23,counter,room='master')
rect('SE_low_platform',[7.58,12.3,10.40,12.80],.016,.23,counter,room='southeast')

def door(name,hinge,width,angle,closed_dir,room):
    # angle in plan, measured from +X. Door pivots and jamb use the very same point.
    x,t=hinge; rot=-angle
    cx=x+width/2*math.cos(angle); ct=t+width/2*math.sin(angle)
    vertical('door_'+name,cx,ct,width,.044,.025,2.18,oak,room,rot)
    vertical('jamb_'+name,x,t,.055,.18,0,2.22,cabinet,room)
    ex=x+width*math.cos(closed_dir); et=t+width*math.sin(closed_dir)
    vertical('jamb_far_'+name,ex,et,.05,.18,0,2.22,cabinet,room)
    midx=(x+ex)/2; midt=(t+et)/2
    cube('lintel_'+name,midx,midt,2.21,width+.05,.18,.055,cabinet,'upper',room,rot=-closed_dir)
    hx=x+(width-.10)*math.cos(angle); ht=t+(width-.10)*math.sin(angle)
    bar('handle_'+name,(hx,ht,1.0),(hx+.11*math.cos(angle),ht+.11*math.sin(angle),1.0),.013,chrome)
    for z in [.2,.95,1.85]:
        bar('hinge_'+name,(x,t,z),(x,t,z+.08),.012,chrome,'upper' if z>CUT else 'fixed')
    RECORDS.append({'type':'door','id':name,'hinge':hinge,'width':width,'openAngle':angle,'closedDirection':closed_dir,'room':room})

door('northwest',[3.56,3.4],.90,math.radians(233),math.pi,'northwest')
door('master',[3.5,8.45],.90,math.radians(233),-math.pi/2,'master')
door('southeast',[7.5,8.52],.90,math.radians(310),-math.pi/2,'southeast')
door('entry',[9.1,6.18],1.20,math.radians(304),-math.pi/2,'entry')
# Separate X-room and kitchen sliding leaves remain parallel to the east-west wall.
# Photo 3 shows the open position, with overlapping broad glass leaves at the central pier.
def sliding_leaf(name,cx,t,width,room,head=2.51,mat=smoked,fluted=True):
    vertical(name+'_glass',cx,t,width-.024,.008,.045,head-.03,mat,room)
    for x in [cx-width/2,cx+width/2]:vertical(name+'_stile',x,t,.018,.022,.025,head,black,room)
    for z in [.035,head-.01]:cube(name+'_rail',cx,t,z,width+.018,.022,.020,black,'upper' if z>CUT else 'fixed',room)
    # Fine grooves are geometry in the glazing; no accordion-like perpendicular fins.
    for z0,z1,layer in ([ (.055,CUT,'fixed'),(CUT,head-.035,'upper')] if fluted else []):
        verts=[];faces=[]
        for x in np.arange(cx-width/2+.032,cx+width/2-.025,.022):
            k=len(verts);verts.extend([(x,12.9-t-.005,z0),(x+.0012,12.9-t-.005,z0),(x+.0012,12.9-t-.005,z1),(x,12.9-t-.005,z1)]);faces.append((k,k+1,k+2,k+3))
        objmesh(name+'_fluting_'+layer,verts,faces,flutemat,layer,room)
    # Flat recessed pulls keep adjacent parked leaves clear.
    cube(name+'_pull',cx-width/2+.055,t+.013,1.02,.012,.005,.24,black)
    RECORDS.append({'type':'sliding_leaf','id':name,'center':[cx,t],'width':width,'depth':.022,'orientation':'east-west','room':room})
for i in range(3):sliding_leaf('X_retracted_leaf_'+str(i),6.71+i*.012,3.50+i*.024,.94,'xroom')
sliding_leaf('Kitchen_retracted_leaf_0',6.64,3.574,1.10,'kitchen')
cube('North_sliding_header',6.34,3.54,2.575,5.34,.15,.13,black,'upper')
for t in [3.50,3.524,3.548,3.574]:cube('North_sliding_track',6.34,t,2.512,5.34,.008,.009,black,'upper')
# A dark surround is attached to the real jambs, including the inside reveals.
for name,x in [('X_left',3.72),('X_right',6.465),('Kitchen_left',7.19),('Kitchen_right',8.235)]:
    vertical('North_surround_'+name,x,3.405,.048,.21,.015,2.54,black)
for name,x0,x1 in [('X',3.744,6.441),('Kitchen',7.214,8.211)]:
    cube('North_surround_'+name+'_threshold',(x0+x1)/2,3.405,.022,x1-x0,.048,.008,black)
# Bathroom privacy sliding door, stored along the shower-side wall, separate from shower glass.
vertical('Common_bath_sliding_privacy_panel',2.48,4.94,.012,.95,.025,2.17,bathdoor,'commonbath')
for t in [4.46,5.42]:vertical('Common_bath_slider_stile',2.48,t,.022,.018,.025,2.18,black,'commonbath')
for z in [.035,2.17]:cube('Common_bath_slider_rail',2.48,4.94,z,.022,.978,.02,black,'upper' if z>CUT else 'fixed')
cube('Common_bath_sliding_track',2.49,4.45,2.23,.07,2.0,.055,black,'upper','commonbath')
bar('Common_bath_slider_handle',(2.513,4.53,.91),(2.513,4.53,1.12),.009,black)
sliding_leaf('Master_bath_sliding_privacy',2.40,7.505,.94,'masterbath',head=2.18,mat=bathdoor,fluted=False)
for x in [1.015,1.91]:vertical('Master_bath_entry_jamb',x,7.407,.035,.185,0,2.22,black,'masterbath')
cube('Master_bath_entry_head',1.4625,7.407,2.214,.93,.185,.040,black,'upper','masterbath')
cube('Master_bath_sliding_track',1.947,7.505,2.235,1.94,.048,.036,black,'upper','masterbath')

def basin(name,x,t,w=.65,d=.43,back='north'):
    # Recessed bowl with raised ceramic lip, not a flat solid block.
    cube(name+'_bowl_floor',x,t,.85,w-.08,d-.08,.035,white)
    for xx in [x-w/2+.02,x+w/2-.02]: cube(name+'_rim',xx,t,.89,.04,d,.10,white)
    for tt in [t-d/2+.02,t+d/2-.02]: cube(name+'_rim',x,tt,.89,w-.08,.04,.10,white)
    cube(name+'_drain',x,t,.873,.038,.038,.006,chrome)
    sign=1 if back=='south' else -1;tap_t=t+sign*(d/2+.045)
    bar(name+'_tap',(x,tap_t,.92),(x,tap_t,1.15),.018)
    bar(name+'_spout',(x,tap_t,1.15),(x,t+sign*.05,1.15),.017)
    RECORDS.append({'type':'basin','id':name,'center':[x,t],'tap':[x,tap_t],'back':back})

def vanity(name,b,back='north'):
    rect(name+'_cabinet',b,.19,.59,cabinet)
    rect(name+'_counter',b,.79,.045,counter)
    x0,t0,x1,t1=b; basin(name,(x0+x1)/2,(t0+t1)/2,min(.7,x1-x0-.12),back=back)
    # Mirror is above cut height and visible only in full room mode.
    cube(name+'_mirror',(x0+x1)/2,t1-.015 if back=='south' else t0+.015,1.65,x1-x0-.10,.025,.82,chrome,'upper')

vanity('Common_basin',[2.55,4.83,3.42,5.42],'south')
# Photo 3: one continuous wide stone trough with two wall-mounted mixer sets.
# The concave bowl is part of the counter mesh; no solid cabinet fills its cavity.
def trough_ring(x0,t0,x1,t1,z):
    return [(x0,12.9-t1,z),(x1,12.9-t1,z),(x1,12.9-t0,z),(x0,12.9-t0,z)]
verts=(trough_ring(1.0,5.60,2.80,6.20,.91)+trough_ring(1.18,5.715,2.62,6.105,.91)+
       trough_ring(1.24,5.775,2.56,6.045,.745)+trough_ring(1.0,5.60,2.80,6.20,.72))
faces=[]
for i in range(4):
    j=(i+1)%4;faces += [(i,j,j+4,i+4),(i+4,j+4,j+8,i+8),(i+12,j+12,j,i)]
faces += [(8,9,10,11),(15,14,13,12)]
trough=objmesh('Master_double_stone_trough',verts,faces,bathstone,'fixed','masterbath')
uv=trough.data.uv_layers.new(name='Stone_planar_faces')
for face in trough.data.polygons:
    axis=max(range(3),key=lambda k:abs(face.normal[k]))
    for li in face.loop_indices:
        co=trough.data.vertices[trough.data.loops[li].vertex_index].co
        a,b=(co.x,co.y) if axis==2 else ((-co.y,co.z) if axis==0 else (co.x,co.z))
        uv.data[li].uv=(a/1.8,b/1.8)
cube('Master_double_drain',1.90,5.82,.749,.24,.018,.004,chrome,bevel=.001)
vertical('Master_double_backsplash',1.90,5.601,1.84,.016,.91,1.40,bathstone,'masterbath')
# Floating cabinet: center drawers and unequal open display cubbies at the sides.
cube('Master_double_cabinet_back',1.90,5.67,.455,1.79,.07,.49,hallwood)
for x in [1.015,1.325,2.475,2.785]:
    cube('Master_double_cabinet_partition',x,5.91,.455,.028,.49,.49,hallwood)
for z in [.211,.703]:cube('Master_double_cabinet_deck',1.90,5.91,z,1.80,.50,.028,hallwood)
for z0,z1 in [(.23,.455),(.465,.69)]:
    cube('Master_double_drawer',1.90,6.161,(z0+z1)/2,1.125,.027,z1-z0,hallwood)
cube('Master_double_drawer_pull',1.90,6.172,.46,1.13,.015,.012,black,bevel=0)
for x,width,z0,z1 in [(1.165,.265,.23,.69),(2.635,.255,.37,.69)]:
    cube('Master_double_cubby_back',x,5.718,(z0+z1)/2,width,.015,z1-z0,black)
    cube('Master_double_cubby_crystal',x,5.945,z0,width,.43,.018,crystal)
    cube('Master_double_cubby_light',x,5.752,z1-.005,width-.02,.018,.008,led)
cube('Master_double_right_lower_drawer',2.635,6.162,.288,.255,.027,.128,hallwood)
cube('Master_double_underlight',1.90,5.935,.187,1.67,.018,.008,led)
for i,x in enumerate([1.47,2.22]):
    bar('Master_double_spout_rose_'+str(i),(x,5.607,1.225),(x,5.632,1.225),.038,chrome,'upper')
    cube('Master_double_wall_spout_'+str(i),x,5.708,1.218,.041,.17,.028,chrome,'upper')
    bar('Master_double_spout_lip_'+str(i),(x,5.788,1.221),(x,5.794,1.19),.018,chrome,'upper')
    bar('Master_double_control_rose_'+str(i),(x+.13,5.607,1.225),(x+.13,5.636,1.225),.039,chrome,'upper')
    cube('Master_double_control_lever_'+str(i),x+.13,5.649,1.184,.027,.02,.10,chrome,'upper')
    RECORDS.append({'type':'wall_mixer','id':'master_double_'+str(i),'center':[x,5.63],'height':1.225})
cube('Master_double_mirror_frame',1.9,5.647,1.897,1.82,.068,.997,black,'upper')
cube('Master_double_mirror',1.675,5.689,1.897,1.32,.012,.955,mirror,'upper',bevel=.018)
cube('Master_double_mirror_divider',1.63,5.699,1.897,.012,.009,.955,black,'upper')
cube('Master_double_mirror_cubby',2.565,5.697,1.897,.38,.020,.947,black,'upper')
for z in [1.43,1.895,2.355]:
    cube('Master_double_mirror_shelf',2.565,5.766,z,.385,.19,.018,hallwood,'upper')
    cube('Master_double_mirror_crystal',2.565,5.767,z+.014,.35,.16,.016,crystal,'upper')
cube('Master_double_mirror_light',1.9,5.684,1.397,1.77,.016,.01,led,'upper')
RECORDS.append({'type':'double_trough','id':'master','outer_width':1.80,'opening_width':1.44,'mixer_count':2,'one_continuous_bowl':True})

def toilet(name,x,t,angle=0):
    # Rounded ceramic shapes with a distinct seat ring and dark inset.
    def blob(suffix,xx,tt,z,sx,sy,sz,mat):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(xx,12.9-tt,z))
        ob=bpy.context.object; ob.name=name+suffix; ob.scale=(sx,sy,sz); ob.rotation_euler.z=-angle
        for c in list(ob.users_collection):c.objects.unlink(ob)
        MODEL.objects.link(ob); ob.data.materials.append(mat); ob['layer']='fixed'
        for f in ob.data.polygons:f.use_smooth=True
    blob('_pedestal',x,t,.25,.20,.28,.23,white)
    blob('_rim',x,t,.43,.22,.32,.055,white)
    blob('_inner',x,t,.469,.14,.215,.009,capmat)
    bx=x-.25*math.sin(angle); bt=t-.25*math.cos(angle)
    cube(name+'_cistern',bx,bt,.62,.38,.17,.40,white,rot=-angle)
    cube(name+'_flush',bx,bt,.827,.09,.04,.005,chrome,rot=-angle)

toilet('Common_WC',1.42,3.89,math.pi/2)
toilet('Master_WC',2.50,6.82,-math.pi/2)

def shower(name,b,wallx):
    x0,t0,x1,t1=b
    rect(name+'_tray',b,.02,.025,stone)
    t=(t0+t1)/2
    bar(name+'_rail',(wallx,t,.85),(wallx,t,2.13),.017,chrome,'upper')
    bar(name+'_head_arm',(wallx,t,2.13),(wallx+.27,t,2.13),.016,chrome,'upper')
    cube(name+'_rain_head',wallx+.27,t,2.12,.22,.22,.018,chrome,'upper')
    cube(name+'_mixer',wallx+.02,t,.97,.09,.24,.05,chrome)
    cube(name+'_drain',(x0+x1)/2,t1-.12,.05,.20,.08,.006,chrome)
    for i in range(6):cube(name+'_drain_slot',(x0+x1)/2-.075+i*.03,t1-.12,.054,.008,.058,.002,black,bevel=0)

shower('Common_shower',[1.01,4.57,2.33,5.41],1.055)
vertical('Common_shower_glass',1.67,4.55,1.32,.012,.06,2.16,glass)
bar('Common_shower_glass_rail',(1.01,4.55,1.14),(2.33,4.55,1.14),.01,chrome)
shower('Master_shower',[.10,5.60,.89,7.31],.15)
vertical('Master_shower_glass',.94,6.46,.012,1.72,.06,2.16,glass)
bar('Master_shower_handle',(.96,6.75,.9),(.96,6.75,1.1),.012,chrome)

# Photo-based kitchen: U-shaped worktop, fridge at the west entrance, sink north,
# three-burner hob + oven + inclined extractor east. Dimensions remain photo estimates.
rect('Kitchen_north_bases',[6.60,.10,9.0,.72],.10,.61,cabinet,room='kitchen')
rect('Kitchen_north_fronts',[6.60,.69,9.0,.722],.10,.715,cabinet,room='kitchen')
rect('Kitchen_east_bases',[8.38,.72,9.0,3.29],.10,.73,cabinet,room='kitchen')
rect('Kitchen_west_bases',[6.60,.72,7.20,2.0],.10,.73,cabinet,room='kitchen')
rect('Kitchen_east_counter',[8.355,.73,9.0,3.30],.835,.045,counter)
rect('Kitchen_west_counter',[6.60,.73,7.225,1.99],.835,.045,counter)
# Four stone pieces leave a real sink opening instead of a bowl floating on solid stone.
for name,b in [('left',[6.59,.10,7.43,.73]),('right',[8.17,.10,9.0,.73]),('back',[7.43,.10,8.17,.22]),('front',[7.43,.62,8.17,.73])]:
    rect('Kitchen_sink_counter_'+name,b,.835,.045,counter)
rect('Kitchen_sink_bowl_floor',[7.445,.235,8.155,.605],.73,.018,sinkmetal)
for x in [7.43,8.17]:cube('Kitchen_sink_side',x,.42,.805,.018,.4,.15,sinkmetal)
for t in [.22,.62]:cube('Kitchen_sink_end',7.8,t,.805,.74,.018,.15,sinkmetal)
cube('Kitchen_sink_drain',7.8,.42,.752,.065,.065,.009,chrome)
for x in [7.417,8.183]:cube('Kitchen_sink_rim',x,.42,.884,.022,.434,.012,sinkmetal)
for t in [.207,.633]:cube('Kitchen_sink_rim',7.8,t,.884,.788,.022,.012,sinkmetal)
# Swan-neck mixer at the north/window side of the sink.
tap_points=[(7.9,.16,.89),(7.9,.16,1.11),(7.9,.17,1.17),(7.9,.20,1.205),(7.9,.25,1.215),(7.9,.30,1.19),(7.9,.33,1.15)]
for a,b in zip(tap_points,tap_points[1:]):bar('Kitchen_sink_mixer',a,b,.014,chrome,'upper' if min(a[2],b[2])>=CUT else 'fixed')
bar('Kitchen_sink_mixer_lever',(7.935,.16,.96),(7.985,.16,1.06),.009,chrome)

# Continuous recessed handles, individual fronts, black toe-kicks.
for x in [6.61,7.20,7.79,8.38,8.99]:cube('Kitchen_north_door_gap',x,.729,.475,.009,.014,.65,black,bevel=0)
cube('Kitchen_north_handle_recess',7.8,.734,.819,2.4,.018,.034,black,bevel=0)
cube('Kitchen_north_toekick',7.8,.675,.07,2.4,.04,.10,black)
for side,x,t0,t1 in [('east',8.368,.73,3.29),('west',7.212,.74,1.99)]:
    cube('Kitchen_'+side+'_handle_recess',x,(t0+t1)/2,.819,.022,t1-t0,.034,black,bevel=0)
    cube('Kitchen_'+side+'_toekick',x+(.05 if side=='east' else -.05),(t0+t1)/2,.07,.04,t1-t0,.10,black)
for t in [.74,1.25,2.22,2.77,3.28]:cube('Kitchen_east_door_gap',8.365,t,.465,.016,.008,.67,black,bevel=0)
for z in [.38,.60]:cube('Kitchen_drawer_recess',8.355,2.75,z,.025,1.04,.038,black,bevel=0)
for t in [.75,1.36,1.98]:cube('Kitchen_west_door_gap',7.216,t,.465,.016,.008,.67,black,bevel=0)

# Separate cabinet fronts expose the same clean ivory doors and under-cabinet strip as photos.
for i,(a,b) in enumerate([(.73,1.22),(1.22,1.72),(1.72,2.23),(2.23,2.76),(2.76,3.28)]):
    rect('Kitchen_east_upper_'+str(i),[8.67,a+.006,8.998,b-.006],1.57,1.05,cabinet,'upper','kitchen')
for i,(a,b) in enumerate([(.74,1.36),(1.36,1.99)]):
    rect('Kitchen_west_upper_'+str(i),[6.60,a+.006,6.95,b-.006],1.58,1.04,cabinet,'upper','kitchen')
cube('Kitchen_east_backsplash',8.985,2.005,1.21,.024,2.56,.64,cabinet)
cube('Kitchen_west_backsplash',6.614,1.36,1.21,.024,1.24,.64,cabinet)
cube('Kitchen_under_east_light',8.705,2.005,1.557,.036,2.48,.012,led,'upper')
cube('Kitchen_under_west_light',6.90,1.36,1.567,.034,1.21,.012,led,'upper')

# Integrated double-door refrigerator: appliance, central grip, top cabinet and surround.
vertical('Fridge_west_surround',6.865,2.63,.55,1.28,.055,2.62,cabinet,'kitchen')
for i,(a,b) in enumerate([(2.05,2.605),(2.625,3.20)]):
    vertical('Fridge_door_'+str(i),7.162,(a+b)/2,.045,b-a,.125,2.13,fridge,'kitchen')
cube('Fridge_center_grip',7.187,2.615,1.115,.021,.022,2.00,black,bevel=0)
cube('Fridge_bottom_vent',7.175,2.63,.086,.038,1.18,.057,black)
cube('Fridge_top_cabinet',6.887,2.63,2.386,.585,1.25,.45,cabinet,'upper','kitchen')
cube('Fridge_top_reveal',7.191,2.63,2.152,.010,1.25,.022,black,'upper')
vertical('Fridge_front_edge',7.195,3.235,.055,.060,.06,2.63,cabinet,'kitchen')

def cylinder(name,x,t,z,r,h,mat,layer='fixed'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=h,location=(x,12.9-t,z))
    ob=bpy.context.object;ob.name=name
    for c in list(ob.users_collection):c.objects.unlink(ob)
    MODEL.objects.link(ob);ob.data.materials.append(mat);ob['layer']=layer
    for f in ob.data.polygons:f.use_smooth=len(f.vertices)==4
    return ob

cube('Hob_glass',8.666,1.77,.894,.51,.91,.021,appliance)
for i,(x,t,r) in enumerate([(8.66,1.49,.105),(8.66,2.05,.105),(8.83,1.77,.072)]):
    cylinder('Hob_burner_'+str(i),x,t,.915,r,.025,black)
    cylinder('Hob_burner_cap_'+str(i),x,t,.947,r*.77,.035,appliance)
    for angle in [0,math.pi/2,math.pi,math.pi*1.5]:
        xx=x+math.cos(angle)*r;tt=t+math.sin(angle)*r
        cube('Hob_pan_support_'+str(i),xx,tt,.981,r*.72,.024,.042,black,rot=-angle)
for i,t in enumerate([1.59,1.76,1.93]):
    cylinder('Hob_knob_'+str(i),8.456,t,.918,.023,.028,chrome)
    cube('Hob_knob_marker',8.447,t,.935,.025,.007,.003,black,bevel=0)
cube('Oven_surround',8.353,1.75,.453,.029,.68,.64,chrome)
cube('Oven_glass',8.331,1.75,.414,.016,.63,.465,appliance)
cube('Oven_controls',8.326,1.75,.704,.016,.63,.13,black)
cube('Oven_display',8.313,1.75,.715,.007,.17,.041,chrome)
bar('Oven_handle',(8.282,1.475,.612),(8.282,2.025,.612),.016,black)
for t in [1.475,2.025]:bar('Oven_handle_standoff',(8.282,t,.612),(8.332,t,.612),.014,chrome)
# Black-glass inclined extraction panel with metal perimeter, tucked under the upper row.
hood=cube('Extractor_inclined_body',8.66,1.77,1.61,.60,.94,.04,chrome,'upper',bevel=.006);hood.rotation_euler.y=-math.radians(31)
panel=cube('Extractor_inclined_glass',8.652,1.77,1.635,.535,.875,.019,appliance,'upper',bevel=.004);panel.rotation_euler.y=hood.rotation_euler.y
cube('Extractor_rear_housing',8.88,1.77,1.72,.21,.76,.29,black,'upper')
cube('Extractor_control_notch',8.653,1.77,1.65,.026,.23,.18,appliance,'upper')
cube('Kitchen_ceiling_recess',7.81,1.71,2.64,2.38,3.16,.10,ceilingmat,'ceiling')
for x in [6.70,8.97]:cube('Kitchen_ceiling_cove',x,1.79,2.66,.022,3.0,.015,led,'ceiling')
# User metric-v02 markup: SE north wardrobe and reveals are removed.
# The existing wood floor and residential boundary walls remain in place.
# Photo 2: framed taupe timber niche, drawer stack + doors, asymmetrical stone-lit shelves.
rect('Hall_sideboard',[3.08,5.68,3.595,7.26],.09,.735,hallwood)
rect('Hall_sideboard_counter',[3.075,5.665,3.63,7.275],.835,.045,hallstone)
cube('Hall_sideboard_toekick',3.57,6.47,.055,.06,1.58,.065,black)
for a,b in [(5.69,6.21),(6.218,6.735)]:
    cube('Hall_door_front',3.607,(a+b)/2,.457,.024,b-a,.718,hallwood,bevel=.001)
for a,b in [(.10,.334),(.345,.579),(.590,.816)]:
    cube('Hall_drawer_front',3.608,7.001,(a+b)/2,.026,.515,b-a,hallwood,bevel=.001)
for t in [6.214,6.742]:cube('Hall_front_gap',3.616,t,.458,.008,.008,.72,black,bevel=0)
for z in [.339,.584]:cube('Hall_drawer_pull_recess',3.62,7.001,z,.012,.515,.012,black,bevel=0)
vertical('Hall_niche_back',3.075,6.47,.028,1.60,.88,2.44,hallstone)
for t in [5.53,7.37]:
    vertical('Hall_side_pilaster',3.37,t,.61,.25,.025,2.52,hallwood)
    vertical('Hall_pilaster_reveal',3.682,t+.064,.008,.006,.025,2.52,black)
cube('Hall_niche_header',3.37,6.47,2.49,.61,1.92,.105,hallwood,'upper')
cube('Hall_niche_header_shadow',3.66,6.47,2.425,.018,1.60,.025,black,'upper')
for i,(z,t0,t1) in enumerate([(2.115,5.71,7.235),(1.645,5.77,7.22),(1.265,6.54,7.21)]):
    cube('Hall_display_shelf_'+str(i),3.37,(t0+t1)/2,z,.57,t1-t0,.035,hallwood,'upper')
    cube('Hall_shelf_light_'+str(i),3.113,(t0+t1)/2,z-.026,.018,t1-t0-.03,.009,led,'upper')
    # Illuminated stone fascia and offset risers read as the same staggered composition.
    fascia0,fascia1=(t0,t0+.59) if i==0 else ((t1-.63,t1) if i==2 else (t0+.09,t0+.56))
    cube('Hall_stone_fascia_'+str(i),3.668,(fascia0+fascia1)/2,z-.012,.038,fascia1-fascia0,.048,crystal,'upper')
    if i<2:
        riser=t1-.035 if i==0 else t0+.035
        cube('Hall_stone_riser_'+str(i),3.37,riser,z+.145,.56,.065,.26,crystal,'upper')
        cube('Hall_riser_backlight_'+str(i),3.103,riser,z+.145,.013,.10,.25,led,'upper')
cube('Hall_lower_shelf_bracket',3.13,6.59,1.17,.075,.07,.20,black,'upper')
for t in [5.85,6.39,7.09]:cube('Hall_socket',3.096,t,1.005,.016,.063,.063,black)

# Surrounding short wall panels use a 12 mm finish, with restrained dark joints.
for i,(a,b) in enumerate([(4.74,5.10),(5.108,5.40)]):
    vertical('Hall_adjacent_wall_panel_'+str(i),3.59,(a+b)/2,.012,b-a,.02,2.52,hallwood)
    vertical('Hall_adjacent_wall_joint_'+str(i),3.598,a,.005,.007,.02,2.52,black)
cube('Hall_short_wall_top_reveal',3.601,6.14,2.534,.012,2.80,.018,black,'upper')
cube('Hall_short_wall_skirt',3.603,6.14,.035,.014,2.80,.035,black)
for t in [7.55,8.45]:vertical('Hall_master_door_dark_reveal',3.598,t,.014,.054,0,2.22,black)
cube('Hall_master_door_dark_head',3.598,8.0,2.221,.014,.95,.050,black,'upper')

# User metric-v02 markup: omit the external elevator envelope entirely.
# east_elevator and east_notch above still enclose the home; the home outline is unchanged.

# Ceiling/lighting layers recover full-height interior views.
for b in [[3.58,3.50,8.2,3.86],[3.58,12.45,7.42,12.80],[.1,12.45,3.42,12.80],[7.58,12.45,10.4,12.80]]:
    rect('Ceiling_drop',b,2.64,.16,ceilingmat,'ceiling')
for x in [4.1,6.8]:
    for t in [4.3,6.2,8.3,10.3,12.0]:
        cube('Downlight',x,t,2.775,.075,.075,.015,led,'ceiling')
for x,t in [(1.1,9),(2.7,9),(1.1,11),(2.7,11),(8.1,10),(9.8,10),(8.1,11.8),(9.8,11.8),(4.4,1),(5.8,1)]:
    cube('Bedroom_downlight',x,t,2.775,.065,.065,.012,led,'ceiling')

# Crystal scan spans 30 cm; keep flakes fine on narrow illuminated trim faces.
for ob in MODEL.objects:
    if ob.type=='MESH' and crystal in list(ob.data.materials) and ob.data.uv_layers:
        for loop in ob.data.uv_layers.active.data:loop.uv*=1/.30

# Stable machine-readable source data used by checks and browser metadata.
measure={
 'version':SPEC['version'],'height_m':H,'cut_height_m':CUT,
 'coordinate_transform':SPEC['coordinates'], 'chain_sums_m':{k:round(sum(v),6) for k,v in SPEC['chains'].items()},
 'plan_reference_sha256':hashlib.sha256((ROOT/'references/01-floor-plan.png').read_bytes()).hexdigest(),
 'spec_sha256':hashlib.sha256((ROOT/'model/apartment.json').read_bytes()).hexdigest(),
 'reference_v05_sha256':hashlib.sha256((ROOT/'references/generated/house-cutaway-v05.png').read_bytes()).hexdigest(),
 'components':RECORDS,'object_count':len(MODEL.objects),
 'room_clear_width_estimates_m':{
  'northwest':2.62,'xroom':2.64,
  'kitchen':2.42,'master':3.32,
  'living_south':3.84,'southeast_south':2.82
 },
 'clear_estimate_note':'Between assumed wall faces in main rectangular zones, excluding skirting and cabinet projections. Not measured site dimensions or whole-room areas.'
}
(ROOT/'model/measurements.json').write_text(json.dumps(measure,ensure_ascii=False,indent=2)+'\n')
(ROOT/'public/models/apartment.json').write_text(json.dumps(SPEC,ensure_ascii=False,indent=2)+'\n')

# Save a source with all true-height parts. Viewer hides upper/ceiling layers for cutaway.
bpy.ops.object.select_all(action='DESELECT')
for ob in MODEL.objects: ob.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art_src'/f'{STEM}.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/f'{STEM}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)

# Render the actual same geometry for structural review, separate from the GLB export.
for ob in MODEL.objects:
    if ob.get('layer') in ['upper','ceiling']: ob.hide_render=True
scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=True
scene.render.resolution_x=1500; scene.render.resolution_y=1400; scene.render.resolution_percentage=100
scene.world.color=(.75,.75,.75)
scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.80,.83,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
def area(name,location,power,size):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
    ob=bpy.data.objects.new(name,data); PREVIEW.objects.link(ob); ob.location=location
    ob.rotation_euler=(Vector((5,6,0))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Large_softbox',(-3,4,15),1900,10); area('Fill',(11,11,10),1000,8)
bpy.ops.mesh.primitive_plane_add(size=200,location=(5,6,-.205)); ground=bpy.context.object; ground.name='Preview_ground'; ground.data.materials.append(material('Preview_background',(.87,.86,.82)))
for c in list(ground.users_collection):c.objects.unlink(ground)
PREVIEW.objects.link(ground)
camera_data=bpy.data.cameras.new('Review_camera'); cam=bpy.data.objects.new('Review_camera',camera_data); PREVIEW.objects.link(cam)
cam.location=(11,-12,27); target=Vector((5.5,6.1,0)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); camera_data.type='ORTHO'; camera_data.ortho_scale=17.7; scene.camera=cam
scene.view_settings.view_transform='AgX'
scene.render.filepath=str(ROOT/'art_src'/f'{STEM}-cutaway.png'); bpy.ops.render.render(write_still=True)
print('METRIC_MODEL_READY',json.dumps({'objects':len(MODEL.objects),'glb':str(ROOT/'public/models'/f'{STEM}.glb')}))
