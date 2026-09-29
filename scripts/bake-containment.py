"""Bake room-scale contact occlusion into UV1, retaining metric PBR UV0."""
import bpy, os, math
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets','containment','containment.blend'))
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=16
scene.render.threads_mode='FIXED'; scene.render.threads=6
objects=[o for o in scene.objects if o.type=='MESH' and not o.get('mechanism') and 'Glass' not in o.name]
image=bpy.data.images.new('Containment contact occlusion',width=2048,height=2048,alpha=False)
image.colorspace_settings.name='Non-Color'
for o in objects:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    if not o.data.uv_layers: o.data.uv_layers.new(name='UVMap')
    if 'ContactUV' not in o.data.uv_layers: o.data.uv_layers.new(name='ContactUV')
    o.data.uv_layers.active_index=1
    # Bind original material textures explicitly to UV0 before selecting the bake UV.
    for m in o.data.materials:
        tree=m.node_tree
        for node in list(tree.nodes):
            if node.type=='TEX_IMAGE' and not node.inputs['Vector'].is_linked:
                uv=tree.nodes.new('ShaderNodeUVMap'); uv.uv_map=o.data.uv_layers[0].name
                tree.links.new(uv.outputs['UV'],node.inputs['Vector'])
        target=tree.nodes.new('ShaderNodeTexImage'); target.image=image
        tree.nodes.active=target; target.select=True
bpy.ops.object.select_all(action='DESELECT')
for o in objects: o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.003)
bpy.ops.object.mode_set(mode='OBJECT')
scene.render.bake.margin=8
# Unbounded AO is black inside a closed room. Bake a finite 45 cm contact radius through emission.
restore=[]
for o in objects:
    for m in o.data.materials:
        tree=m.node_tree
        output=next(n for n in tree.nodes if n.type=='OUTPUT_MATERIAL')
        previous=output.inputs['Surface'].links[0].from_socket
        ao=tree.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value=.45
        emit=tree.nodes.new('ShaderNodeEmission')
        tree.links.new(ao.outputs['AO'],emit.inputs['Color'])
        tree.links.new(emit.outputs[0],output.inputs['Surface'])
        restore.append((tree,output,previous,ao,emit))
print('BAKING_CONTACT_AO',len(objects),flush=True)
bpy.ops.object.bake(type='EMIT')
for tree,output,previous,ao,emit in restore:
    tree.links.new(previous,output.inputs['Surface']); tree.nodes.remove(ao); tree.nodes.remove(emit)
image.filepath_raw=os.path.join(ROOT,'public','textures','containment','contact-ao.png'); image.file_format='PNG'; image.save()
group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
group.interface.new_socket('Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
for o in objects:
    o.data.uv_layers.active_index=0
    for m in o.data.materials:
        tree=m.node_tree
        tex=next(n for n in tree.nodes if n.type=='TEX_IMAGE' and n.image==image)
        for old in list(tree.nodes):
            if old.type=='GROUP' and old.node_tree.name.startswith('glTF Material Output'): tree.nodes.remove(old)
        uv=tree.nodes.new('ShaderNodeUVMap'); uv.uv_map='ContactUV'; tree.links.new(uv.outputs['UV'],tex.inputs['Vector'])
        node=tree.nodes.new('ShaderNodeGroup'); node.node_tree=group
        tree.links.new(tex.outputs['Color'],node.inputs['Occlusion'])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','containment','containment.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','containment.glb'),export_format='GLB',export_apply=True,export_yup=True)
print('CONTACT_BAKE_COMPLETE',flush=True)
