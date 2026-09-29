"""Final surface response pass, preserving the baked contact UV atlas."""
import bpy, os, numpy as np
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX=os.path.join(ROOT,'public','textures','containment')
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets','containment','containment.blend'))
# Derive restrained enamel variation from a real scanned surface, retaining its non-repeating microdetail.
source=bpy.data.images.load(os.path.join(TEX,'concrete_floor_worn_001_Diffuse.jpg'),check_existing=True)
w,h=source.size; data=np.empty(w*h*4,dtype=np.float32); source.pixels.foreach_get(data)
p=data.reshape(h,w,4); lum=p[:,:,:3].mean(axis=2)
variation=np.clip(.82+lum*.32,.78,1.0)
base=np.array([.56,.59,.55])
p[:,:,:3]=variation[:,:,None]*base; p[:,:,3]=1
image=bpy.data.images.new('Scanned enamel wear',width=w,height=h,alpha=False)
image.pixels.foreach_set(p.ravel()); image.filepath_raw=os.path.join(TEX,'enamel-wear.png'); image.file_format='PNG'; image.save()
for name in ['CH_Ivory_Enamel','CH_Anthracite_Powdercoat','CH_Brushed_Stainless','CH_Mattress']:
    m=bpy.data.materials.get(name); tree=m.node_tree
    bs=next(n for n in tree.nodes if n.type=='BSDF_PRINCIPLED')
    uv=tree.nodes.new('ShaderNodeUVMap'); uv.uv_map='UVMap'
    tex=tree.nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(os.path.join(TEX,'concrete_floor_worn_001_rough.jpg'),check_existing=True)
    tex.image.colorspace_settings.name='Non-Color'; tree.links.new(uv.outputs['UV'],tex.inputs['Vector'])
    tree.links.new(tex.outputs['Color'],bs.inputs['Roughness'])
    if name=='CH_Ivory_Enamel':
        color=tree.nodes.new('ShaderNodeTexImage'); color.image=image
        tree.links.new(uv.outputs['UV'],color.inputs['Vector']); tree.links.new(color.outputs['Color'],bs.inputs['Base Color'])
    normal=tree.nodes.new('ShaderNodeTexImage'); normal.image=bpy.data.images.load(os.path.join(TEX,'concrete_floor_worn_001_nor_gl.jpg'),check_existing=True)
    normal.image.colorspace_settings.name='Non-Color'; tree.links.new(uv.outputs['UV'],normal.inputs['Vector'])
    bump=tree.nodes.new('ShaderNodeNormalMap'); bump.inputs['Strength'].default_value=.055 if name!='CH_Mattress' else .23
    tree.links.new(normal.outputs['Color'],bump.inputs['Color']); tree.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    # Project UV0 in metres after joining, with separate axes per face. UV1 remains untouched.
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.get('mechanism') or m not in list(o.data.materials): continue
        uv0=o.data.uv_layers[0]
        for poly in o.data.polygons:
            n=o.matrix_world.to_3x3() @ poly.normal
            axis=max(range(3),key=lambda a:abs(n[a]))
            axes=[a for a in range(3) if a!=axis]
            for li in poly.loop_indices:
                v=o.matrix_world @ o.data.vertices[o.data.loops[li].vertex_index].co
                uv0.data[li].uv=(v[axes[0]]/1.2,v[axes[1]]/1.2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','containment','containment.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','containment.glb'),export_format='GLB',export_apply=True,export_yup=True)
print('SURFACE_FINISH_COMPLETE',flush=True)
