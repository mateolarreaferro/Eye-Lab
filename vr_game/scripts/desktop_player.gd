## Desktop test mode: play the VR scene with mouse + keyboard, no headset.
## Loads main.tscn unchanged and drives its XROrigin3D/XRCamera3D directly,
## so VisionQuestGame, PlayerWallCollision, CityLife and DichopticFilter all
## run exactly as they do in VR. Launch with ./play_desktop.sh (which passes
## --xr-mode off so OpenXR doesn't stop on its "no headset" dialog).
##
## A flat window is a single view (VIEW_INDEX 0), so the filter can't be
## shown to one eye only here: it's either on for the whole view or off.
extends Node3D

const MAIN_SCENE := preload("res://main.tscn")
const EYE_HEIGHT := 1.6

@export var walk_speed := 2.0  ## m/s, same as the template's xr_move.gd
@export var run_speed := 5.0
@export var mouse_sensitivity := 0.0025

var _origin: XROrigin3D
var _camera: XRCamera3D
var _pitch := 0.0
var _show_distance := false
var _hud: Label


func _ready() -> void:
	add_child(MAIN_SCENE.instantiate())
	_origin = $Main/XROrigin3D
	_camera = $Main/XROrigin3D/XRCamera3D
	_camera.position = Vector3(0, EYE_HEIGHT, 0)
	_camera.current = true
	_build_hud()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_origin.rotate_y(-event.relative.x * mouse_sensitivity)
		_pitch = clamp(_pitch - event.relative.y * mouse_sensitivity, -1.4, 1.4)
		_camera.rotation = Vector3(_pitch, 0, 0)
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_ESCAPE:
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			KEY_F:
				_toggle_filter()
			KEY_BRACKETLEFT:
				_change_strength(-0.5)
			KEY_BRACKETRIGHT:
				_change_strength(0.5)
			KEY_N:
				VisionQuestGame._new_round()
			KEY_G:
				_show_distance = not _show_distance
			KEY_H:
				_hud.visible = not _hud.visible


func _process(delta: float) -> void:
	var input := Vector2(
		Input.get_axis("ui_left", "ui_right") + float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)),
		Input.get_axis("ui_up", "ui_down") + float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W))
	).limit_length(1.0)
	var speed := run_speed if Input.is_key_pressed(KEY_SHIFT) else walk_speed
	var move := _origin.global_basis * Vector3(input.x, 0, input.y)
	move.y = 0.0
	_origin.global_position += move * speed * delta
	_update_hud()


func _toggle_filter() -> void:
	var quad: MeshInstance3D = DichopticFilter._quad
	if quad:
		quad.visible = not quad.visible


func _change_strength(step: float) -> void:
	var lod: float = clamp(DichopticFilter.lod + step, 1.0, 5.0)
	DichopticFilter.set_strength(lod, DichopticFilter.gain)


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	_hud = Label.new()
	_hud.position = Vector2(16, 12)
	_hud.add_theme_color_override("font_color", Color.WHITE)
	_hud.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	_hud.add_theme_constant_override("outline_size", 6)
	layer.add_child(_hud)


func _update_hud() -> void:
	if not _hud.visible:
		return
	var quad: MeshInstance3D = DichopticFilter._quad
	var filter_on := quad != null and quad.visible
	var text := "WASD / arrows move · Shift run · mouse look · Esc release mouse\n"
	text += "F filter: %s · [ ] strength: lod %.1f · N new round · G distance · H hide\n" % [
		"on" if filter_on else "off", DichopticFilter.lod]
	if _show_distance:
		var here := _origin.global_position
		var target: Vector3 = VisionQuestGame._target_position
		here.y = 0.0
		target.y = 0.0
		text += "beacon: %.1f m" % here.distance_to(target)
	_hud.text = text
