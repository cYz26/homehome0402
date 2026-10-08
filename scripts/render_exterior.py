"""Display environment adapter. Mesh descriptors are shared with Three.js, not a survey."""
import bpy, math
from mathutils import Vector

def create(data, extent):
    if not data:return []
    collection=bpy.data.collections.new('Display_only_courtyard');bpy.context.scene.collection.children.link(collection)
    point=lambda p:Vector((p[0],extent-p[1],p[2]))
    def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
    materials={}
    for id,c in data['materials'].items():
        m=bpy.data.materials.new('Exterior_'+id);m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF');code=c['color'].lstrip('#')
        color=tuple(linear(int(code[i:i+2],16)/255) for i in [0,2,4])+(1,)
        bs.inputs['Base Color'].default_value=color;bs.inputs['Roughness'].default_value=c['roughness']
        if c.get('emission'):
            bs.inputs['Emission Color'].default_value=color;bs.inputs['Emission Strength'].default_value=c['emission']
        materials[id]=m
    def move(ob,material):
        for c in list(ob.users_collection):c.objects.unlink(ob)
        collection.objects.link(ob);ob.data.materials.append(materials[material]);ob['displayOnly']=True
    for i,b in enumerate(data['boxes']):
        bpy.ops.mesh.primitive_cube_add(size=1,location=point(b['center']));ob=bpy.context.object;ob.name='Exterior_box_'+str(i);ob.scale=b['size'];move(ob,b['material'])
    for i,b in enumerate(data['branches']):
        a,end=point(b['a']),point(b['b']);delta=end-a
        bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=b['r0'],radius2=b['r1'],depth=delta.length,location=(a+end)/2)
        ob=bpy.context.object;ob.name='Exterior_branch_'+str(i);ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler();move(ob,'bark')
    for i,points in enumerate(data['foliage']):
        vertices=[point(points[k:k+3]) for k in range(0,len(points),3)]
        me=bpy.data.meshes.new('Exterior_foliage_'+str(i));me.from_pydata(vertices,[],[(k,k+1,k+2) for k in range(0,len(vertices),3)]);me.update()
        ob=bpy.data.objects.new(me.name,me);collection.objects.link(ob);me.materials.append(materials['leaf'+str(i)]);ob['displayOnly']=True
    return list(collection.objects)
