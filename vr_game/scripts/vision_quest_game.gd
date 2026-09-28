## Autoload singleton. The game loop: drop the player at a random spawn point
## in the city, they navigate (by sight alone, no compass/waypoint UI) to a
## glowing beacon, reaching it starts a new round at a new random spawn.
##
## Placeholder box-city below stands in for the real environment. To swap in
## a Spline export: replace the body of _build_placeholder_city() with
##   add_child(load("res://environment/city.glb").instantiate())
## and set _spawn_points from Marker3D nodes you place in that scene (grab
## them by group name, e.g. get_tree().get_nodes_in_group("spawn_point")).
## Nothing else in this script needs to change.
extends Node3D
class_name VisionQuestGame

@export var win_distance := 1.5   ## meters; how close counts as "arrived"
@export var respawn_delay := 2.0  ## seconds to pause before the next round

var _origin: XROrigin3D
var _target_position: Vector3
var _spawn_points: Array[Vector3] = []
var _round_active := false
var _beacon: MeshInstance3D


func _ready() -> void:
	call_deferred("_start")


func _start() -> void:
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		call_deferred("_start")
		return
	_origin = camera.get_parent() as XROrigin3D
	if _origin == null:
		push_error("VisionQuestGame|FATAL: XR camera's parent isn't an XROrigin3D")
		return

	_build_placeholder_city()
	_new_round()


func _process(_delta: float) -> void:
	if not _round_active or _origin == null:
		return
	var flat_origin := _origin.global_position
	var flat_target := _target_position
	flat_origin.y = 0.0
	flat_target.y = 0.0
	if flat_origin.distance_to(flat_target) <= win_distance:
		_on_target_reached()


func _new_round() -> void:
	var spawn: Vector3 = _spawn_points.pick_random()
	_origin.global_position = spawn
	_target_position = _spawn_points.pick_random()
	while _target_position.distance_to(spawn) < win_distance * 3.0:
		_target_position = _spawn_points.pick_random()
	_place_beacon(_target_position)
	_round_active = true
	print("VisionQuestGame|INFO: new round. spawn=%s target=%s" % [spawn, _target_position])


func _on_target_reached() -> void:
	_round_active = false
	print("VisionQuestGame|INFO: target reached!")
	await get_tree().create_timer(respawn_delay).timeout
	_new_round()


func _place_beacon(pos: Vector3) -> void:
	if _beacon == null:
		var mesh := SphereMesh.new()
		mesh.radius = 0.4
		mesh.height = 0.8
		var mat := StandardMaterial3D.new()
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.85, 0.2)
		mat.emission_energy_multiplier = 4.0
		_beacon = MeshInstance3D.new()
		_beacon.mesh = mesh
		_beacon.material_override = mat
		add_child(_beacon)
	_beacon.global_position = pos + Vector3(0, 1.0, 0)


func _build_placeholder_city() -> void:
	_spawn_points = [
		Vector3(6, 0, 6), Vector3(-6, 0, 6), Vector3(6, 0, -6),
		Vector3(-6, 0, -6), Vector3(0, 0, 9), Vector3(0, 0, -9),
	]

	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(24, 24)
	var floor_body := StaticBody3D.new()
	var floor_inst := MeshInstance3D.new()
	floor_inst.mesh = floor_mesh
	var floor_col := CollisionShape3D.new()
	var floor_shape := BoxShape3D.new()
	floor_shape.size = Vector3(24, 0.1, 24)
	floor_col.shape = floor_shape
	floor_col.position.y = -0.05
	floor_body.add_child(floor_inst)
	floor_body.add_child(floor_col)
	add_child(floor_body)

	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in range(14):
		var w := rng.randf_range(1.5, 3.5)
		var h := rng.randf_range(2.0, 8.0)
		var d := rng.randf_range(1.5, 3.5)
		var x := rng.randf_range(-10.0, 10.0)
		var z := rng.randf_range(-10.0, 10.0)
		if Vector2(x, z).length() < 4.0:
			continue  # keep the middle clear so the beacon stays visible
		var box_mesh := BoxMesh.new()
		box_mesh.size = Vector3(w, h, d)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(rng.randf_range(0.5, 0.9), rng.randf_range(0.5, 0.9), rng.randf_range(0.5, 0.9))
		var body := StaticBody3D.new()
		var inst := MeshInstance3D.new()
		inst.mesh = box_mesh
		inst.material_override = mat
		var col := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3(w, h, d)
		col.shape = shape
		body.position = Vector3(x, h / 2.0, z)
		body.add_child(inst)
		body.add_child(col)
		add_child(body)
