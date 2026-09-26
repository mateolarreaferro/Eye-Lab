class_name GlassPanel
extends PanelContainer
## PanelContainer with a frosted-glass background (shaders/glass.gdshader) and a soft
## shadow. Set radius / tint / padding before adding it to the tree.

var radius := 20.0
var tint := Color(1, 1, 1, 0.7)
var padding := 16
var shadow := false   # a stylebox shadow gets blurred into the glass and looks muddy

var _bg: ColorRect
var _mat: ShaderMaterial


func _ready() -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0, 0, 0, 0)
	sb.set_corner_radius_all(int(radius))
	sb.set_content_margin_all(padding)
	if shadow:
		sb.shadow_color = Color(0.1, 0.1, 0.25, 0.10)
		sb.shadow_size = 18
		sb.shadow_offset = Vector2(0, 6)
	add_theme_stylebox_override("panel", sb)

	_mat = ShaderMaterial.new()
	_mat.shader = preload("res://shaders/glass.gdshader")
	_mat.set_shader_parameter("radius", radius)
	_mat.set_shader_parameter("tint", tint)
	_bg = ColorRect.new()
	_bg.material = _mat
	_bg.mouse_filter = MOUSE_FILTER_IGNORE
	_bg.show_behind_parent = true
	add_child(_bg, false, INTERNAL_MODE_FRONT)
	# The container also lays out internal children (inset by the padding), so
	# restore the background to the full rect after every layout pass.
	resized.connect(_sync)
	sort_children.connect(_sync)
	_sync()


func set_tint(c: Color) -> void:
	tint = c
	if _mat:
		_mat.set_shader_parameter("tint", c)


func _sync() -> void:
	_bg.position = Vector2.ZERO
	_bg.size = size
	_mat.set_shader_parameter("rect_size", size)
