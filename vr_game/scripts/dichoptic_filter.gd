## Autoload singleton. Attaches the frequency-patching filter
## (shaders/dichoptic_filter.gdshader) to the camera as soon as the XR camera
## is live. No scene edits needed: this finds the active XRCamera3D at
## runtime and parents a small overlay quad to it.
##
## Two therapeutic modes, since amblyopia isn't always unilateral:
## - Left/Right: DICHOPTIC mode, for the common case where one eye is
##   measurably weaker. Set this to the child's DOMINANT (non-amblyopic) eye
##   -- filtering it forces the brain to stop suppressing the weak eye and
##   recruit it instead. Requires an asymmetry between the eyes to work.
## - Both: BINOCULAR mode, for bilateral amblyopia where neither eye
##   dominates. There's no eye to rebalance against, so both eyes get the
##   same acuity/contrast training load instead (closer to the desktop
##   Eye Lab app's whole-screen filter, just applied per headset eye).
@export_enum("Left", "Right", "Both") var filtered_eye: int = 0

## Blur scale: 2^lod px. Higher = stronger low-frequency removal = harder task.
@export_range(1.0, 5.0) var lod: float = 3.0

## High-pass gain (contrast boost on the remaining high frequencies).
@export_range(0.5, 3.0) var gain: float = 1.6

const SHADER := preload("res://shaders/dichoptic_filter.gdshader")

var _quad: MeshInstance3D
var _material: ShaderMaterial


func _ready() -> void:
	call_deferred("_attach_to_camera")


func _attach_to_camera() -> void:
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		# XR camera isn't active yet on the first frame; try again next frame.
		call_deferred("_attach_to_camera")
		return

	var quad_mesh := QuadMesh.new()
	quad_mesh.size = Vector2(2.0, 2.0)

	_material = ShaderMaterial.new()
	_material.shader = SHADER
	_material.set_shader_parameter("filtered_eye", filtered_eye)
	_material.set_shader_parameter("lod", lod)
	_material.set_shader_parameter("gain", gain)

	_quad = MeshInstance3D.new()
	_quad.mesh = quad_mesh
	_quad.material_override = _material
	_quad.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_quad.sorting_offset = -100.0  # draw last, on top of everything else

	camera.add_child(_quad)
	_quad.position = Vector3(0, 0, -0.15)  # just past the near clip plane


## Call at runtime (e.g. from a settings menu) to switch mode: 0 = left,
## 1 = right, 2 = both eyes (bilateral mode).
func set_filtered_eye(eye: int) -> void:
	filtered_eye = eye
	if _material:
		_material.set_shader_parameter("filtered_eye", eye)


func set_strength(new_lod: float, new_gain: float) -> void:
	lod = new_lod
	gain = new_gain
	if _material:
		_material.set_shader_parameter("lod", lod)
		_material.set_shader_parameter("gain", gain)
