"""Procedurally builds the Vision Quest city-maze and exports:
  - contrib/vision_quest_vr/environment/city.glb        (the geometry)
  - contrib/vision_quest_vr/environment/city_maze.json  (the maze graph, for gameplay logic)

Run headless, no Blender GUI needed:
    blender --background --python contrib/vision_quest_vr/tools/generate_city.py

Regenerate any time by re-running -- it clears the scene first. Tweak
GRID_SIZE / BLOCK_SIZE / colors / density below and re-run to change the
city; MAZE_SEED controls the maze layout specifically.

Style: a European canal-town look (steep gabled roofs, warm stucco walls,
cobblestone streets, a canal along the south edge) rather than a generic
grid -- see contrib/vision_quest_vr/README.md for why (a request for Marble/Gaussian-splat
level photorealism was scoped down to this: mesh-based, so it still works
as a real, collidable maze).

Maze structure: cells = city blocks on a grid. A recursive-backtracker
carves a perfect maze (single unique path between any two cells) over the
grid graph. Where an edge between two adjacent cells is "closed", a solid
infill building spans that entire street gap, physically blocking it --
where "open", the street stays clear. This is exported alongside the
geometry as city_maze.json so vision_quest_game.gd can pick genuinely hard
(graph-distant) spawn/target pairs instead of arbitrary random points.
"""

import json
import math
import os
import random

import bmesh
import bpy

MAZE_SEED = 42
random.seed(MAZE_SEED)

# ---------------------------------------------------------------------------
# Layout constants (meters, matching Godot's 1 unit = 1 meter)
# ---------------------------------------------------------------------------
GRID_SIZE = 5           # 5x5 maze cells (city blocks) -- bump for a bigger/harder maze
BLOCK_SIZE = 20.0
STREET_WIDTH = 8.0
STEP = BLOCK_SIZE + STREET_WIDTH
GRID_SPAN = GRID_SIZE * STEP - STREET_WIDTH  # outer edge to outer edge

WALL_HEIGHT = 11.0       # infill buildings that block closed maze edges
CANAL_WIDTH = 9.0
CANAL_GAP = 6.0          # clearance between the grid's south edge and the canal
ROOF_OVERHANG = 1.18     # roofs extend this far past their building's footprint (eaves)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "environment"))
GLB_PATH = os.path.join(ENV_DIR, "city.glb")
MAZE_JSON_PATH = os.path.join(ENV_DIR, "city_maze.json")
TEXTURES_DIR = os.path.join(ENV_DIR, "textures")
TEXEL_SIZE = 2.0  # meters per texture tile; see generate_textures.py for the source images


# ---------------------------------------------------------------------------
# Scene setup
# ---------------------------------------------------------------------------
def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    # Only purge orphaned meshes/objects here -- materials are created fresh
    # by this script right after this call and have 0 users at that point,
    # so purging them too would delete them before they're ever assigned.
    for block in (bpy.data.meshes, bpy.data.objects):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def _load_texture(path, colorspace):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def make_material(name, color, roughness=0.8, metallic=0.0, emission=None, emission_strength=2.0, texture_set=None):
    """texture_set, if given (e.g. "stucco"), wires up real baked image
    textures from generate_textures.py: TEXTURE_albedo/roughness/normal.png
    -> Base Color / Roughness / Normal Map, exactly the fixed PBR channels
    glTF actually supports (unlike Blender's own procedural shader nodes,
    which the exporter can't serialize). `color` still applies as a tint
    multiplied over the albedo texture via ShaderNodeVectorMath (chosen
    over the Mix/MixRGB node specifically because its Vector-Vector-Vector
    socket layout is stable across Blender versions, unlike Mix's
    data-type-dependent socket indices, which I can't verify without
    rendering).
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if texture_set:
        albedo_img = _load_texture(os.path.join(TEXTURES_DIR, f"{texture_set}_albedo.png"), "sRGB")
        rough_img = _load_texture(os.path.join(TEXTURES_DIR, f"{texture_set}_roughness.png"), "Non-Color")
        normal_img = _load_texture(os.path.join(TEXTURES_DIR, f"{texture_set}_normal.png"), "Non-Color")

        albedo_node = nodes.new("ShaderNodeTexImage")
        albedo_node.image = albedo_img
        tint_node = nodes.new("ShaderNodeVectorMath")
        tint_node.operation = "MULTIPLY"
        tint_node.inputs[1].default_value = (*color, )
        links.new(albedo_node.outputs["Color"], tint_node.inputs[0])
        links.new(tint_node.outputs["Vector"], bsdf.inputs["Base Color"])

        rough_node = nodes.new("ShaderNodeTexImage")
        rough_node.image = rough_img
        links.new(rough_node.outputs["Color"], bsdf.inputs["Roughness"])

        normal_tex_node = nodes.new("ShaderNodeTexImage")
        normal_tex_node.image = normal_img
        normal_map_node = nodes.new("ShaderNodeNormalMap")
        links.new(normal_tex_node.outputs["Color"], normal_map_node.inputs["Color"])
        links.new(normal_map_node.outputs["Normal"], bsdf.inputs["Normal"])
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)

    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def apply_box_projection_uv(bm, texel_size=TEXEL_SIZE):
    """Box/cube-projection UVs computed directly via bmesh's UV layer API
    (no bpy.ops.uv.cube_project -- that's an operator call, and calling
    bpy.ops per-object in a loop of hundreds/thousands of objects is
    exactly what made this script hang for minutes earlier; see add_box
    etc. below). For each face, project onto the two axes perpendicular to
    its dominant normal axis, scaled so `texel_size` meters = 1 UV tile.
    A standard cheap approximation for game assets -- distorts on curved
    surfaces at grazing angles (cylinder sides), which is an accepted
    tradeoff of box mapping, not a bug.
    """
    bm.normal_update()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        n = face.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in face.loops:
            co = loop.vert.co
            if az >= ax and az >= ay:
                u, v = co.x, co.y
            elif ay >= ax and ay >= az:
                u, v = co.x, co.z
            else:
                u, v = co.y, co.z
            loop[uv_layer].uv = (u / texel_size, v / texel_size)


# Warm European canal-town palette, now backed by real baked PBR image
# textures (generate_textures.py) rather than flat colors -- glTF materials
# only support fixed PBR channels backed by image textures, not live
# procedural shader node graphs, so this is the actual "real texture" path;
# see README for why baking rather than fetching from a texture site.
# (color, texture_set) pairs -- texture_set names must match the *_albedo/
# _roughness/_normal.png files generate_textures.py writes.
WALL_VARIANTS = [
    ((0.95, 0.92, 0.85), "stucco"),          # cream/yellow stucco
    ((1.0, 0.98, 0.95), "stucco"),           # off-white stucco
    ((0.85, 0.78, 0.65), "stucco"),          # ochre-tinted stucco
    ((1.0, 0.85, 0.75), "brick_terracotta"),  # warm brick
    ((0.85, 0.75, 0.7), "brick_terracotta"),  # muted brick
]
ROOF_VARIANTS = [
    ((1.0, 0.85, 0.7), "roof_tile"),
    ((0.85, 0.7, 0.6), "roof_tile"),
]
MAT_WALLS = [make_material(f"Wall_{i}", c, roughness=0.85, texture_set=t) for i, (c, t) in enumerate(WALL_VARIANTS)]
MAT_ROOFS = [make_material(f"Roof_{i}", c, roughness=0.7, texture_set=t) for i, (c, t) in enumerate(ROOF_VARIANTS)]
MAT_WINDOW = make_material("Window", (0.65, 0.78, 0.85), roughness=0.15, emission=(0.5, 0.65, 0.75), emission_strength=0.4)
MAT_SHUTTER = make_material("Shutter", (0.15, 0.35, 0.25), roughness=0.7)
MAT_DOOR = make_material("Door", (0.35, 0.20, 0.10), roughness=0.6)
MAT_STONE = make_material("Stone", (1.0, 1.0, 1.0), roughness=0.6, texture_set="canal_stone")
MAT_COBBLE = make_material("Cobblestone", (1.0, 1.0, 1.0), roughness=0.9, texture_set="cobblestone")
MAT_SIDEWALK = make_material("Sidewalk", (0.72, 0.68, 0.6), roughness=0.8)
MAT_WATER = make_material("Water", (0.15, 0.45, 0.5), roughness=0.1, metallic=0.2)
MAT_LAMP_POLE = make_material("LampPole", (0.05, 0.05, 0.05), roughness=0.4, metallic=0.6)
MAT_LAMP_HEAD = make_material("LampHead", (1.0, 0.9, 0.6), roughness=0.3, emission=(1.0, 0.85, 0.5), emission_strength=3.0)
MAT_TRUNK = make_material("Trunk", (0.25, 0.15, 0.08), roughness=0.9)
MAT_FOLIAGE = make_material("Foliage", (0.18, 0.42, 0.15), roughness=0.85)
MAT_LANDMARK_LIGHT = make_material("LandmarkLight", (1.0, 0.7, 0.3), roughness=0.3, emission=(1.0, 0.6, 0.2), emission_strength=4.0)
MAT_BENCH = make_material("Bench", (0.3, 0.2, 0.12), roughness=0.8)
MAT_INTERIOR_GLOW = make_material("InteriorGlow", (1.0, 0.75, 0.4), roughness=0.5, emission=(1.0, 0.7, 0.3), emission_strength=1.5)
MAT_CLOCK_FACE = make_material("ClockFace", (0.95, 0.92, 0.85), roughness=0.4)
MAT_CLOCK_HAND = make_material("ClockHand", (0.05, 0.05, 0.05), roughness=0.5)
SIGN_COLORS = [
    (0.6, 0.1, 0.1), (0.1, 0.35, 0.2), (0.15, 0.2, 0.5), (0.55, 0.4, 0.05),
]
MAT_SIGNS = [make_material(f"Sign_{i}", c, roughness=0.6) for i, c in enumerate(SIGN_COLORS)]
PET_COLORS = [(0.35, 0.22, 0.1), (0.85, 0.85, 0.82)]  # dog (brown), cat (cream) -- kept to 2, not 3, to save a draw call
MAT_PETS = [make_material(f"Pet_{i}", c, roughness=0.8) for i, c in enumerate(PET_COLORS)]
MAT_BLOOM = make_material("Bloom", (0.85, 0.22, 0.32), roughness=0.55)  # flower-box blooms


def _link_object(name, mesh, location, material, parent=None):
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    mesh.materials.append(material)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


# NOTE: these build geometry directly via bmesh instead of bpy.ops.mesh.*_add,
# which goes through Blender's operator/context system -- fine for a handful
# of calls, but with thousands of objects (this script's whole point) that
# path is dramatically slower and gets slower still as the scene grows.
# Direct bmesh construction sidesteps that entirely.
def add_box(name, size, location, material, parent=None):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=bm.verts, vec=size)
    apply_box_projection_uv(bm)
    bm.to_mesh(mesh)
    bm.free()
    return _link_object(name, mesh, location, material, parent)


def add_cylinder(name, radius, depth, location, material, parent=None, vertices=12):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=vertices,
                           radius1=radius, radius2=radius, depth=depth)
    apply_box_projection_uv(bm)
    bm.to_mesh(mesh)
    bm.free()
    return _link_object(name, mesh, location, material, parent)


def add_sphere(name, radius, location, material, z_scale=1.0, parent=None):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=radius)
    apply_box_projection_uv(bm)
    bm.to_mesh(mesh)
    bm.free()
    obj = _link_object(name, mesh, location, material, parent)
    obj.scale.z = z_scale
    return obj


def add_cone(name, radius, depth, location, material, parent=None, vertices=10):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=vertices,
                           radius1=radius, radius2=0.0, depth=depth)
    apply_box_projection_uv(bm)
    bm.to_mesh(mesh)
    bm.free()
    return _link_object(name, mesh, location, material, parent)


def add_gable_roof(name, width, depth, ridge_height, location, material, rotation_z=0.0, parent=None):
    """Triangular-prism gable roof: a ridge line along Y, sloped to X edges."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    hw, hd = width / 2.0, depth / 2.0
    v0 = bm.verts.new((-hw, -hd, 0.0))
    v1 = bm.verts.new((hw, -hd, 0.0))
    v2 = bm.verts.new((hw, hd, 0.0))
    v3 = bm.verts.new((-hw, hd, 0.0))
    r0 = bm.verts.new((0.0, -hd, ridge_height))
    r1 = bm.verts.new((0.0, hd, ridge_height))
    bm.verts.ensure_lookup_table()
    bm.faces.new((v0, v1, r0))          # south gable triangle
    bm.faces.new((v2, v3, r1))          # north gable triangle
    bm.faces.new((v1, v2, r1, r0))      # east slope
    bm.faces.new((v3, v0, r0, r1))      # west slope
    bm.faces.new((v0, v3, v2, v1))      # bottom cap (cheap, avoids seeing through from below)
    apply_box_projection_uv(bm)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler.z = rotation_z
    obj.data.materials.append(material)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def add_empty(name, location):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_size = 0.5
    empty.location = location
    bpy.context.collection.objects.link(empty)
    return empty


_uid = [0]


def _next_id():
    _uid[0] += 1
    return _uid[0]


# ---------------------------------------------------------------------------
# Kit pieces
# ---------------------------------------------------------------------------
def make_rowhouse(location, rotation_z=0.0, height=None, width=6.0, depth=6.0, sign=False, interior_glow=False,
                   storefront=False, flower_box=False, vines=False, chimney=False, lantern=False):
    uid = _next_id()
    height = height or random.uniform(9.0, 15.0)
    wall_mat = random.choice(MAT_WALLS)
    roof_mat = random.choice(MAT_ROOFS)

    body = add_box(f"House_{uid}", (width, depth, height), (location[0], location[1], height / 2.0), wall_mat)
    body.rotation_euler.z = rotation_z

    ridge_h = height * random.uniform(0.35, 0.55)
    add_gable_roof(f"House_{uid}_roof", width * ROOF_OVERHANG, depth * ROOF_OVERHANG, ridge_h, (0, 0, height / 2.0), roof_mat, parent=body)

    if chimney:
        chim_x = width * 0.3
        chim_top = height / 2.0 + ridge_h * 0.6
        add_box(f"House_{uid}_chimney", (0.8, 0.8, 1.5), (chim_x, 0, chim_top), MAT_STONE, parent=body)
        add_cylinder(f"House_{uid}_flue", 0.15, 0.3, (chim_x, 0, chim_top + 0.9), random.choice(MAT_ROOFS), parent=body)

    if lantern:
        lz = -height / 2.0 + height * 0.35
        bracket = add_box(f"House_{uid}_lantern_bracket", (0.05, 0.3, 0.05), (width * 0.38, depth / 2.0 + 0.15, lz), MAT_LAMP_POLE, parent=body)
        add_sphere(f"House_{uid}_lantern_head", 0.16, (0, 0.22, -0.05), MAT_LAMP_HEAD, parent=bracket)

    # one row of windows on the front (+Y) face, plus a door -- kept minimal
    # since this repeats across ~190 buildings; detail here is a real cost
    # to draw-call count on Quest. interior_glow/sign/storefront/flower_box/
    # vines are opt-in per call, used only for a curated subset of
    # "points of interest" buildings -- everything still funnels through
    # add_box/add_cylinder/add_sphere, so it's swept into merge_by_material()
    # automatically with no special-casing needed there.
    wz = -height / 2.0 + height * 0.62
    win_mat = MAT_INTERIOR_GLOW if interior_glow else MAT_WINDOW
    for col in range(2):
        wx = (col - 0.5) * (width * 0.42)
        add_box(f"House_{uid}_win_{col}", (width * 0.2, 0.08, height * 0.16),
                (wx, depth / 2.0 + 0.04, wz), win_mat, parent=body)
        if flower_box:
            # small planter beneath the window with a couple of bloom accents
            add_box(f"House_{uid}_flowerbox_{col}", (width * 0.22, 0.16, 0.1),
                    (wx, depth / 2.0 + 0.12, wz - height * 0.1), MAT_STONE, parent=body)
            for b in range(3):
                bx = wx + (b - 1) * width * 0.06
                add_sphere(f"House_{uid}_bloom_{col}_{b}", 0.06,
                           (bx, depth / 2.0 + 0.18, wz - height * 0.06), MAT_BLOOM, parent=body)
        else:
            # projecting stone sill -- windows shouldn't sit perfectly flush
            # with the wall.
            add_box(f"House_{uid}_sill_{col}", (width * 0.24, 0.14, 0.06),
                    (wx, depth / 2.0 + 0.09, wz - height * 0.09), MAT_STONE, parent=body)

    if storefront:
        # ground-floor commercial front: recessed display glass with a warm
        # interior backdrop (illusion of depth/an illuminated shop, not an
        # actual explorable interior -- see README on why full interiors
        # were scoped out), a fabric awning, and a door with a glass pane.
        door_z = -height / 2.0 + height * 0.13
        disp_w = width * 0.32
        disp_z = -height / 2.0 + height * 0.16
        disp_x = width * 0.28
        # recessed frame at the wall surface, glazing set back 0.15m, and a
        # warm backdrop plane further back still for the "lit interior" look
        add_box(f"House_{uid}_storewin_frame", (disp_w * 1.1, 0.06, height * 0.26),
                (disp_x, depth / 2.0 + 0.03, disp_z), MAT_DOOR, parent=body)
        add_box(f"House_{uid}_storewin_glass", (disp_w, 0.05, height * 0.22),
                (disp_x, depth / 2.0 - 0.06, disp_z), MAT_WINDOW, parent=body)
        add_box(f"House_{uid}_storewin_interior", (disp_w * 0.9, 0.04, height * 0.18),
                (disp_x, depth / 2.0 - 0.16, disp_z), MAT_INTERIOR_GLOW, parent=body)

        awning_mat = random.choice(MAT_SIGNS)
        awning = add_box(f"House_{uid}_awning", (width * 0.85, 0.9, 0.06),
                          (0, depth / 2.0 + 0.45, door_z + height * 0.14), awning_mat, parent=body)
        awning.rotation_euler.x = math.radians(-18.0)  # angled outward over the sidewalk
        for s in range(3):
            sx = -width * 0.3 + s * width * 0.3
            add_box(f"House_{uid}_awning_stripe_{s}", (width * 0.12, 0.92, 0.07),
                    (sx, depth / 2.0 + 0.45, door_z + height * 0.14), MAT_DOOR, parent=awning)

        add_box(f"House_{uid}_storedoor", (width * 0.2, 0.1, height * 0.24),
                (-width * 0.22, depth / 2.0 + 0.05, door_z), MAT_DOOR, parent=body)
        add_box(f"House_{uid}_storedoor_glass", (width * 0.13, 0.1, height * 0.15),
                (-width * 0.22, depth / 2.0 + 0.09, door_z + height * 0.02), MAT_WINDOW, parent=body)
    else:
        add_box(f"House_{uid}_door", (width * 0.22, 0.1, height * 0.22),
                (0, depth / 2.0 + 0.05, -height / 2.0 + height * 0.11), MAT_DOOR, parent=body)

    if vines:
        # a couple of flat foliage patches climbing the lower wall, offset
        # outward slightly to avoid z-fighting with the wall face
        for v in range(2):
            vx = (v - 0.5) * width * 0.55
            vh = random.uniform(2.0, 4.0)
            add_box(f"House_{uid}_vine_{v}", (width * 0.16, 0.03, vh),
                    (vx, depth / 2.0 + 0.02, -height / 2.0 + vh / 2.0), MAT_FOLIAGE, parent=body)

    if sign:
        sign_mat = random.choice(MAT_SIGNS)
        pole_z = -height / 2.0 + height * 0.3
        add_cylinder(f"House_{uid}_signpole", 0.04, 0.6, (0, depth / 2.0 + 0.3, pole_z), MAT_LAMP_POLE, parent=body)
        board = add_box(f"House_{uid}_signboard", (1.0, 0.06, 0.6), (0, depth / 2.0 + 0.35, pole_z + 0.35), sign_mat, parent=body)
        _add_sign_icon(board, uid)
    return body


def _add_sign_icon(board, uid):
    """A small silhouette shape on a hanging sign -- mug/book/loaf/scissors,
    a cheap stand-in for a real icon glyph. Dark wrought-iron-ish color."""
    icon = random.choice(("mug", "book", "loaf", "scissors"))
    if icon == "mug":
        add_cylinder(f"House_{uid}_icon", 0.14, 0.2, (0, -0.04, 0), MAT_LAMP_POLE, parent=board)
    elif icon == "book":
        add_box(f"House_{uid}_icon", (0.3, 0.03, 0.2), (0, -0.04, 0), MAT_LAMP_POLE, parent=board)
    elif icon == "loaf":
        add_sphere(f"House_{uid}_icon", 0.16, (0, -0.04, 0), MAT_LAMP_POLE, z_scale=0.6, parent=board)
    else:
        a = add_box(f"House_{uid}_icon_a", (0.28, 0.02, 0.05), (0, -0.04, 0), MAT_LAMP_POLE, parent=board)
        a.rotation_euler.y = math.radians(30.0)
        b = add_box(f"House_{uid}_icon_b", (0.28, 0.02, 0.05), (0, -0.04, 0), MAT_LAMP_POLE, parent=board)
        b.rotation_euler.y = math.radians(-30.0)


def make_wall_infill(center, length_axis, location_z_height=WALL_HEIGHT):
    """A solid blocking building spanning a closed maze edge between two blocks."""
    uid = _next_id()
    wall_mat = random.choice(MAT_WALLS)
    roof_mat = random.choice(MAT_ROOFS)
    if length_axis == "x":
        size = (STREET_WIDTH, BLOCK_SIZE, location_z_height)
        roof_w, roof_d = STREET_WIDTH * ROOF_OVERHANG, BLOCK_SIZE * ROOF_OVERHANG
    else:
        size = (BLOCK_SIZE, STREET_WIDTH, location_z_height)
        roof_w, roof_d = BLOCK_SIZE * ROOF_OVERHANG, STREET_WIDTH * ROOF_OVERHANG
    body = add_box(f"Wall_{uid}", size, (center[0], center[1], location_z_height / 2.0), wall_mat)
    add_gable_roof(f"Wall_{uid}_roof", roof_w, roof_d, location_z_height * 0.3, (0, 0, location_z_height / 2.0), roof_mat, parent=body)
    return body


def make_landmark_dome(location):
    AUDIO_ANCHORS["landmark"].append([location[0], location[1], 12.0])
    drum_radius = 9.0
    drum_height = 7.0
    drum = add_cylinder("Landmark_Drum", drum_radius, drum_height,
                         (location[0], location[1], drum_height / 2.0), MAT_STONE, vertices=20)
    for i in range(12):
        angle = i * (2 * math.pi / 12)
        cx = math.cos(angle) * (drum_radius - 0.5)
        cy = math.sin(angle) * (drum_radius - 0.5)
        add_cylinder(f"Landmark_Column_{i}", 0.45, drum_height, (cx, cy, 0), MAT_STONE, parent=drum)
    add_sphere("Landmark_Dome", drum_radius, (location[0], location[1], drum_height + 1.2), MAT_STONE, z_scale=0.65)
    add_sphere("Landmark_Beacon_Light", 0.6, (location[0], location[1], drum_height + drum_radius * 0.65 + 2.0),
               MAT_LANDMARK_LIGHT)
    return drum


def make_lamp_post(location):
    pole = add_cylinder("LampPost", 0.075, 4.0, (location[0], location[1], 2.0), MAT_LAMP_POLE)
    add_sphere("LampHead", 0.35, (0, 0.25, 1.85), MAT_LAMP_HEAD, parent=pole)
    return pole


def make_tree(location):
    total_h = random.uniform(3.0, 5.0)
    trunk_h = total_h * 0.45
    trunk = add_cylinder("TreeTrunk", 0.15, trunk_h, (location[0], location[1], trunk_h / 2.0), MAT_TRUNK)
    canopy_base = trunk_h * 0.6
    for i in range(random.randint(2, 3)):
        r = random.uniform(0.9, 1.3)
        add_sphere(f"TreeFoliage_{i}", r,
                   (random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), canopy_base + random.uniform(0.3, 0.9)),
                   MAT_FOLIAGE, z_scale=random.uniform(0.8, 1.1), parent=trunk)
    return trunk


def make_cafe_patio(location, rotation_z=0.0):
    """1 bistro table + 2 chairs + cups, for a plaza/landmark-adjacent
    sidewalk -- see build_city() for placement, kept off the open street."""
    anchor = add_empty(f"CafePatio_{_next_id()}", (location[0], location[1], 0.0))
    AUDIO_ANCHORS["terraces"].append([location[0], location[1], 1.0])
    anchor.rotation_euler.z = rotation_z

    add_cylinder("CafeTable_Leg", 0.05, 0.7, (0, 0, 0.35), MAT_LAMP_POLE, parent=anchor)
    add_cylinder("CafeTable_Top", 0.35, 0.04, (0, 0, 0.72), MAT_BENCH, parent=anchor)
    for c, (cx, cy) in enumerate(((0.5, 0.0), (-0.5, 0.0))):
        chair = add_box(f"CafeChair_{c}_seat", (0.4, 0.4, 0.05), (cx, cy, 0.45), MAT_BENCH, parent=anchor)
        chair.rotation_euler.z = math.pi if cx > 0 else 0.0
        add_box(f"CafeChair_{c}_back", (0.4, 0.05, 0.5), (0, 0.18, 0.25), MAT_BENCH, parent=chair)
        for lx, ly in ((0.17, 0.17), (0.17, -0.17), (-0.17, 0.17), (-0.17, -0.17)):
            add_cylinder(f"CafeChair_{c}_leg_{lx}_{ly}", 0.02, 0.45, (lx, ly, -0.225), MAT_LAMP_POLE, parent=chair)
    add_cylinder("CafeCup_0", 0.05, 0.08, (0.1, 0.05, 0.78), MAT_INTERIOR_GLOW, parent=anchor)
    add_cylinder("CafeCup_1", 0.05, 0.08, (-0.08, -0.06, 0.78), MAT_INTERIOR_GLOW, parent=anchor)
    return anchor


def make_pet_dog(location, rotation_z=0.0):
    body = add_sphere(f"Pet_{_next_id()}", 0.22, (location[0], location[1], 0.22), MAT_PETS[0], z_scale=0.75)
    body.rotation_euler.z = rotation_z
    add_sphere("PetHead", 0.14, (0.22, 0, 0.06), MAT_PETS[0], parent=body)
    add_cone("PetTail", 0.05, 0.2, (-0.22, 0, 0.05), MAT_PETS[0], parent=body, vertices=6)
    return body


def make_pet_cat(location, rotation_z=0.0):
    """Curled/sitting silhouette -- a squashed sphere reads fine at a
    glance and is far cheaper than a posed body."""
    body = add_sphere(f"Pet_{_next_id()}", 0.16, (location[0], location[1], 0.14), MAT_PETS[1], z_scale=0.65)
    body.rotation_euler.z = rotation_z
    add_sphere("PetHead", 0.1, (0.13, 0.05, 0.06), MAT_PETS[1], parent=body)
    add_cone("PetEar_0", 0.03, 0.06, (0.16, 0.09, 0.13), MAT_PETS[1], parent=body, vertices=4)
    add_cone("PetEar_1", 0.03, 0.06, (0.16, 0.01, 0.13), MAT_PETS[1], parent=body, vertices=4)
    return body


def make_crate(location, rotation_z=0.0):
    crate = add_box(f"Crate_{_next_id()}", (0.6, 0.6, 0.6), (location[0], location[1], 0.3), MAT_TRUNK)
    crate.rotation_euler.z = rotation_z
    return crate


def make_barrel(location):
    barrel = add_cylinder(f"Barrel_{_next_id()}", 0.3, 0.7, (location[0], location[1], 0.35), MAT_TRUNK)
    add_cylinder("Barrel_HoopTop", 0.31, 0.05, (0, 0, 0.22), MAT_LAMP_POLE, parent=barrel)
    add_cylinder("Barrel_HoopBottom", 0.31, 0.05, (0, 0, -0.22), MAT_LAMP_POLE, parent=barrel)
    return barrel


def make_laundry_line(p1, p2, height):
    """A sagging line between two points with a few hanging fabric
    rectangles -- approximated as 3 straight segments (a shallow V) rather
    than a true catenary curve, which is plenty for background clutter
    nobody examines closely."""
    uid = _next_id()
    mid = ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0, height - 0.4)
    p1_3d = (p1[0], p1[1], height)
    p2_3d = (p2[0], p2[1], height)
    for a, b in ((p1_3d, mid), (mid, p2_3d)):
        seg_center = tuple((a[i] + b[i]) / 2.0 for i in range(3))
        length = math.dist(a, b)
        seg = add_cylinder(f"Laundry_{uid}_rope", 0.015, length, seg_center, MAT_LAMP_POLE)
        direction = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        seg.rotation_euler.x = math.atan2(math.hypot(direction[0], direction[1]), direction[2])
        seg.rotation_euler.z = math.atan2(direction[1], direction[0])
    for i in range(random.randint(2, 3)):
        t = random.uniform(0.15, 0.85)
        cx = p1_3d[0] + (p2_3d[0] - p1_3d[0]) * t
        cy = p1_3d[1] + (p2_3d[1] - p1_3d[1]) * t
        cz = height - 0.4 * math.sin(t * math.pi) - 0.25
        cloth = add_box(f"Laundry_{uid}_cloth_{i}", (0.35, 0.03, 0.5), (cx, cy, cz), random.choice(MAT_SIGNS))
        cloth.rotation_euler.z = random.uniform(-0.3, 0.3)


def make_bollard(location):
    bollard = add_cylinder(f"Bollard_{_next_id()}", 0.12, 0.8, (location[0], location[1], 0.4), MAT_STONE)
    add_sphere("Bollard_Cap", 0.13, (0, 0, 0.42), MAT_STONE, z_scale=0.6, parent=bollard)
    return bollard


# Where the SATIE audio world places its emitters, in Blender coordinates
# (x, y, height). Exported with the maze graph because merge_by_material()
# erases per-object names. Collecting these must never consume random numbers:
# the city layout depends on the exact random sequence.
AUDIO_ANCHORS = {"canal": [], "fountains": [], "terraces": [], "clocktowers": [], "landmark": []}


def make_fountain(location):
    AUDIO_ANCHORS["fountains"].append([location[0], location[1], 1.3])
    add_cylinder("Fountain_Base", 2.2, 0.6, (location[0], location[1], 0.3), MAT_STONE)
    add_cylinder("Fountain_Water", 1.9, 0.1, (location[0], location[1], 0.62), MAT_WATER)
    add_cylinder("Fountain_Spout", 0.25, 1.4, (location[0], location[1], 1.3), MAT_STONE)
    add_sphere("Fountain_Top", 0.35, (location[0], location[1], 2.05), MAT_STONE)


def make_bench(location, rotation_z=0.0):
    bench = add_box("Bench_Seat", (1.4, 0.5, 0.08), (location[0], location[1], 0.45), MAT_BENCH)
    bench.rotation_euler.z = rotation_z
    add_box("Bench_Back", (1.4, 0.08, 0.5), (0, -0.21, 0.25), MAT_BENCH, parent=bench)
    return bench


def make_planter(location):
    pot = add_cylinder("Planter_Pot", 0.5, 0.5, (location[0], location[1], 0.25), MAT_STONE)
    add_sphere("Planter_Bush", 0.55, (0, 0, 0.55), MAT_FOLIAGE, parent=pot)
    return pot


# ---------------------------------------------------------------------------
# Unique "memorable" landmark buildings -- placed at maze dead-ends, distinct
# from the repeated rowhouse kit so a player can use them as a mental
# landmark ("turn around at the leaning house").
# ---------------------------------------------------------------------------
def make_round_tower(location):
    height = 16.0
    radius = 3.2
    body = add_cylinder(f"RoundTower_{_next_id()}", radius, height, (location[0], location[1], height / 2.0),
                         random.choice(MAT_WALLS), vertices=14)
    add_cone(f"{body.name}_roof", radius * 1.15, height * 0.4, (0, 0, height / 2.0), random.choice(MAT_ROOFS),
              parent=body, vertices=14)
    for i in range(3):
        wz = -height / 2.0 + height * (0.3 + i * 0.25)
        add_box(f"{body.name}_win_{i}", (0.6, 0.15, 0.9), (0, radius + 0.05, wz), MAT_WINDOW, parent=body)
    return body


def make_leaning_house(location, rotation_z=0.0):
    """Same idea as a rowhouse, but visibly tilted -- an old-town cliche
    that's also a strong, easy-to-remember visual landmark."""
    uid = _next_id()
    width, depth, height = 6.5, 6.0, 13.0
    body = add_box(f"Leaning_{uid}", (width, depth, height), (location[0], location[1], height / 2.0),
                    random.choice(MAT_WALLS))
    body.rotation_euler.z = rotation_z
    body.rotation_euler.x = math.radians(7.0)
    add_gable_roof(f"Leaning_{uid}_roof", width * ROOF_OVERHANG, depth * ROOF_OVERHANG, height * 0.4, (0, 0, height / 2.0),
                    random.choice(MAT_ROOFS), parent=body)
    wz = -height / 2.0 + height * 0.6
    for col in range(2):
        wx = (col - 0.5) * (width * 0.42)
        add_box(f"Leaning_{uid}_win_{col}", (width * 0.2, 0.08, height * 0.16),
                (wx, depth / 2.0 + 0.04, wz), MAT_WINDOW, parent=body)
    return body


def make_turret_house(location, rotation_z=0.0):
    uid = _next_id()
    width, depth, height = 7.0, 6.0, 12.0
    body = add_box(f"Turret_{uid}", (width, depth, height), (location[0], location[1], height / 2.0),
                    random.choice(MAT_WALLS))
    body.rotation_euler.z = rotation_z
    add_gable_roof(f"Turret_{uid}_roof", width * ROOF_OVERHANG, depth * ROOF_OVERHANG, height * 0.35, (0, 0, height / 2.0),
                    random.choice(MAT_ROOFS), parent=body)

    turret_h = height * 1.35
    turret = add_cylinder(f"Turret_{uid}_tower", 1.4, turret_h, (width / 2.0, depth / 2.0, turret_h / 2.0 - height / 2.0),
                           random.choice(MAT_WALLS), parent=body, vertices=10)
    add_cone(f"{turret.name}_cap", 1.6, 2.5, (0, 0, turret_h / 2.0), random.choice(MAT_ROOFS), parent=turret, vertices=10)
    return body


def make_clocktower(location):
    uid = _next_id()
    height = 20.0
    AUDIO_ANCHORS["clocktowers"].append([location[0], location[1], height * 0.8])
    width = 5.0
    body = add_box(f"Clocktower_{uid}", (width, width, height), (location[0], location[1], height / 2.0),
                    MAT_STONE)
    add_cone(f"Clocktower_{uid}_spire", width * 0.8, height * 0.3, (0, 0, height / 2.0), random.choice(MAT_ROOFS),
              parent=body, vertices=4)
    clock_z = height * 0.3
    for i, (nx, ny) in enumerate(((0, 1), (0, -1), (1, 0), (-1, 0))):
        face = add_cylinder(f"Clocktower_{uid}_face_{i}", 1.0, 0.1,
                             (nx * (width / 2.0 + 0.05), ny * (width / 2.0 + 0.05), clock_z),
                             MAT_CLOCK_FACE, parent=body, vertices=16)
        face.rotation_euler.x = math.pi / 2.0 if ny != 0 else 0.0
        face.rotation_euler.y = math.pi / 2.0 if nx != 0 else 0.0
        add_box(f"{face.name}_hand", (0.08, 0.5, 0.03), (0, 0, 0.05), MAT_CLOCK_HAND, parent=face)
    return body


def make_canal():
    center_y = -CANAL_GAP - CANAL_WIDTH / 2.0
    add_box("Canal_Water", (GRID_SPAN + 20.0, CANAL_WIDTH, 0.3), (GRID_SPAN / 2.0, center_y, -0.05), MAT_WATER)
    # Five water emitters spread along the canal's length.
    for i in range(5):
        AUDIO_ANCHORS["canal"].append([-10.0 + i * (GRID_SPAN + 20.0) / 4.0, center_y, 0.3])
    for side, sign in (("N", 1.0), ("S", -1.0)):
        edge_y = center_y + sign * (CANAL_WIDTH / 2.0 + 0.5)
        # Solid, continuous for the whole canal length -- this (plus its
        # auto-generated collision) is what stops the player stepping into
        # the canal. Nothing below should ever put a gap in this box.
        add_box(f"Canal_Embankment_{side}", (GRID_SPAN + 20.0, 1.0, 1.2), (GRID_SPAN / 2.0, edge_y, 0.4), MAT_STONE)
        # coping stones along the top edge
        add_box(f"Canal_Coping_{side}", (GRID_SPAN + 20.0, 1.2, 0.12), (GRID_SPAN / 2.0, edge_y, 1.06), MAT_STONE)
        # low railing on the pedestrian (north) side only -- a guard rail
        # along open water, not needed on the far bank
        if side == "N":
            rail_y = edge_y - 0.3
            add_box("Canal_Railing_Bar", (GRID_SPAN + 20.0, 0.05, 0.05), (GRID_SPAN / 2.0, rail_y, 1.7), MAT_LAMP_POLE)
            post_count = int((GRID_SPAN + 20.0) // 3.0)
            for i in range(post_count):
                px = i * 3.0
                add_cylinder(f"Canal_Railing_Post_{i}", 0.03, 0.7, (px, rail_y, 1.35), MAT_LAMP_POLE)

    # mooring bollards along the embankment top, between the railing posts
    for i in range(int((GRID_SPAN + 20.0) // 12.0) + 1):
        px = 6.0 + i * 12.0
        make_bollard((px, center_y + CANAL_WIDTH / 2.0 + 0.5))

    # 2-3 skiffs resting on the water, moored to the embankment -- purely
    # decorative, sitting on Canal_Water which is outside the maze grid
    boat_xs = [GRID_SPAN * 0.2, GRID_SPAN * 0.5, GRID_SPAN * 0.8]
    for bx in boat_xs:
        make_boat((bx, center_y + random.uniform(-1.5, 1.5)), rotation_z=random.uniform(-0.3, 0.3))

    # decorative stone arch bridge at the canal's far terminus, well past
    # the maze grid and the water itself -- scenery only, not a crossing
    # anyone can actually reach or use
    make_canal_arch_bridge((GRID_SPAN + 16.0, center_y))


def make_boat(location, rotation_z=0.0):
    uid = _next_id()
    boat = add_box(f"Boat_{uid}_hull", (2.2, 0.8, 0.35), (location[0], location[1], -0.05), MAT_TRUNK)
    boat.rotation_euler.z = rotation_z
    for i in range(2):
        add_box(f"Boat_{uid}_seat_{i}", (0.15, 0.7, 0.06), ((i - 0.5) * 0.9, 0, 0.12), MAT_TRUNK, parent=boat)
    add_cylinder(f"Boat_{uid}_oar_0", 0.02, 1.6, (0.3, 0.5, 0.15), MAT_TRUNK, parent=boat)
    add_cylinder(f"Boat_{uid}_oar_1", 0.02, 1.6, (-0.3, 0.5, 0.15), MAT_TRUNK, parent=boat)
    # mooring rope: a thin angled bar from bow toward the embankment
    rope = add_box(f"Boat_{uid}_rope", (0.03, 1.1, 0.03), (1.1, 0.6, 0.2), MAT_LAMP_POLE, parent=boat)
    rope.rotation_euler.x = math.radians(25.0)
    return boat


def make_canal_arch_bridge(location):
    """Decorative only -- placed past the canal's usable extent (see
    make_canal), not aligned with or connected to any walkable maze path."""
    uid = _next_id()
    pier_h = 2.0
    for side in (-1, 1):
        add_box(f"Bridge_{uid}_pier_{side}", (0.8, 0.8, pier_h),
                (location[0], location[1] + side * (CANAL_WIDTH / 2.0 + 0.5), pier_h / 2.0), MAT_STONE)
    add_box(f"Bridge_{uid}_span", (0.8, CANAL_WIDTH + 2.0, 0.6),
            (location[0], location[1], pier_h + 0.3), MAT_STONE)
    for side in (-1, 1):
        add_box(f"Bridge_{uid}_rail_{side}", (0.1, CANAL_WIDTH + 2.0, 0.5),
                (location[0] + side * 0.4, location[1], pier_h + 0.85), MAT_STONE)


# ---------------------------------------------------------------------------
# Maze generation (recursive backtracker -- a "perfect" maze: exactly one
# path between any two cells, so distance = difficulty, no shortcuts).
# ---------------------------------------------------------------------------
def generate_maze(size):
    visited = [[False] * size for _ in range(size)]
    open_e = [[False] * size for _ in range(size)]   # open_e[r][c]: passage from (r,c) to (r,c+1)
    open_n = [[False] * size for _ in range(size)]    # open_n[r][c]: passage from (r,c) to (r+1,c)

    stack = [(0, 0)]
    visited[0][0] = True
    while stack:
        r, c = stack[-1]
        neighbors = []
        if c + 1 < size and not visited[r][c + 1]:
            neighbors.append(("E", r, c + 1))
        if c - 1 >= 0 and not visited[r][c - 1]:
            neighbors.append(("W", r, c - 1))
        if r + 1 < size and not visited[r + 1][c]:
            neighbors.append(("N", r + 1, c))
        if r - 1 >= 0 and not visited[r - 1][c]:
            neighbors.append(("S", r - 1, c))
        if not neighbors:
            stack.pop()
            continue
        direction, nr, nc = random.choice(neighbors)
        if direction == "E":
            open_e[r][c] = True
        elif direction == "W":
            open_e[nr][nc] = True
        elif direction == "N":
            open_n[r][c] = True
        elif direction == "S":
            open_n[nr][nc] = True
        visited[nr][nc] = True
        stack.append((nr, nc))
    return open_e, open_n


def farthest_cell(open_e, open_n, size, start):
    """BFS to find the cell with the longest graph-distance from `start`."""
    from collections import deque
    dist = {start: 0}
    q = deque([start])
    best = start
    while q:
        r, c = q.popleft()
        for nr, nc in _neighbors(open_e, open_n, size, r, c):
            if (nr, nc) not in dist:
                dist[(nr, nc)] = dist[(r, c)] + 1
                q.append((nr, nc))
                if dist[(nr, nc)] > dist[best]:
                    best = (nr, nc)
    return best, dist[best]


def _neighbors(open_e, open_n, size, r, c):
    out = []
    if c + 1 < size and open_e[r][c]:
        out.append((r, c + 1))
    if c - 1 >= 0 and open_e[r][c - 1]:
        out.append((r, c - 1))
    if r + 1 < size and open_n[r][c]:
        out.append((r + 1, c))
    if r - 1 >= 0 and open_n[r - 1][c]:
        out.append((r - 1, c))
    return out


def _degree(open_e, open_n, size, r, c):
    return len(_neighbors(open_e, open_n, size, r, c))


# ---------------------------------------------------------------------------
# City layout
# ---------------------------------------------------------------------------
def block_origin(col, row):
    x = col * STEP + BLOCK_SIZE / 2.0
    y = row * STEP + BLOCK_SIZE / 2.0
    return x, y


def build_block(col, row, featured=False):
    cx, cy = block_origin(col, row)
    half = BLOCK_SIZE / 2.0
    inset = 2.5
    spacing = 6.5

    # 2 rowhouses per edge, facing outward, for denser enclosure (discourages
    # cutting through block interiors as a maze shortcut). "featured" blocks
    # (near the landmark/fountains) get signs + a couple of lit windows --
    # everywhere else stays plain, since that repeats ~190 times and is a
    # real cost to draw-call count on Quest.
    edge_defs = [
        ("S", 0.0, lambda t: (cx - half / 2.0 + t * half, cy - half + inset)),
        ("N", math.pi, lambda t: (cx - half / 2.0 + t * half, cy + half - inset)),
        ("W", math.pi / 2.0, lambda t: (cx - half + inset, cy - half / 2.0 + t * half)),
        ("E", -math.pi / 2.0, lambda t: (cx + half - inset, cy - half / 2.0 + t * half)),
    ]
    for _, rot, pos_fn in edge_defs:
        for t in (0.35, 1.65):
            x, y = pos_fn(t)
            make_rowhouse(
                (x, y), rotation_z=rot, width=spacing - 0.5,
                sign=featured and random.random() < 0.5,
                interior_glow=featured and random.random() < 0.3,
                storefront=featured and random.random() < 0.35,
                flower_box=random.random() < 0.25,
                vines=random.random() < 0.2,
                chimney=random.random() < 0.4,
                lantern=featured and random.random() < 0.4,
            )


def build_walls(open_e, open_n):
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            cx, cy = block_origin(col, row)
            if col + 1 < GRID_SIZE and not open_e[row][col]:
                nx, _ = block_origin(col + 1, row)
                make_wall_infill(((cx + nx) / 2.0, cy), "x")
            if row + 1 < GRID_SIZE and not open_n[row][col]:
                _, ny = block_origin(col, row + 1)
                make_wall_infill((cx, (cy + ny) / 2.0), "y")


def build_ground():
    add_box("Ground", (GRID_SPAN + STREET_WIDTH + 30.0, GRID_SPAN + STREET_WIDTH + CANAL_GAP + CANAL_WIDTH + 20.0, 0.2),
            (GRID_SPAN / 2.0, (GRID_SPAN - CANAL_GAP - CANAL_WIDTH) / 2.0, -0.1), MAT_COBBLE)
    curb_h = 0.15
    for col in range(GRID_SIZE):
        for row in range(GRID_SIZE):
            cx, cy = block_origin(col, row)
            add_box(f"Sidewalk_{col}_{row}", (BLOCK_SIZE + 1.0, BLOCK_SIZE + 1.0, curb_h),
                    (cx, cy, curb_h / 2.0), MAT_SIDEWALK)
            # beveled curb strip around the raised sidewalk, between it and
            # the street -- real sidewalks aren't flush with the road.
            half_edge = (BLOCK_SIZE + 1.0) / 2.0
            for nx, ny, w, d in (
                (0, -1, BLOCK_SIZE + 1.3, 0.15), (0, 1, BLOCK_SIZE + 1.3, 0.15),
                (-1, 0, 0.15, BLOCK_SIZE + 1.3), (1, 0, 0.15, BLOCK_SIZE + 1.3),
            ):
                add_box(f"Curb_{col}_{row}_{nx}_{ny}", (w, d, curb_h),
                        (cx + nx * half_edge, cy + ny * half_edge, curb_h / 2.0), MAT_STONE)


def scatter_canal_clutter():
    """Crates/barrels along the canal's pedestrian embankment -- the canal
    sits outside the maze grid entirely (see make_canal), so this can't
    obstruct a maze path by construction."""
    center_y = -CANAL_GAP - CANAL_WIDTH / 2.0
    edge_y = center_y + (CANAL_WIDTH / 2.0 + 0.5) - 1.3  # just inside the railing, on the walkway
    spacing = 9.0
    n = int((GRID_SPAN + 20.0) // spacing)
    for i in range(n + 1):
        x = i * spacing
        roll = random.random()
        if roll < 0.3:
            make_crate((x, edge_y), rotation_z=random.uniform(0, math.tau))
        elif roll < 0.5:
            make_barrel((x, edge_y))


def scatter_props(open_e, open_n):
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            cx, cy = block_origin(col, row)
            if col + 1 < GRID_SIZE and open_e[row][col] and random.random() < 0.6:
                nx, _ = block_origin(col + 1, row)
                make_lamp_post(((cx + nx) / 2.0, cy + BLOCK_SIZE / 2.0 + 1.0))
            if row + 1 < GRID_SIZE and open_n[row][col] and random.random() < 0.5:
                _, ny = block_origin(col, row + 1)
                make_tree((cx + BLOCK_SIZE / 2.0 + 1.0, (cy + ny) / 2.0))


def export_maze_json(open_e, open_n, start_cell, landmark_cell):
    cells = []
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            cells.append(list(block_origin(col, row)))
    data = {
        "grid_size": GRID_SIZE,
        "block_size": BLOCK_SIZE,
        "step": STEP,
        "cells": cells,  # index = row * grid_size + col
        "open_e": open_e,
        "open_n": open_n,
        "start_cell": list(start_cell),
        "landmark_cell": list(landmark_cell),
        "audio_anchors": AUDIO_ANCHORS,
    }
    os.makedirs(ENV_DIR, exist_ok=True)
    with open(MAZE_JSON_PATH, "w") as f:
        json.dump(data, f)
    print(f"Exported maze graph to: {MAZE_JSON_PATH}")


LANDMARK_BUILDERS = [make_round_tower, make_leaning_house, make_turret_house, make_clocktower]


def build_city():
    clear_scene()
    open_e, open_n = generate_maze(GRID_SIZE)
    start_cell = (0, 0)
    landmark_cell, _ = farthest_cell(open_e, open_n, GRID_SIZE, start_cell)

    build_ground()
    make_canal()

    dead_ends = [
        (r, c) for r in range(GRID_SIZE) for c in range(GRID_SIZE)
        if (r, c) != landmark_cell and _degree(open_e, open_n, GRID_SIZE, r, c) == 1
    ]
    crossroads = [
        (r, c) for r in range(GRID_SIZE) for c in range(GRID_SIZE)
        if (r, c) != landmark_cell and (r, c) not in dead_ends
        and _degree(open_e, open_n, GRID_SIZE, r, c) >= 3
    ]
    fountain_cell = random.choice(crossroads) if crossroads else None

    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            cell = (row, col)
            pos = block_origin(col, row)
            if cell == landmark_cell:
                make_landmark_dome(pos)
                make_fountain((pos[0] + 12.0, pos[1]))
                for i in range(4):
                    angle = i * (math.pi / 2.0)
                    make_planter((pos[0] + math.cos(angle) * 10.0, pos[1] + math.sin(angle) * 10.0))
            elif cell in dead_ends:
                builder = LANDMARK_BUILDERS[dead_ends.index(cell) % len(LANDMARK_BUILDERS)]
                if builder is make_round_tower or builder is make_clocktower:
                    builder(pos)
                else:
                    builder(pos, rotation_z=random.uniform(0.0, math.tau))
                # street clutter tucked beside the landmark building, not in
                # front of it -- keeps the approach to each dead end clear
                make_crate((pos[0] + 6.0, pos[1] + 3.0), rotation_z=random.uniform(0, math.tau))
                make_barrel((pos[0] + 6.0, pos[1] - 3.0))
                bracket = add_box(f"DeadEnd_{_next_id()}_lantern_bracket", (0.05, 0.3, 0.05),
                                   (pos[0] - 5.5, pos[1], 2.2), MAT_LAMP_POLE)
                add_sphere(f"{bracket.name}_head", 0.16, (0, 0.2, -0.05), MAT_LAMP_HEAD, parent=bracket)
            elif cell == fountain_cell:
                build_block(col, row, featured=True)
                make_fountain(pos)
                make_bench((pos[0] + 2.5, pos[1] + 2.5), rotation_z=math.pi / 4.0)
                make_bench((pos[0] - 2.5, pos[1] - 2.5), rotation_z=math.pi / 4.0)
                make_cafe_patio((pos[0] - 4.0, pos[1] + 4.0), rotation_z=random.uniform(0, math.tau))
                make_pet_dog((pos[0] - 3.3, pos[1] + 3.3), rotation_z=random.uniform(0, math.tau))
            else:
                near_poi = cell in [(landmark_cell[0] + dr, landmark_cell[1] + dc)
                                     for dr in (-1, 0, 1) for dc in (-1, 0, 1)]
                build_block(col, row, featured=near_poi)

    # a second cafe patio and a resting cat near the landmark plaza
    lx, ly = block_origin(landmark_cell[1], landmark_cell[0])
    make_cafe_patio((lx - 12.0, ly - 4.0), rotation_z=random.uniform(0, math.tau))
    make_pet_cat((lx - 11.3, ly - 3.3), rotation_z=random.uniform(0, math.tau))

    # a handful of laundry lines strung across a few ordinary blocks --
    # loosely placed (not pinned to exact rowhouse wall positions), since
    # this is background clutter nobody examines up close
    ordinary_cells = [
        (r, c) for r in range(GRID_SIZE) for c in range(GRID_SIZE)
        if (r, c) != landmark_cell and (r, c) != fountain_cell and (r, c) not in dead_ends
    ]
    random.shuffle(ordinary_cells)
    for r, c in ordinary_cells[:4]:
        bx, by = block_origin(c, r)
        span = random.choice([(1, 0), (0, 1)])
        p1 = (bx - span[0] * 4.0, by - span[1] * 4.0)
        p2 = (bx + span[0] * 4.0, by + span[1] * 4.0)
        make_laundry_line(p1, p2, height=random.uniform(6.0, 9.0))

    build_walls(open_e, open_n)
    scatter_props(open_e, open_n)
    scatter_canal_clutter()
    export_maze_json(open_e, open_n, start_cell, landmark_cell)


def merge_by_material(exclude_names=("Landmark_Beacon_Light",)):
    """Collapses the whole city down to ~1 merged object per material, for
    Quest draw-call count. This only works correctly if nothing depends on
    an individual object's name/identity after this point -- which is why
    Landmark_Beacon_Light (looked up by name at runtime by city_life.gd) is
    excluded and kept as its own object. Everything else (spawn points,
    the win condition, collision) is driven by city_maze.json positions or
    generated fresh in Godot from geometry, not by per-object names, so
    merging is safe for them.
    """
    # Flatten all parent/child relationships first, preserving world
    # transform, so joining objects across different buildings (each with
    # its own children: roof, windows, sills, door) doesn't orphan anything.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")

    groups = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or obj.name in exclude_names or not obj.data.materials:
            continue
        groups.setdefault(obj.data.materials[0].name, []).append(obj)

    merged_count = 0
    for mat_name, objs in groups.items():
        if len(objs) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        bpy.context.view_layer.objects.active.name = f"Merged_{mat_name}"
        merged_count += 1

    total_objects = sum(1 for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"merge_by_material: {merged_count} merged groups, {total_objects} total mesh objects remain")


def export_glb(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
    )
    print(f"Exported city to: {path}")


if __name__ == "__main__":
    build_city()
    merge_by_material()
    export_glb(GLB_PATH)
