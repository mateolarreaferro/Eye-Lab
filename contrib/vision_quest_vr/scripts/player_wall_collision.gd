## Autoload singleton. Makes the maze's buildings/walls solid. The template's
## locomotion (xr_move.gd) and the desktop player move the XROrigin3D's
## position directly with no physics query, so this runs after them every
## frame and replays that frame's movement through a CharacterBody3D with
## move_and_slide(): walls stop you and you glide along them, instead of
## being shoved back out after walking in.
##
## The capsule starts `step_clearance` above the ground so the floor, curbs
## and cobbles never register as walls. Jumps longer than `teleport_distance`
## (a new round's respawn) are taken as-is, not collided.
extends Node3D

@export var radius := 0.3
@export var height := 1.4
@export var step_clearance := 0.35       ## metres of ground clutter the body ignores
@export var teleport_distance := 3.0     ## metres; longer single-frame moves are respawns

var _origin: XROrigin3D
var _body := CharacterBody3D.new()
var _resolved := Vector3.INF             ## where collision last left the origin


func _ready() -> void:
	process_priority = 1000  # after every locomotion script's _process
	var shape := CapsuleShape3D.new()
	shape.radius = radius
	shape.height = height
	var collider := CollisionShape3D.new()
	collider.shape = shape
	collider.position.y = step_clearance + height / 2.0
	_body.add_child(collider)
	_body.motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	_body.wall_min_slide_angle = 0.0
	_body.top_level = true
	add_child(_body)
	call_deferred("_find_origin")


func _find_origin() -> void:
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		call_deferred("_find_origin")
		return
	_origin = camera.get_parent() as XROrigin3D


func _process(delta: float) -> void:
	if _origin == null:
		return
	var wanted := _origin.global_position
	if _resolved == Vector3.INF or wanted.distance_to(_resolved) > teleport_distance:
		_resolved = wanted
		return

	var motion := wanted - _resolved
	motion.y = 0.0
	if motion.length_squared() < 1e-10:
		return
	_body.global_position = Vector3(_resolved.x, wanted.y, _resolved.z)
	# Called from _process, move_and_slide() scales velocity by this frame's
	# delta, so this velocity covers exactly this frame's movement.
	_body.velocity = motion / delta
	_body.move_and_slide()
	_body.velocity = Vector3.ZERO
	_resolved = Vector3(_body.global_position.x, wanted.y, _body.global_position.z)
	_origin.global_position = _resolved
