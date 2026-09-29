"""Blender-authored, metre-scale containment benchmark. Run with Blender --background --python.
Coordinates passed to helpers are game coordinates (Y up). Editable source is saved beside exports.
Static geometry is consolidated by material; independently moving mechanisms retain named nodes.
"""
import bpy, math, random, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
TEX = os.path.join(ROOT, 'public', 'textures', 'containment')
random.seed(19)
print('Authoring with Blender', bpy.app.version_string)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def xyz(p): return (p[0], -p[2], p[1])
def mat(name, color, metal=0, rough=.5, source=None, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal
    bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1)
        bs.inputs['Emission Strength'].default_value=emission
    if source:
        for suffix, socket in [('Diffuse','Base Color'),('rough','Roughness'),('nor_gl','Normal')]:
            path=os.path.join(TEX,source+'_'+suffix+'.jpg')
            image=bpy.data.images.load(path,check_existing=True)
            if suffix!='Diffuse': image.colorspace_settings.name='Non-Color'
            n=m.node_tree.nodes.new('ShaderNodeTexImage'); n.image=image
            if suffix=='nor_gl':
                normal=m.node_tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value=.38
                m.node_tree.links.new(n.outputs['Color'],normal.inputs['Color'])
                m.node_tree.links.new(normal.outputs['Normal'],bs.inputs[socket])
            else: m.node_tree.links.new(n.outputs['Color'],bs.inputs[socket])
    return m

floor=mat('CH_Floor_Concrete',(.25,.28,.28),rough=.85,source='concrete_floor_worn_001')
paint=mat('CH_Ivory_Enamel',(.56,.59,.55),.18,.36)
dark=mat('CH_Anthracite_Powdercoat',(.042,.056,.06),.5,.48)
steel=mat('CH_Brushed_Stainless',(.38,.43,.43),.88,.29)
rubber=mat('CH_Rubber_Seals',(.009,.014,.015),0,.87)
blue=mat('CH_Service_Paint',(.11,.22,.25),.62,.5,source='blue_metal_plate')
cloth=mat('CH_Mattress',(.12,.17,.16),0,.94)
amber=mat('CH_Ochre_Identification',(.53,.26,.055),.2,.53)
red=mat('CH_Oxide_Damage',(.13,.04,.02),.15,.94)
light=mat('CH_Fixture_Diffuser',(.77,.85,.82),0,.34,emission=3)
warm=mat('CH_Emergency_Lamp',(1,.29,.055),0,.28,emission=3)
screen=mat('CH_Display_Glass',(.018,.085,.08),.25,.2,emission=.4)
ink=mat('CH_Print',(.66,.71,.66),0,.6)
glass=mat('CH_Laminated_Glass',(.65,.84,.8),0,.14)
bs=next(n for n in glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Transmission Weight'].default_value=.96; bs.inputs['IOR'].default_value=1.46

def finish(o,name,m,bevel=0):
    o.name=name; o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Manufactured edge radius','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons: f.use_smooth=True
    mod=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    bpy.context.view_layer.objects.active=o
    try: bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError: pass
    return o

def box(name,p,s,m,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p)); o=bpy.context.object
    o.dimensions=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m,min(bevel,min(s)*.3))

def rod(name,a,b,r,m,vertices=24):
    va,vb=Vector(xyz(a)),Vector(xyz(b)); delta=vb-va
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=delta.length,location=(va+vb)/2)
    o=bpy.context.object; o.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return finish(o,name,m,.004 if r>.02 else .001)

def tube(name,points,r,m):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=10
    c.bevel_depth=r; c.bevel_resolution=3
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):
        p.co=xyz(co); p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH'); return bpy.context.object

def label(text,p,size=.12,m=ink):
    # Text lies on a front-facing vertical surface, toward the player's +Z approach.
    c=bpy.data.curves.new('Etched label','FONT'); c.body=text; c.size=size; c.extrude=.0003
    o=bpy.data.objects.new('Label '+text,c); bpy.context.collection.objects.link(o)
    o.location=xyz(p); o.rotation_euler=(math.pi/2,0,math.pi)
    o.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH'); return bpy.context.object

def bolts(p,w,h):
    for x in [-w/2+.045,w/2-.045]:
        for y in [-h/2+.045,h/2-.045]:
            rod('Captive fastener',(p[0]+x,p[1]+y,p[2]-.007),(p[0]+x,p[1]+y,p[2]-.016),.014,steel,8)

def assembly(name,objects,pivot=(0,0,0)):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name=name
    bpy.context.scene.cursor.location=xyz(pivot); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o['mechanism']=True
    return o

def capture(): return set(bpy.context.scene.objects)
def since(before): return list(set(bpy.context.scene.objects)-before)

# Architecture: 10 x 12 metres; suspended service ceiling at 3.15 m.
f=box('Continuous sealed floor',(0,-.1,0),(10,.2,12),floor,.006)
# Metric UVs prevent a single enormous texture stretching over the floor.
for loop in f.data.loops:
    v=f.data.vertices[loop.vertex_index].co
    f.data.uv_layers.active.data[loop.index].uv=(v.x/2.5,v.y/2.5)
box('Ceiling acoustic substrate',(0,3.29,0),(10,.18,12),dark)
for side in [-1,1]:
    box('Insulated shell',(side*5,1.65,0),(.16,3.3,12),dark)
    box('Service plinth',(side*4.86,.15,0),(.15,.3,12),steel)
    for j,z in enumerate([-5,-3,-1,1,3,5]):
        box('Wall enamel panel',(side*4.88,1.45,z),(.12,2.5,1.96),paint,.024)
        box('Wall recessed service strip',(side*4.78,.57,z),(.13,.16,1.92),dark)
        box('Wall bumper rail',(side*4.69,.8,z),(.14,.095,1.94),rubber)
    for y,r in [(2.83,.055),(3.0,.035)]:
        rod('Main return pipe',(side*4.58,y,-5.8),(side*4.58,y,5.8),r,steel)
        for z in [-5,-2.5,0,2.5,5]:
            rod('Pipe coupling',(side*4.58,y,z-.045),(side*4.58,y,z+.045),r*1.4,dark)
            box('Pipe hanger',(side*4.58,3.1,z),(.035,.22,.075),steel)
for z in [-5,-3,-1,1,3,5]:
    for x in [-3,0,3]:
        box('Ceiling cassette',(x,3.16,z),(2.93,.07,1.94),paint,.01)
    box('Ceiling cross rail',(0,3.10,z+1),(9.85,.1,.055),steel)
for x,z in [(-2.8,2.3),(2.8,-2),(.0,4.8)]:
    box('Luminaire housing',(x,3.05,z),(.55,.14,1.8),dark,.04)
    box('Luminaire reflector',(x,2.97,z),(.48,.035,1.65),steel)
    box('Luminaire diffuser',(x,2.945,z),(.34,.02,1.5),light,.009)
    for dz in [-.72,.72]: box('Luminaire endcap',(x,2.94,z+dz),(.49,.08,.12),paint)
# Cable tray on the damaged east side; real curved sagging cables, restrained repetition.
for x in [3.85,4.18]: box('Tray rail',(x,2.82,0),(.04,.11,11.5),steel)
for z in range(-5,6): box('Tray rung',(4.015,2.78,z),(.36,.03,.055),steel)
for j in range(5):
    x=3.89+j*.048
    tube('Supply loom',[(x,2.82,-5.7),(x,2.81,-1),(x-.1,2.47,1.2),(x,2.82,3),(x,2.82,5.7)],.017,rubber)
# Rear wall and exit bulkhead. Passage matches the existing movement gate width.
box('Rear wall',(0,1.65,-6),(10,3.3,.18),paint)
for x in [-3.4,3.4]: box('Exit wall',(x,1.65,5.96),(3.2,3.3,.2),paint)
box('Exit lintel',(0,2.87,5.96),(3.6,.86,.24),dark)
for x in [-1.73,1.73]:
    box('Door jamb',(x,1.23,5.85),(.16,2.46,.38),steel,.04)
    box('Compression gasket',(x*.94,1.2,5.74),(.055,2.38,.04),rubber)
box('Door overhead track',(0,2.46,5.85),(3.6,.18,.4),steel)
box('Door threshold',(0,.02,5.86),(3.45,.04,.52),steel,.006)
for side in [-1,1]:
    before=capture(); x=side*.79
    box('Armoured door leaf',(x,1.19,5.96),(1.56,2.34,.15),dark,.035)
    box('Door enamel insert',(x,1.2,5.86),(1.38,2.12,.045),paint,.045)
    box('Door waist impact plate',(x,.76,5.825),(1.34,.38,.022),steel)
    box('Leaf seam seal',(side*.022,1.2,5.79),(.025,2.28,.025),rubber,.005)
    box('Door observation inset',(x,1.75,5.82),(.65,.26,.035),rubber)
    box('Door observation glass',(x,1.75,5.79),(.59,.2,.012),glass,.007)
    bolts((x,1.2,5.81),1.36,2.1)
    assembly('CH_Door_Left' if side<0 else 'CH_Door_Right',since(before))
label('01  /  CONTAINMENT',(.94,2.74,5.70),.16)
label('AUTHORIZED PERSONNEL',(.85,2.56,5.70),.065)
box('Access reader',(2,1.35,5.76),(.19,.32,.12),dark,.028)
box('Access reader indicator',(2,1.43,5.68),(.1,.04,.008),warm)

def pod(cx,cz,primary=False):
    # Standing recovery cradle: open central footwell, sculpted shell, laminated curved canopy.
    box('Pod isolation footing',(cx,.10,cz), (1.92,.2,1.6),dark,.09)
    box('Pod stainless base',(cx,.23,cz),(1.78,.12,1.48),steel,.04)
    box('Back shell',(cx,1.48,cz-.6),(1.6,2.48,.25),paint,.075)
    box('Upholstered backrest',(cx,1.45,cz-.42),(1.02,1.85,.19),cloth,.055)
    box('Head cushion',(cx,2.15,cz-.29),(.48,.36,.14),cloth,.05)
    for side in [-1,1]:
        tube('Pod cast side frame',[(cx+side*.83,.22,cz+.53),(cx+side*.86,1.5,cz+.4),(cx+side*.77,2.62,cz+.14),(cx+side*.5,2.76,cz-.4)],.065,paint)
        rod('Cradle actuator',(cx+side*.66,.4,cz-.27),(cx+side*.66,1.45,cz-.27),.033,steel)
        rod('Piston sleeve',(cx+side*.66,.35,cz-.27),(cx+side*.66,.82,cz-.27),.052,dark)
        box('Arm support',(cx+side*.57,1.02,cz-.01),(.2,.14,.7),cloth,.055)
        tube('Life support hose',[(cx+side*.75,1.95,cz-.53),(cx+side*1.08,1.63,cz-.54),(cx+side*1.0,.47,cz-.32),(cx+side*.76,.35,cz-.1)],.029,rubber)
        for y in [.54,2.34]: rod('Canopy latch',(cx+side*.86,y,cz+.3),(cx+side*.86,y+.16,cz+.3),.024,steel)
    box('Pod header',(cx,2.66,cz-.12),(1.65,.21,.78),paint,.075)
    box('Patient task light',(cx,2.55,cz-.05),(.65,.025,.12),light)
    label('EZ / '+('01' if primary else '02'),(cx+.4,2.68,cz+.29),.11,dark)
    before=capture()
    # A swept circular window, not a flat tinted plane. Thickness exported as closed surfaces.
    verts=[]; faces=[]; n=40
    for inset in [0,.014]:
        for y in [.34,2.48]:
            for i in range(n+1):
                a=-1.07+2.14*i/n
                verts.append(xyz((cx+(.86-inset)*math.sin(a),y,cz-.08+(.86-inset)*math.cos(a))))
    stride=n+1
    for layer in [0,2]:
        for i in range(n):
            q=layer*stride+i; faces.append((q,q+1,q+1+stride,q+stride))
    for row in [0,1]:
        for i in range(n):
            q=row*stride+i; faces.append((q,q+2*stride,q+2*stride+1,q+1))
    for i in [0,n]: faces.append((i,i+stride,i+3*stride,i+2*stride))
    mesh=bpy.data.meshes.new('Curved laminated shell'); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new('Canopy glass',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(glass)
    for f in mesh.polygons: f.use_smooth=True
    for y in [.34,2.48]:
        tube('Canopy seal',[(cx+.87*math.sin(-1.07+2.14*i/12),y,cz-.08+.87*math.cos(-1.07+2.14*i/12)) for i in range(13)],.026,rubber)
    for side in [-1,1]:
        rod('Canopy edge rail',(cx+side*.75,.32,cz+.33),(cx+side*.75,2.5,cz+.33),.03,steel)
    assembly('CH_Pod_Canopy' if primary else 'CH_Bay_Canopy',since(before),(cx-.78,1.4,cz+.32))

pod(0,-.18,True)
pod(-3.3,2.5)
# Medical cart with casters, folded tray lips, drawer fronts, ventilator and screen.
def cart(x,z):
    for dx in [-.38,.38]:
        for dz in [-.25,.25]:
            rod('Caster axle',(x+dx-.04,.105,z+dz),(x+dx+.04,.105,z+dz),.09,rubber,32)
            rod('Caster stem',(x+dx,.12,z+dz),(x+dx,.25,z+dz),.025,steel)
            rod('Trolley leg',(x+dx,.24,z+dz),(x+dx,.94,z+dz),.025,steel)
    box('Trolley lower shelf',(x,.3,z),(.86,.045,.6),steel)
    box('Equipment drawer carcass',(x,.7,z),(.85,.37,.62),paint,.03)
    for y in [.61,.77]:
        box('Drawer front',(x,y,z-.325),(.78,.14,.026),paint)
        rod('Drawer handle',(x-.17,y,z-.37),(x+.17,y,z-.37),.012,steel)
    box('Tray deck',(x,.94,z),(.95,.045,.69),steel)
    for dx in [-.46,.46]: box('Raised tray lip',(x+dx,.975,z),(.025,.07,.68),steel)
    box('Patient monitor housing',(x,1.25,z+.04),(.55,.4,.16),paint,.035)
    box('Monitor black surround',(x,1.26,z-.054),(.49,.31,.025),rubber)
    box('Live monitor',(x,1.26,z-.07),(.435,.255,.008),screen,.002)
    for dx in [-.16,-.08,0,.08,.16]: rod('Monitor control',(x+dx,1.08,z-.08),(x+dx,1.08,z-.09),.012,steel)
    tube('ECG patient cable',[(x+.21,1.12,z),(x+.59,.8,z),(x+.56,.04,z-.18),(x+.21,.027,z-.5),(x-.3,.024,z-.6)],.008,rubber)
cart(-2.03,3.2)
cart(3.55,-2.5)
# Gas bottle bank, pressure regulators and metal straps.
for j in range(2):
    x=4.25-j*.42; z=3.8
    rod('Oxygen cylinder',(x,.17,z),(x,1.25,z),.15,blue,40)
    rod('Cylinder shoulder',(x,1.23,z),(x,1.35,z),.10,steel,32)
    rod('Valve neck',(x,1.32,z),(x,1.45,z),.028,steel)
    rod('Valve handwheel',(x-.075,1.45,z),(x+.075,1.45,z),.019,dark)
    for y in [.4,1.02]: rod('Bottle retaining band',(x,y-.02,z),(x,y+.02,z),.157,steel,40)
    rod('Pressure gauge',(x,1.43,z-.06),(x,1.43,z-.11),.055,steel,32)
    rod('Gauge dial',(x,1.43,z-.111),(x,1.43,z-.115),.047,paint,32)
    tube('Regulator hose',[(x,1.42,z),(x-.24,1.53,z),(x-.31,.3,z),(x-.6,.04,z-.2)],.014,rubber)
# Wall services and medicine storage: doors with inset seams, kickplates and hinge hardware.
for x in [2.7,3.5,4.3]:
    box('Storage cabinet',(x,1.22,-5.45),(.76,2.3,.68),dark,.025)
    box('Cabinet door',(x,1.25,-5.06),(.7,2.16,.055),paint,.018)
    rod('Cabinet pull',(x-.22,1.08,-5.01),(x-.22,1.4,-5.01),.013,steel)
    box('Cabinet footplate',(x,.16,-5.04),(.67,.14,.015),steel)
    for y in [.42,1.92]: box('Cabinet hinge',(x+.33,y,-5.03),(.025,.085,.025),steel)
# An IV pole and hanging fluid bag; gravity-shaped transparent bag and flexible line.
rod('IV pole',(-4.1,.12,1.2),(-4.1,2.3,1.2),.013,steel)
for a in range(5):
    t=a*math.tau/5
    rod('IV base',(-4.1,.12,1.2),(-4.1+math.cos(t)*.3,.09,1.2+math.sin(t)*.3),.018,steel)
tube('IV hook',[(-4.1,2.25,1.2),(-3.91,2.35,1.2),(-3.85,2.24,1.2)],.01,steel)
box('Saline bag',(-3.86,2.0,1.2),(.16,.3,.07),glass,.03)
tube('IV line',[(-3.86,1.85,1.2),(-3.8,1.6,1.2),(-3.7,.4,1.5),(-3.6,.06,1.8)],.003,glass)
# Damaged service hatch: bent lid, exposed feed, fallen fragments (kept out of centre route).
box('Open service recess',(4.73,1.69,.5),(.13,.72,1.1),rubber)
for z in [.12,.42,.72]:
    tube('Exposed feed',[(4.7,1.97,z),(4.47,1.8,z),(4.57,1.42,z+.1)],.012,amber)
o=box('Bent hatch',(4.28,1.35,.48),(.05,.7,1.1),blue); o.rotation_euler.y=.55
for i in range(9):
    x=3.15+random.random()*1.35; z=-.7+random.random()*2.5
    o=box('Broken panel shard',(x,.018,z),(.04+random.random()*.14,.012,.06+random.random()*.19),steel,.001)
    o.rotation_euler.z=random.random()*math.tau
# Drain channels are recessed dark beds with thin metal cross bars, not giant repeated floor tiles.
for x in [-2.65,2.65]:
    box('Drain bed',(x,.002,0),(.16,.006,10.8),rubber,.001)
    for z in [i*.18-5.3 for i in range(60)]: box('Drain grate',(x,.008,z),(.17,.012,.026),steel,.001)
# Room markings mounted on actual surfaces, understated and at human scale.
label('RECOVERY  /  02',(-2.7,2.93,2.85),.10,ink)
box('Emergency bulkhead lamp',(3.7,2.53,5.78),(.32,.14,.1),dark)
box('Amber lens',(3.7,2.53,5.71),(.25,.085,.055),warm)

# Preserve curved surfaces, consolidate static meshes into a small number of material batches.
static=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.get('mechanism')]
by_material={}
for o in static:
    key=o.data.materials[0].name
    by_material.setdefault(key,[]).append(o)
for name,objects in by_material.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); bpy.context.object.name=name+'_Geometry'
os.makedirs(OUT,exist_ok=True)
os.makedirs(os.path.join(ROOT,'assets','containment'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','containment','containment.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'containment.glb'),export_format='GLB',export_apply=True,export_yup=True)
print('CONTAINMENT_EXPORT_COMPLETE',sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'))
