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

wallmat=material('Warm_white_plaster',(0.80,.78,.71))
capmat=material('Thin_graphite_cut_edge',(.14,.16,.16),.55)
oak=material('Natural_oak_joinery',(.47,.37,.25),.55)
cabinet=material('Warm_ivory_cabinet',(.69,.66,.56),.5)
white=material('Porcelain',(.90,.91,.87),.23)
chrome=material('Brushed_steel',(.48,.53,.52),.28,.8)
black=material('Graphite_frame',(.035,.045,.047),.37,.35)
glass=material('Clear_glass',(.69,.85,.86),.15,0,.18)
stone=material('Greige_limestone',(.64,.61,.53),.4)
counter=material('Ivory_stone_counter',(.83,.80,.71),.3)
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
    mix.inputs[7].default_value=(factor,factor,factor,1)
    m.node_tree.links.new(t.outputs['Color'],mix.inputs[6])
    m.node_tree.links.new(mix.outputs[2],nodes.get('Principled BSDF').inputs['Base Color'])
textured(stone,stoneimg); textured(counter,stoneimg)
woods=[]
for i in range(6):
    m=material('Oak_plank_%02d'%i,(.6,.52,.4),.54)
    # A portable base-color image; plank UV offsets avoid identical adjacent grain.
    textured(m,woodimg,[.66,.72,.8,.88,.96,1.0][i]); woods.append(m)

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
        for i,li in enumerate(poly.loop_indices): uv.data[li].uv=[(0,0),(w,0),(w,d),(0,d)][i]
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
    uv=[(x/1.2,y/1.2) for x,y in coords]*2
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
prism('Ceiling_main',SPEC['outline'],H,.06,wallmat,'ceiling')

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

# Outer walls; hole dimensions are (distance along wall, end, sill, head).
wall('north',[.9,0],[9.1,0],.20,[[.85,2.55,.78,2.48],[3.12,4.85,.78,2.48],[6.1,7.35,.94,2.48]])
wall('west_north',[.9,0],[.9,5.5],.20,[[4.55,5.35,.95,2.35]])
wall('west_step',[0,5.5],[.9,5.5],.20,[[.12,.67,1.35,2.4]])
wall('west_south',[0,5.5],[0,12.9],.20)
wall('south',[0,12.9],[10.5,12.9],.20,[[.72,3.0,.65,2.50],[3.86,7.1,.16,2.5],[7.9,9.93,.65,2.5]])
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
    divisions=[0,.22,.78,1] if name=='Living_south' else [i/count for i in range(count+1)]
    for fraction in divisions:
        xx,tt=pos(-width/2+fraction*width,0)
        vertical(name+'_mullion',xx,tt,.052,.07,sill,head,black,rot=-orientation)
    for z in [sill,head]:
        xx,tt=pos(0,0); cube(name+'_rail',xx,tt,z,width,.07,.044,black,'upper' if z>CUT else 'fixed',rot=-orientation)
    for a,b in zip(divisions,divisions[1:]):
        xx,tt=pos(-width/2+(a+b)*width/2,0)
        vertical(name+'_glass',xx,tt,width*(b-a)-.055,.012,sill+.025,head-.025,glass,rot=-orientation)
    # Low sill and safety rail read correctly in both the full-height and cutaway model.
    cube(name+'_stone_sill',x,t-.025,sill-.025,width+.10,.30,.04,counter,rot=-orientation)
    if sill<.8:
        for u in np.linspace(-width/2+.07,width/2-.07,max(3,int(width/.22))):
            xx,tt=pos(float(u),-.055); bar(name+'_guard',(xx,tt,sill+.03),(xx,tt,1.02),.009,black)
        p,q=pos(-width/2,-.055),pos(width/2,-.055); bar(name+'_guard_top',(*p,1.02),(*q,1.02),.012,black)

window('NW_north',2.60,0,1.70,.78,2.48)
window('X_north',4.885,0,1.73,.78,2.48)
window('Kitchen_north',7.625,0,1.25,.94,2.48)
window('Master_south',1.86,12.9,2.28,.65,2.50)
window('Living_south',5.48,12.9,3.24,.16,2.50,4)
window('SE_south',8.915,12.9,2.03,.65,2.50)
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
# Retracted X room panels: five parallel leaves next to right jamb, clear middle opening.
for i in range(5):
    vertical('X_retracted_leaf_'+str(i),6.24+i*.043,3.38,.032,.54,0,2.24,black,'xroom')
cube('X_upper_track',5.1,3.40,2.27,2.8,.18,.045,black,'upper','xroom')
cube('X_floor_track',5.1,3.40,.028,2.8,.055,.013,chrome)
# Bathroom privacy sliding door, stored along the shower-side wall, separate from shower glass.
vertical('Common_bath_sliding_privacy_panel',2.48,4.94,.044,.97,.025,2.17,cabinet,'commonbath')
cube('Common_bath_sliding_track',2.49,4.45,2.23,.07,2.0,.055,black,'upper','commonbath')
bar('Common_bath_slider_handle',(2.515,4.53,.91),(2.515,4.53,1.12),.012,chrome)

def basin(name,x,t,w=.65,d=.43):
    # Recessed bowl with raised ceramic lip, not a flat solid block.
    cube(name+'_bowl_floor',x,t,.85,w-.08,d-.08,.035,white)
    for xx in [x-w/2+.02,x+w/2-.02]: cube(name+'_rim',xx,t,.89,.04,d,.10,white)
    for tt in [t-d/2+.02,t+d/2-.02]: cube(name+'_rim',x,tt,.89,w-.08,.04,.10,white)
    cube(name+'_drain',x,t,.873,.038,.038,.006,chrome)
    bar(name+'_tap',(x,t-d/2-.045,.92),(x,t-d/2-.045,1.15),.018)
    bar(name+'_spout',(x,t-d/2-.045,1.15),(x,t-.05,1.15),.017)

def vanity(name,b):
    rect(name+'_cabinet',b,.19,.59,cabinet)
    rect(name+'_counter',b,.79,.045,counter)
    x0,t0,x1,t1=b; basin(name,(x0+x1)/2,(t0+t1)/2,min(.7,x1-x0-.12))
    # Mirror is above cut height and visible only in full room mode.
    cube(name+'_mirror',(x0+x1)/2,t0+.015,1.65,x1-x0-.10,.025,.82,chrome,'upper')

vanity('Common_basin',[2.55,4.83,3.42,5.42])
vanity('Master_basin',[1.0,5.60,2.80,6.14])

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

# Fitted kitchen, opposite edge width remains exactly the 2.6 m dimension segment.
rect('Kitchen_north_bases',[6.60,.10,9.0,.72],.10,.74,cabinet,room='kitchen')
rect('Kitchen_north_counter',[6.59,.10,9.0,.73],.84,.04,counter)
rect('Kitchen_east_bases',[8.38,.72,9.0,3.29],.10,.74,cabinet,room='kitchen')
rect('Kitchen_east_counter',[8.37,.71,9.0,3.30],.84,.04,counter)
vertical('Kitchen_west_tall',6.89,1.84,.57,3.04,.10,2.48,cabinet,'kitchen')
for x in np.arange(6.7,9,.46):cube('Kitchen_front_gap',float(x),.725,.48,.007,.013,.70,capmat,bevel=0)
for t in np.arange(.85,3.3,.52):cube('Kitchen_east_front_gap',8.373,float(t),.48,.012,.006,.70,capmat,bevel=0)
basin('Kitchen_sink',7.69,.425,.66,.42)
cube('Hob',8.70,1.64,.894,.47,.78,.022,black)
for t in [1.43,1.87]:
    bpy.ops.mesh.primitive_torus_add(major_radius=.09,minor_radius=.012,major_segments=20,minor_segments=8,location=(8.70,12.9-t,.914))
    ob=bpy.context.object; ob.name='Hob_burner'; ob.data.materials.append(chrome)
    for c in list(ob.users_collection):c.objects.unlink(ob)
    MODEL.objects.link(ob); ob['layer']='fixed'
cube('Oven_glass',8.365,1.65,.49,.014,.58,.48,black)
bar('Oven_handle',(8.345,1.42,.67),(8.345,1.88,.67),.012)
rect('Kitchen_wall_cabinets',[8.66,.8,9.0,3.18],1.57,.95,cabinet,'upper')
cube('Kitchen_under_cabinet_light',8.73,1.95,1.555,.04,2.35,.012,led,'upper')
cube('Extractor_hood',8.55,1.65,1.60,.38,.62,.12,black,'upper')
# User metric-v02 markup: SE north wardrobe and reveals are removed.
# The existing wood floor and residential boundary walls remain in place.
# Photo 2 public niche, limited to the west central hall (not either long living wall).
rect('Hall_sideboard',[3.08,5.67,3.59,7.27],.10,.75,oak)
rect('Hall_sideboard_counter',[3.06,5.65,3.60,7.29],.85,.045,counter)
vertical('Hall_niche_back',3.065,6.47,.025,1.6,0,2.48,oak)
for z in [1.35,1.95]:
    cube('Hall_niche_shelf',3.32,6.47,z,.51,1.55,.035,oak,'upper')
    cube('Hall_niche_shelf_light',3.51,6.47,z-.025,.02,1.5,.012,led,'upper')

# User metric-v02 markup: omit the external elevator envelope entirely.
# east_elevator and east_notch above still enclose the home; the home outline is unchanged.

# Ceiling/lighting layers recover full-height interior views.
for b in [[3.58,3.50,8.2,3.86],[3.58,12.45,7.42,12.80],[.1,12.45,3.42,12.80],[7.58,12.45,10.4,12.80]]:
    rect('Ceiling_drop',b,2.64,.16,wallmat,'ceiling')
for x in [4.1,6.8]:
    for t in [4.3,6.2,8.3,10.3,12.0]:
        cube('Downlight',x,t,2.775,.075,.075,.015,led,'ceiling')
for x,t in [(1.1,9),(2.7,9),(1.1,11),(2.7,11),(8.1,10),(9.8,10),(8.1,11.8),(9.8,11.8),(4.4,1),(5.8,1)]:
    cube('Bedroom_downlight',x,t,2.775,.065,.065,.012,led,'ceiling')

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
