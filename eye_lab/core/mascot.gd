extends Control
## "Iris", the Eye Lab mascot, drawn flat: a round eye in a soft sunny ring.
## The iris follows the mouse; now and then Iris closes into a happy smile-eye.
## Clicking makes Iris hop and smile.

const INK := Color("1d1d1f")

signal clicked

var _look := Vector2.ZERO
var _happy := 0.0          # 0 = eye open, 1 = happy closed eye
var _next_happy := 3.0
var _hold := 0.0
var _hop := 0.0
var _t := 0.0


func _ready() -> void:
	if custom_minimum_size == Vector2.ZERO:
		custom_minimum_size = Vector2(124, 124)
	mouse_filter = MOUSE_FILTER_STOP
	mouse_default_cursor_shape = CURSOR_POINTING_HAND
	tooltip_text = "Hi, I'm Iris! Click me to chat."


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		_hop = 1.0
		_next_happy = 0.0
		_hold = 0.9
		clicked.emit()


func _process(delta: float) -> void:
	_t += delta
	var c := size / 2.0
	var target := (get_local_mouse_position() - c).limit_length(minf(size.x, size.y) * 0.1)
	_look = _look.lerp(target, minf(1.0, delta * 8.0))
	_next_happy -= delta
	if _next_happy <= 0.0:
		_happy = minf(1.0, _happy + delta * 8.0)
		if _happy >= 1.0:
			_hold -= delta
			if _hold <= 0.0:
				_next_happy = randf_range(3.0, 7.0)
				_hold = randf_range(0.15, 0.6)
	else:
		_happy = maxf(0.0, _happy - delta * 8.0)
	_hop = maxf(0.0, _hop - delta * 2.2)
	queue_redraw()


func _draw() -> void:
	var r := minf(size.x, size.y) * 0.34
	var c := size / 2.0 + Vector2(0, sin(_t * 1.4) * 2.5 - sin(_hop * PI) * 12.0)
	draw_circle(c, r * 1.3, Color("dfe6ff"))       # soft halo ring
	draw_circle(c, r, Color.WHITE)
	if _happy < 0.5:
		var ic := c + _look
		var ir := r * 0.52
		draw_circle(ic, ir, Color("3aa0ff"))
		draw_circle(ic, ir * 0.48, INK)
		draw_circle(ic + Vector2(-ir * 0.32, -ir * 0.34), ir * 0.2, Color.WHITE)
	else:
		# Happy closed eye: a thick smiling arc.
		draw_arc(c + Vector2(0, -r * 0.18), r * 0.48, PI * 0.15, PI * 0.85, 24, INK, r * 0.14, true)
	# Rosy cheeks.
	draw_circle(c + Vector2(-r * 0.62, r * 0.55), r * 0.13, Color(1.0, 0.55, 0.6, 0.35))
	draw_circle(c + Vector2(r * 0.62, r * 0.55), r * 0.13, Color(1.0, 0.55, 0.6, 0.35))
