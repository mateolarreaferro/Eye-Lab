## Autoload singleton. Simple push-out collision so the player actually
## can't walk through the maze's buildings/walls. The template's locomotion
## script (xr_move.gd) moves the XROrigin3D's position directly with no
## physics query, so without this, the maze would be walk-through and not
## a real maze -- this is what makes the maze topology actually matter.
extends Node3D

@export var radius := 0.35
@export var height := 1.7
@export var max_push_per_frame := 0.3  ## meters; clamps any single-frame correction

var _origin: XROrigin3D
var _shape := CapsuleShape3D.new()


func _ready() -> void:
	_shape.radius = radius
	_shape.height = height
	call_deferred("_find_origin")


func _find_origin() -> void:
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		call_deferred("_find_origin")
		return
	_origin = camera.get_parent() as XROrigin3D


func _physics_process(_delta: float) -> void:
	if _origin == null:
		return

	var space := get_world_3d().direct_space_state
	var params := PhysicsShapeQueryParameters3D.new()
	params.shape = _shape
	params.transform = Transform3D(Basis.IDENTITY, _origin.global_position + Vector3(0, height / 2.0, 0))
	params.collide_with_bodies = true
	params.collide_with_areas = false

	var contacts := space.collide_shape(params, 8)
	if contacts.is_empty():
		return

	var push := Vector3.ZERO
	var i := 0
	while i + 1 < contacts.size():
		var point_on_player: Vector3 = contacts[i]
		var point_on_obstacle: Vector3 = contacts[i + 1]
		push += point_on_player - point_on_obstacle
		i += 2

	push.y = 0.0
	if push.length() > 0.001:
		_origin.global_position += push.limit_length(max_push_per_frame)
