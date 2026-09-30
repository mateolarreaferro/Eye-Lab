## Autoload singleton. The city's audio world, rendered by SATIE's portable
## core (addons/satie). audio/scene.satie declares the sounds; this script
## only reports what is happening in the game: where the listener's head is,
## where fixed emitters sit, and when footsteps, birds or bells occur. SATIE
## picks takes, varies them, spatialises and mixes.
##
## The beacon is deliberately silent. Finding it by sight, through the
## filter, is the eye exercise; a sound on it would let players find it by ear.
## Only arriving is marked, with a non-spatial chime.
##
## If the SATIE native library isn't built for this platform (e.g. a Quest
## build before the Android library exists), the game runs silent instead of
## failing: nothing here references SATIE's classes until they are confirmed.
extends Node3D

const BUNDLE := "res://audio/city.satp"
const MANIFEST := "res://audio/city.manifest.json"
const STRIDE := 0.7            ## metres walked per footstep
const TELEPORT := 3.0          ## a jump longer than this in one frame is a respawn, not a step
const BELL_EVERY := 90.0       ## seconds between the landmark's chimes

var audio: Node                # SatieWorld, typed loosely so this parses without the extension
var _camera: Node3D
var _last_feet := Vector3.INF
var _walked := 0.0
var _crowd_last: Array = []
var _crowd_walked: Array = []
var _canal: Array = []         # canal emitter positions, for nearby gulls
var _bell_at := Vector3.INF
var _timers := {}


func _ready() -> void:
	if not ClassDB.class_exists("SatieAudioStream"):
		push_warning("CityAudio|WARN: SATIE native library not available on this platform; running silent")
		return
	call_deferred("_start")


func _start() -> void:
	_camera = get_viewport().get_camera_3d()
	if _camera == null or VisionQuestGame._origin == null:
		call_deferred("_start")
		return

	audio = (load("res://addons/satie/satie_world.gd") as GDScript).new()
	add_child(audio)
	if not audio.load_scene(BUNDLE, MANIFEST):
		push_error("CityAudio|ERROR: could not load %s (bundle/manifest mismatch?)" % BUNDLE)
		return
	_place_emitters()
	audio.listener = _camera
	audio.player.volume_db = 6.0  # the scene mixes quietly (~-35 dBFS); peaks stay below 0.9
	if not audio.start():
		push_error("CityAudio|ERROR: SATIE playback did not start")
		return

	VisionQuestGame.round_started.connect(_on_round_started)
	VisionQuestGame.target_reached.connect(_on_target_reached)
	for key in ["bird", "pigeon", "gull", "dog"]:
		_timers[key] = randf_range(1.0, 6.0)
	_timers["bell"] = 20.0
	print("CityAudio|INFO: SATIE audio world running (%d sources)" % audio.sources.size())


## Fixed emitters come from the generator's audio_anchors (Blender x, y, height).
func _place_emitters() -> void:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://environment/city_maze.json"))
	var anchors: Dictionary = data.get("audio_anchors", {})
	for kind in ["canal", "fountains", "terraces"]:
		var points: Array = anchors.get(kind, [])
		for i in points.size():
			var pos := _godot(points[i])
			var id := "%s_%d" % [kind.trim_suffix("s"), i]
			if not audio.sources.has(id):
				push_warning("CityAudio|WARN: no SATIE source for anchor %s" % id)
				continue
			var marker := Node3D.new()
			marker.name = "Audio_" + id
			add_child(marker)
			marker.global_position = pos
			audio.bind_host(id, marker)
			if kind == "canal":
				_canal.append(pos)
	var bells: Array = anchors.get("clocktowers", [])
	if bells.is_empty():
		bells = anchors.get("landmark", [])
	if not bells.is_empty():
		_bell_at = _godot(bells[0])


func _godot(p: Array) -> Vector3:
	# Same Blender (Z-up) to Godot (Y-up) mapping as vision_quest_game.gd.
	return Vector3(p[0], p[2], -p[1])


func _physics_process(delta: float) -> void:
	if audio == null or audio.playback == null:
		return
	_player_steps()
	_crowd_steps()
	for key in _timers.keys():
		_timers[key] -= delta
		if _timers[key] <= 0.0:
			_timers[key] = _occur(key)


func _feet() -> Vector3:
	var head := _camera.global_position
	return Vector3(head.x, VisionQuestGame._origin.global_position.y, head.z)


func _player_steps() -> void:
	var feet := _feet()
	if _last_feet != Vector3.INF:
		var moved := feet.distance_to(_last_feet)
		if moved > TELEPORT:
			_walked = 0.0
		else:
			_walked += moved
			if _walked >= STRIDE:
				_walked -= STRIDE
				audio.contact("step", feet)
	_last_feet = feet


func _crowd_steps() -> void:
	var people: Array = CityLife._pedestrians
	if _crowd_last.size() != people.size():
		_crowd_last.resize(people.size())
		_crowd_walked.resize(people.size())
		_crowd_walked.fill(0.0)
	for i in people.size():
		var p: Vector3 = (people[i] as Node3D).global_position
		var feet := Vector3(p.x, 0.0, p.z)
		if _crowd_last[i] != null:
			_crowd_walked[i] += feet.distance_to(_crowd_last[i])
			if _crowd_walked[i] >= STRIDE * 0.9:
				_crowd_walked[i] = 0.0
				if feet.distance_to(_feet()) < 25.0:  # beyond this 1/r leaves nothing audible
					audio.contact("crowd_step", feet)
		_crowd_last[i] = feet


## One occurrence of an intermittent sound; returns seconds until the next one.
func _occur(key: String) -> float:
	var here := _feet()
	match key:
		"bird":  # songbirds on nearby rooftops
			audio.contact("bird", here + _around(6.0, 18.0) + Vector3(0, randf_range(7.0, 11.0), 0))
			return randf_range(2.5, 8.0)
		"pigeon":  # pigeons on the street a few metres away
			audio.contact("pigeon", here + _around(3.0, 10.0) + Vector3(0, 0.3, 0))
			return randf_range(9.0, 22.0)
		"gull":  # gulls only near the canal
			var near := _nearest(_canal, here)
			if near != Vector3.INF and near.distance_to(here) < 45.0:
				audio.contact("gull", Vector3(here.x + randf_range(-10, 10), 7.0, near.z))
			return randf_range(10.0, 25.0)
		"dog":  # one of the town's pets, if one is close
			var pets: Array = CityLife._pets.map(func(p): return (p as Node3D).global_position)
			var pet := _nearest(pets, here)
			if pet != Vector3.INF and pet.distance_to(here) < 22.0:
				audio.contact("dog", pet)
			return randf_range(35.0, 70.0)
		"bell":  # the landmark chimes on a slow clock
			if _bell_at != Vector3.INF:
				for strike in 3:
					get_tree().create_timer(strike * 2.6).timeout.connect(func():
						audio.contact("bell", _bell_at)
					)
			return BELL_EVERY
	return 10.0


func _around(near: float, far: float) -> Vector3:
	var angle := randf() * TAU
	return Vector3(cos(angle), 0, sin(angle)) * randf_range(near, far)


func _nearest(points: Array, to: Vector3) -> Vector3:
	var best := Vector3.INF
	for p in points:
		if best == Vector3.INF or (p as Vector3).distance_to(to) < best.distance_to(to):
			best = p
	return best


func _on_round_started(_spawn: Vector3, _target: Vector3) -> void:
	_last_feet = Vector3.INF  # the respawn jump is not a footstep
	_walked = 0.0


func _on_target_reached(_target: Vector3) -> void:
	audio.contact("arrive", Vector3.ZERO)
