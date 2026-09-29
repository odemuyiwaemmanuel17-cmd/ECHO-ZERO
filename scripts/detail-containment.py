"""Mechanical detail, laminated-glass surface maps, and compressed delivery export."""
import bpy, math, os, numpy as np
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX=os.path.join(ROOT,'public','textures','containment')
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets','containment','containment.blend'))
def xyz(p): return (p[0],-p[2],p[1])
for o in list(bpy.context.scene.objects):
    if o.name.startswith(('Vent ', 'Guard brace', 'CH_Vent_Fan', 'Bay sign ')): bpy.data.objects.remove(o,do_unlink=True)
def unbaked(source,name):
    m=bpy.data.materials.get(name) or bpy.data.materials[source].copy(); m.name=name
    for n in list(m.node_tree.nodes):
        if n.type=='GROUP' and n.node_tree.name.startswith('glTF Material Output'): m.node_tree.nodes.remove(n)
    return m
steel=unbaked('CH_Brushed_Stainless','CH_Vent_Steel'); dark=unbaked('CH_Anthracite_Powdercoat','CH_Vent_Paint')
def box(name,p,s,m):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p)); o=bpy.context.object; o.name=name
    o.dimensions=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m)
    bevel=o.modifiers.new('Edge radius','BEVEL'); bevel.width=.006; bevel.segments=3; bpy.ops.object.modifier_apply(modifier=bevel.name)
    return o
box('Bay sign backer',(-3.17,2.985,2.879),(1.14,.22,.025),dark)
for x in [-3.5,-2.84]: box('Bay sign mounting post',(x,2.85,2.91),(.025,.27,.025),steel)
def cylinder(name,a,b,r,m):
    va,vb=Vector(xyz(a)),Vector(xyz(b)); d=vb-va
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=d.length,location=(va+vb)/2)
    o=bpy.context.object; o.name=name; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); o.data.materials.append(m)
    for f in o.data.polygons: f.use_smooth=True
    return o
def ring(name,p,r,minor,m):
    bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=8,location=xyz(p),major_radius=r,minor_radius=minor)
    o=bpy.context.object; o.name=name; o.rotation_euler=(0,math.pi/2,0); o.data.materials.append(m)
    for f in o.data.polygons: f.use_smooth=True
    return o
# Ventilation unit: five swept blades behind a safety cage, mounted flush with the east wall.
cylinder('Vent backing',(4.78,2.15,-3.6),(4.82,2.15,-3.6),.34,dark)
ring('Vent cast rim',(4.72,2.15,-3.6),.34,.027,steel)
before=set(bpy.context.scene.objects)
cylinder('Fan hub',(4.65,2.15,-3.6),(4.74,2.15,-3.6),.065,steel)
for i in range(5):
    a=i*math.tau/5; verts=[]
    for r,t,x in [(.05,a,4.69),(.28,a+.24,4.69),(.30,a+.61,4.72),(.1,a+.64,4.73)]:
        verts.append(xyz((x,2.15+math.sin(t)*r,-3.6+math.cos(t)*r)))
    mesh=bpy.data.meshes.new('Swept fan blade'); mesh.from_pydata(verts,[],[(0,1,2,3)]); mesh.update()
    o=bpy.data.objects.new('Fan blade',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(steel)
    bpy.context.view_layer.objects.active=o
    solid=o.modifiers.new('Sheet thickness','SOLIDIFY'); solid.thickness=.004; bpy.ops.object.modifier_apply(modifier=solid.name)
parts=list(set(bpy.context.scene.objects)-before)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); fan=bpy.context.object; fan.name='CH_Vent_Fan'
bpy.context.scene.cursor.location=xyz((4.69,2.15,-3.6)); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); fan['mechanism']=True
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
for r in [.12,.22,.32]: ring('Vent guard',(4.6,2.15,-3.6),r,.007,steel)
for angle in [0,math.pi/2]:
    y,z=math.sin(angle)*.32,math.cos(angle)*.32
    cylinder('Guard brace',(4.59,2.15-y,-3.6-z),(4.59,2.15+y,-3.6+z),.009,steel)
# Small irregular condensation droplets: a normal/roughness response, not an opaque glass tint.
size=512; yy,xx=np.mgrid[0:size,0:size]; height=np.zeros((size,size),dtype=np.float32)
rng=np.random.default_rng(81)
for _ in range(430):
    cx,cy=rng.uniform(0,size,2); rx=rng.uniform(.8,3.2); ry=rx*rng.uniform(1,2.4)
    d=((xx-cx)/rx)**2+((yy-cy)/ry)**2
    height=np.maximum(height,np.maximum(0,1-d)**2*.12)
gy,gx=np.gradient(height)
normal=np.empty((size,size,4),dtype=np.float32)
normal[:,:,0]=.5-gx*1.3; normal[:,:,1]=.5-gy*1.3; normal[:,:,2]=1; normal[:,:,3]=1
image=bpy.data.images.new('Condensation normal',width=size,height=size,alpha=False); image.colorspace_settings.name='Non-Color'
image.pixels.foreach_set(normal.ravel()); image.filepath_raw=os.path.join(TEX,'condensation-normal.png'); image.file_format='PNG'; image.save()
m=bpy.data.materials['CH_Laminated_Glass']; tree=m.node_tree
bs=next(n for n in tree.nodes if n.type=='BSDF_PRINCIPLED')
tex=tree.nodes.new('ShaderNodeTexImage'); tex.image=image
uv=tree.nodes.new('ShaderNodeUVMap'); uv.uv_map='UVMap'; tree.links.new(uv.outputs['UV'],tex.inputs['Vector'])
n=tree.nodes.new('ShaderNodeNormalMap'); n.inputs['Strength'].default_value=.55
tree.links.new(tex.outputs['Color'],n.inputs['Color']); tree.links.new(n.outputs['Normal'],bs.inputs['Normal'])
for o in bpy.context.scene.objects:
    if o.type!='MESH' or m not in list(o.data.materials): continue
    if not o.data.uv_layers: o.data.uv_layers.new(name='UVMap')
    for li in o.data.loops:
        v=o.data.vertices[li.vertex_index].co
        o.data.uv_layers[0].data[li.index].uv=(v.x*2,v.z*2)
for o in bpy.context.scene.objects:
    if o.type!='MESH' or not o.get('mechanism'): continue
    for slot in o.material_slots:
        m=slot.material
        if any(n.type=='GROUP' and n.node_tree.name.startswith('glTF Material Output') for n in m.node_tree.nodes):
            slot.material=unbaked(m.name,m.name+'_Moving')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','containment','containment.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','containment.glb'),export_format='GLB',export_apply=True,export_yup=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
print('DETAIL_EXPORT_COMPLETE',flush=True)
