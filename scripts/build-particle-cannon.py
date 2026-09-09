"""Canonical deterministic cannon mesh. Blender 4.1 --background --python this-file.

Authoring uses X forward, Z up; glTF export converts this to X forward, Y up.
The origin is the existing robot elbow centre. No replacement ball is generated.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/models/particle-cannon.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, metallic=0, rough=.3, emission=0, alpha=1):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,alpha)
    p.inputs['Metallic'].default_value=metallic
    p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    if alpha<1:
        p.inputs['Alpha'].default_value=alpha
        m.blend_method='BLEND'; m.use_screen_refraction=True
        m.use_backface_culling=True
    return m

white=material('Cannon • warm white polymer',(.88,.91,.93),rough=.27)
dark=material('Cannon • graphite mechanics',(.026,.033,.042),metallic=.25,rough=.29)
orange=material('Cannon • orange muzzle', (1,.20,.015),rough=.25)
glass=material('Cannon • transparent chamber',(.99,.995,1),rough=.025)
glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value=1
glass.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value=1.42
glass.use_screen_refraction=True
rim=material('Cannon • chamber rim',(.30,.39,.44),metallic=.7,rough=.22)
cyan=material('Cannon • cyan barrel light',(.005,.42,.80),rough=.2,emission=.9)
core=material('Cannon • emitter core',(.62,.96,1),rough=.15,emission=5)
particle_mats=[material('Particle • '+n,c,rough=.24) for n,c in [
    ('blue',(.065,.40,.93)),('pink',(.89,.16,.60)),('yellow',(1,.64,.075)),
    ('mint',(.16,.69,.42)),('lavender',(.53,.28,.84)),('tangerine',(1,.31,.075))]]

root=bpy.data.objects.new('ParticleCannon',None); bpy.context.collection.objects.link(root)
root['attachment']='Existing elbow pivot; replaces forearm and hand only'
root['forwardAxis']='+X'; root['upAxis']='+Y'; root['units']='canonical Gizmobot mesh units'

def mesh(name,verts,faces,mat):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob)
    ob.parent=root; me.materials.append(mat)
    for p in me.polygons:p.use_smooth=True
    return ob

def lathe(name,profile,mat,segments=48):
    # A closed profile creates a proper annulus with bore and wall thickness.
    v=[(x,r*math.sin(2*math.pi*j/segments),r*math.cos(2*math.pi*j/segments)) for x,r in profile for j in range(segments)]
    f=[]
    for i in range(len(profile)):
        for j in range(segments):
            a=i*segments+j;b=i*segments+(j+1)%segments
            c=((i+1)%len(profile))*segments+(j+1)%segments;d=((i+1)%len(profile))*segments+j
            f.append((a,b,c,d))
    return mesh(name,v,f,mat)

def bevel_box(name,loc,scale,mat,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    ob=bpy.context.object;ob.name=name;ob.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(mat);ob.parent=root
    mod=ob.modifiers.new('Moulded rounded edges','BEVEL');mod.width=bevel;mod.segments=4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in ob.data.polygons:p.use_smooth=True
    mod=ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

# Socket clears the measured original elbow ball and leaves its rear hemisphere exposed.
lathe('Connector_socket_graphite',[(.04,.100),(.046,.112),(.085,.126),(.134,.142),(.166,.143),(.176,.13),(.176,.095),(.052,.095)],dark)
lathe('Connector_white_collar',[(.082,.127),(.088,.142),(.105,.150),(.149,.157),(.170,.15),(.174,.139),(.146,.140),(.100,.130)],white)

# One continuous thick moulding: rounded closed rear shoulder and an organic top window.
# Window edge sweeps forwards toward the underside instead of cutting a rectangular box.
N=64; rows=18; v=[]; f=[]
for i in range(rows):
    t=i/(rows-1)
    for j in range(N):
        a=2*math.pi*j/N
        angle=abs(math.atan2(math.sin(a),math.cos(a)))
        u=min(1,angle/(math.pi*.78))
        end=.315+.357*u*u*(3-2*u)
        x=.153+(end-.153)*t
        r=.154+.073*math.sin(min(1,(x-.153)/.125)*math.pi/2)
        r-=.012*max(0,(x-.40)/.272)
        v.append((x,r*math.sin(a),r*math.cos(a)))
for i in range(rows-1):
    for j in range(N):
        # Outward winding makes the solidify wall grow INTO the shell.
        a=i*N+j;b=i*N+(j+1)%N;f.append((a,a+N,b+N,b))
body=mesh('Body_continuous_window_shell',v,f,white)
bpy.context.view_layer.objects.active=body;body.select_set(True)
mod=body.modifiers.new('Polymer wall 8mm','SOLIDIFY');mod.thickness=.008;mod.offset=-1
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=body.modifiers.new('Soft window lip','BEVEL');mod.width=.003;mod.segments=2
bpy.ops.object.modifier_apply(modifier=mod.name)
body.select_set(False)

# Clear tube is a real continuous thin wall, not a flat pane. Rear is housed in body.
# Support loops isolate the long cylinder normals from the end caps. Without
# them, smoothed cap normals turn the entire chamber into a distorting lens.
lathe('Chamber_clear_tube',[
    (.285,.205),(.287,.207),(.296,.207),(.638,.207),(.648,.207),
    (.650,.205),(.650,.204),(.648,.203),(.638,.203),(.296,.203),
    (.287,.203),(.285,.204)],glass,64)
lathe('Chamber_front_seal',[(.642,.208),(.646,.212),(.658,.212),(.662,.208),(.662,.199),(.642,.199)],rim)

# Solid rounded rings have continuous front, back, outer and inner surfaces.
lathe('Barrel_graphite_shroud',[(.654,.195),(.661,.211),(.690,.216),(.715,.211),(.744,.198),(.753,.186),(.753,.140),(.713,.132),(.661,.132),(.654,.143)],dark)
lathe('Muzzle_white_seat',[(.694,.207),(.704,.217),(.723,.219),(.731,.211),(.731,.182),(.705,.182)],white)
lathe('Muzzle_orange_rounded_ring',[(.720,.204),(.725,.217),(.735,.225),(.780,.225),(.797,.218),(.805,.204),(.805,.176),(.797,.168),(.783,.166),(.739,.169),(.722,.180)],orange)
lathe('Barrel_recessed_bore',[(.795,.165),(.779,.169),(.726,.149),(.687,.116),(.686,.075),(.698,.063),(.713,.074),(.744,.120),(.793,.151)],dark)
lathe('Barrel_cyan_inner_halo',[(.709,.086),(.713,.090),(.721,.090),(.726,.084),(.726,.074),(.720,.071),(.711,.075)],cyan)
lathe('Barrel_emitter_lens',[(.702,.061),(.709,.062),(.717,.055),(.721,.035),(.722,0),(.702,0)],core,48)
# Keep the light recessed, but visible through the bore at three-quarter
# viewing angles. The original depth hid it completely behind the bore wall.
for name in ('Barrel_cyan_inner_halo','Barrel_emitter_lens'):
    for vertex in bpy.data.objects[name].data.vertices:vertex.co.x+=.037

# Packed independent particles sit inside the continuous transparent chamber.
particles=[(.365,-.064,.094,.042,3),(.389,.027,.124,.044,0),(.413,.091,.061,.045,1),
(.462,-.093,.080,.045,2),(.480,-.010,.124,.046,1),(.511,.077,.102,.042,0),
(.559,-.065,.104,.044,0),(.582,.023,.106,.044,2),(.602,.080,.051,.040,3),
(.425,-.042,.018,.043,4),(.505,.008,.029,.045,2),(.558,-.091,.007,.042,3),
(.580,.007,.010,.044,5),(.360,.028,.032,.042,5)]
for i,(x,y,z,r,m) in enumerate(particles):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=r,location=(x,y,z))
    ob=bpy.context.object;ob.name=f'Particle_{i+1:02d}';ob.parent=root;ob.data.materials.append(particle_mats[m])
    for p in ob.data.polygons:p.use_smooth=True

def fitted_switch(name,half_length,half_angle,profiles,mat):
    # Follow the actual rear shoulder in both axes. A horizontal box floats
    # above this rising surface; this control has a buried skirt and low lip.
    segments=24;verts=[];faces=[]
    def surface(x,angle,height):
        r=.154+.073*math.sin(min(1,(x-.153)/.125)*math.pi/2)
        return (x,(r+height)*math.sin(angle),(r+height)*math.cos(angle))
    for size,height in profiles:
        for j in range(segments):
            a=2*math.pi*j/segments;c,s=math.cos(a),math.sin(a)
            x=.252+half_length*size*math.copysign(abs(c)**(2/3),c)
            angle=half_angle*size*math.copysign(abs(s)**(2/3),s)
            verts.append(surface(x,angle,height))
    for row in range(len(profiles)-1):
        for j in range(segments):
            a=row*segments+j;b=row*segments+(j+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(reversed(range(segments))))
    center=len(verts);verts.append(surface(.252,0,profiles[-1][1]))
    last=(len(profiles)-1)*segments
    for j in range(segments):faces.append((last+j,last+(j+1)%segments,center))
    return mesh(name,verts,faces,mat)
fitted_switch('Body_top_switch_base',.049,.156,[(1,-.004),(1,.001),(.91,.003)],dark)
fitted_switch('Body_top_orange_switch',.038,.105,[(1,.0005),(1,.003),(.92,.006),(.72,.0065)],orange)
def curved_grip(side):
    # Rounded inset follows the shell's curvature instead of intersecting it
    # as a flat cuboid. The hidden skirt seats the pad in the white moulding.
    segments=40
    profiles=[(1,-.009),(1,.002),(.97,.010),(.86,.017),(.30,.018)]
    verts=[]; faces=[]
    for size,height in profiles:
        for j in range(segments):
            a=2*math.pi*j/segments
            c,s=math.cos(a),math.sin(a)
            x=.440+.078*size*math.copysign(abs(c)**(2/3),c)
            angle=side*2.122+.23*size*math.copysign(abs(s)**(2/3),s)
            r=.227-.012*max(0,(x-.40)/.272)+height
            verts.append((x,r*math.sin(angle),r*math.cos(angle)))
    for row in range(len(profiles)-1):
        for j in range(segments):
            a=row*segments+j;b=row*segments+(j+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((len(profiles)-1)*segments+j for j in range(segments)))
    return mesh('Body_side_grip_'+str(side),verts,faces,dark)
for side in [-1,1]:curved_grip(side)
bevel_box('Body_underside_service_cover',(.421,0,-.217),(.191,.09,.018),dark,.008)

emitter=bpy.data.objects.new('MuzzleEmission',None);bpy.context.collection.objects.link(emitter)
emitter.parent=root;emitter.location=(.816,0,0)
emitter['direction']=[1.0,0.0,0.0];emitter['purpose']='Particle spawn point just beyond muzzle; transform local +X to world direction'

# Recalculate oriented surface normals, bake modifiers, and export selected model only.
bpy.ops.object.select_all(action='DESELECT')
for ob in list(root.children):
    if ob.type=='MESH':
        bpy.context.view_layer.objects.active=ob;ob.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=0.0000001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
        ob.select_set(False)
root.select_set(True)
for ob in root.children:ob.select_set(True)
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
triangles=sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in root.children if ob.type=='MESH')
metadata={'source':'scripts/build-particle-cannon.py','asset':'assets/models/particle-cannon.glb','root':'ParticleCannon','pivot':[0,0,0],'forward':[1,0,0],'up':[0,1,0],'muzzleEmission':[.816,0,0],'bodyDiameter':.454,'muzzleDiameter':.450,'tipFromPivot':.805,'triangles':triangles,'connector':{'rearX':.04,'boreRadius':.095,'ballProvidedBy':'existing Gizmobot elbow','measuredBallRadii':[.102873,.078628,.085106]},'materials':len({m for ob in root.children if ob.type=='MESH' for m in ob.data.materials}),'notes':'Canonical geometry coordinates; inherit original robot root scale. Thin chamber with supported cylinder normals, transmission 1, IOR 1.42, roughness .025. Curved seated side pads and smooth window sweep.'}
(OUT.with_suffix('.model.json')).write_text(json.dumps(metadata,indent=2)+'\n')
print('CANNON_BUILD',json.dumps(metadata))
