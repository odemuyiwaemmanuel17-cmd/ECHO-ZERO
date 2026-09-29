"""Fit licensed scanned equipment to the chamber's real-scale layout and export a local GLB."""
import bpy, os, math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def xyz(p):return (p[0],-p[2],p[1])
def asset(name,height,p,yaw=0):
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'assets','containment','sources',name,name+'.gltf'))
    added=set(bpy.context.scene.objects)-before
    meshes=[o for o in added if o.type=='MESH']
    empties=[o for o in added if o.type!='MESH']
    bpy.context.view_layer.update()
    for o in meshes:
        matrix=o.matrix_world.copy(); o.parent=None; o.matrix_world=matrix
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.join(); o=bpy.context.object
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    verts=[o.matrix_world@Vector(c) for c in o.bound_box]
    lo=Vector([min(v[i] for v in verts) for i in range(3)]); hi=Vector([max(v[i] for v in verts) for i in range(3)])
    bpy.context.scene.cursor.location=((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    scale=height/(hi.z-lo.z); o.scale=(scale,)*3; o.location=xyz(p); o.rotation_euler.z=yaw
    o.name='PH_'+name
    for empty in empties:bpy.data.objects.remove(empty,do_unlink=True)
    print('FITTED',name,'metres',list((hi-lo)*scale),'at',p,flush=True)
asset('wheelchair_01',.98,(2.75,.012,1.5),-.45)
asset('medical_box',.065,(-2.03,.966,2.995),math.pi)
asset('industrial_microscope',.43,(-3.6,.795,-4.55),2.8)
# A functional preparation bench at ordinary 78 cm working height.
steel=bpy.data.materials.new('Prep bench brushed steel'); steel.use_nodes=True
bs=next(n for n in steel.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Base Color'].default_value=(.27,.31,.3,1); bs.inputs['Metallic'].default_value=.8; bs.inputs['Roughness'].default_value=.43
def box(p,s):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p)); o=bpy.context.object; o.name='Prep bench'
    o.dimensions=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(steel)
    mod=o.modifiers.new('Rolled edges','BEVEL');mod.width=.012;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
box((-3.6,.775,-4.55),(1.1,.04,.7))
for x in [-4.08,-3.12]:
    for z in [-4.83,-4.27]:box((x,.38,z),(.035,.76,.035))
box((-3.6,.18,-4.55),(1.02,.025,.62))
dark=steel.copy(); dark.name='Service graphite coating'
bs=next(n for n in dark.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Base Color'].default_value=(.026,.036,.034,1); bs.inputs['Metallic'].default_value=.3; bs.inputs['Roughness'].default_value=.67
def cylinder(name,a,b,r,m):
    va,vb=Vector(xyz(a)),Vector(xyz(b)); d=vb-va
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d.length,location=(va+vb)/2)
    o=bpy.context.object; o.name=name; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    return o
# Recovery cradles have accessible service spines, cooling louvers and keyed coolant ports.
for cx,cz in [(0,-.18),(-3.3,2.5)]:
    rear=cz-.758
    box((cx,1.45,rear),(.72,1.98,.065))
    panel=bpy.context.object; panel.name='Cradle service gasket'; panel.data.materials[0]=dark
    box((cx,1.45,rear-.037),(.62,1.87,.026))
    for y in [1.72+i*.058 for i in range(8)]:
        box((cx,y,rear-.058),(.49,.026,.02)); bpy.context.object.data.materials[0]=dark
    box((cx,1.09,rear-.064),(.5,.5,.03)); bpy.context.object.data.materials[0]=dark
    for dx in [-.17,.17]:
        for y in [.97,1.22]:
            cylinder('Keyed coolant port',(cx+dx,y,rear-.08),(cx+dx,y,rear-.115),.032,steel)
            cylinder('Port sealing cap',(cx+dx,y,rear-.113),(cx+dx,y,rear-.12),.022,dark)
    for dx in [-.27,.27]:
        for y in [.58,1.45,2.32]:cylinder('Rear service fastener',(cx+dx,y,rear-.052),(cx+dx,y,rear-.06),.012,dark)
    c=bpy.data.curves.new('Service legend','FONT'); c.body='COOLANT / 04'; c.size=.045; c.extrude=.0002
    o=bpy.data.objects.new('Cradle service legend',c); bpy.context.collection.objects.link(o); o.location=xyz((cx+.2,2.23,rear-.055)); o.rotation_euler=(math.pi/2,0,math.pi); c.materials.append(dark)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.convert(target='MESH')
# Gas bottle boots rest on a low captive tray; no cylinders suspended above the floor.
box((4.04,.035,3.8),(.91,.07,.47))
for x in [4.25,3.83]:cylinder('Cylinder rubber boot',(x,.065,3.8),(x,.195,3.8),.157,dark)
for z in [.06,.94]:
    a=Vector(xyz((4.70,2.0,z))); b=Vector(xyz((4.455,1.64,z))); d=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.009,depth=d.length,location=(a+b)/2)
    o=bpy.context.object; o.name='Hatch retaining cable'; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); o.data.materials.append(steel)
# Keep authored support details in material batches rather than adding a draw call for every screw.
for m in [steel,dark]:
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==m]
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); bpy.context.object.name='CH_Support_'+m.name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','containment','scanned-equipment.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','containment-props.glb'),export_format='GLB',export_yup=True,export_apply=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
