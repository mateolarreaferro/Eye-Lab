## Autoload singleton. Ambient motion for the city -- birds circling
## overhead, a pulsing landmark light, a few pedestrians patrolling open
## streets. Purely cosmetic: a static blockout reads as "fake" mostly
## because nothing moves, so this is the cheapest lever for perceived
## realism. Loads its own copy of city_maze.json (tiny file, decoupled from
## VisionQuestGame's own use of it).
extends Node3D

const BIRD_COUNT := 6
const BIRD_RADIUS := 14.0
const BIRD_HEIGHT := 22.0
const PEDESTRIAN_COUNT := 10
const PET_COUNT := 5

var _birds: Array = []
var _bird_phase: Array = []
var _pedestrians: Array = []
var _pedestrian_origin: Array = []
var _pedestrian_axis: Array = []
var _pets: Array = []
var _pet_origin: Array = []
var _pet_axis: Array = []
var _landmark_light: MeshInstance3D
var _time := 0.0


func _ready() -> void:
	_spawn_birds()
	call_deferred("_hook_up_to_city")


func _hook_up_to_city() -> void:
	var light_node := _find_by_name(get_tree().root, "Landmark_Beacon_Light")
	if light_node == null:
		call_deferred("_hook_up_to_city")
		return
	_landmark_light = light_node as MeshInstance3D
	var mat := StandardMaterial3D.new()
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.65, 0.2)
	mat.emission_energy_multiplier = 4.0
	_landmark_light.material_override = mat

	_spawn_street_life()


func _process(delta: float) -> void:
	_time += delta

	for i in _birds.size():
		var b: Node3D = _birds[i]
		var phase: float = _bird_phase[i] + _time * 0.3
		b.position = Vector3(
			cos(phase) * BIRD_RADIUS,
			BIRD_HEIGHT + sin(_time * 0.5 + i) * 1.5,
			sin(phase) * BIRD_RADIUS
		)

	if _landmark_light:
		var mat := _landmark_light.material_override as StandardMaterial3D
		if mat:
			mat.emission_energy_multiplier = 3.0 + sin(_time * 2.0) * 1.5

	for i in _pedestrians.size():
		var p: Node3D = _pedestrians[i]
		var origin: Vector3 = _pedestrian_origin[i]
		var axis: Vector3 = _pedestrian_axis[i]
		var offset := sin(_time * 0.4 + i * 1.7) * 3.0
		p.position = origin + axis * offset

	for i in _pets.size():
		var pet: Node3D = _pets[i]
		var p_origin: Vector3 = _pet_origin[i]
		var p_axis: Vector3 = _pet_axis[i]
		var p_offset := sin(_time * 0.9 + i * 2.3) * 1.5  ## pets dart around faster, shorter range
		pet.position = p_origin + p_axis * p_offset


func _spawn_birds() -> void:
	var bird_mat := StandardMaterial3D.new()
	bird_mat.albedo_color = Color(0.1, 0.1, 0.12)
	for i in BIRD_COUNT:
		var bird := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.25
		mesh.height = 0.5
		bird.mesh = mesh
		bird.material_override = bird_mat
		add_child(bird)
		_birds.append(bird)
		_bird_phase.append(randf() * TAU)


func _open_street_segments() -> Array:
	var f := FileAccess.open("res://environment/city_maze.json", FileAccess.READ)
	if f == null:
		return []
	var data = JSON.parse_string(f.get_as_text())
	f.close()
	if data == null:
		return []

	var grid_size: int = data["grid_size"]
	var cells: Array = []
	for c in data["cells"]:
		cells.append(Vector3(c[0], 0.0, -c[1]))  # see vision_quest_game.gd for why the Z sign flip
	var open_e: Array = data["open_e"]
	var open_n: Array = data["open_n"]

	var segments: Array = []  # each entry: [midpoint: Vector3, axis: Vector3]
	for row in range(grid_size):
		for col in range(grid_size):
			if col + 1 < grid_size and bool(open_e[row][col]):
				var a: Vector3 = cells[row * grid_size + col]
				var b: Vector3 = cells[row * grid_size + col + 1]
				segments.append([(a + b) / 2.0, (b - a).normalized()])
			if row + 1 < grid_size and bool(open_n[row][col]):
				var a2: Vector3 = cells[row * grid_size + col]
				var b2: Vector3 = cells[(row + 1) * grid_size + col]
				segments.append([(a2 + b2) / 2.0, (b2 - a2).normalized()])
	return segments


func _spawn_street_life() -> void:
	var segments := _open_street_segments()
	if segments.is_empty():
		return

	var ped_mat := StandardMaterial3D.new()
	ped_mat.albedo_color = Color(0.3, 0.25, 0.35)
	for i in PEDESTRIAN_COUNT:
		var seg: Array = segments[randi() % segments.size()]
		var ped := MeshInstance3D.new()
		var mesh := CapsuleMesh.new()
		mesh.radius = 0.25
		mesh.height = 1.6
		ped.mesh = mesh
		ped.material_override = ped_mat
		var base_pos: Vector3 = seg[0] + Vector3(0, 0.8, 0)
		ped.position = base_pos
		add_child(ped)
		_pedestrians.append(ped)
		_pedestrian_origin.append(base_pos)
		_pedestrian_axis.append(seg[1])

	var pet_colors := [Color(0.35, 0.22, 0.1), Color(0.85, 0.85, 0.82), Color(0.15, 0.15, 0.15)]
	for i in PET_COUNT:
		var seg: Array = segments[randi() % segments.size()]
		var pet := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.22
		mesh.height = 0.32  # squashed into an ellipsoid via the mesh's own height, not object scale
		pet.mesh = mesh
		var pet_mat := StandardMaterial3D.new()
		pet_mat.albedo_color = pet_colors[randi() % pet_colors.size()]
		pet.material_override = pet_mat
		var base_pos: Vector3 = seg[0] + Vector3(randf_range(-1.5, 1.5), 0.2, randf_range(-1.5, 1.5))
		pet.position = base_pos
		add_child(pet)
		_pets.append(pet)
		_pet_origin.append(base_pos)
		_pet_axis.append(seg[1].rotated(Vector3.UP, randf_range(-0.6, 0.6)))


func _find_by_name(node: Node, target_name: String) -> Node:
	if node.name == target_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, target_name)
		if found:
			return found
	return null
