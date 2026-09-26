extends Control
## Opening splash: Iris pops in on the sunset sky, light rings ripple outward,
## "Eye Lab" and the tagline rise into place, then everything fades into the home
## screen. Click or press any key to skip.

signal done

const INK := Color("2b2233")
const DURATION := 2.6

var _t := 0.0
var _leaving := false
var _bg: Control
var _mascot: Control
var _font: Font
var _font_bold: Font


func _ready() -> void:
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_STOP
	_font = UI.font(400)
	_font_bold = UI.font(700)
	_bg = Control.new()
	_bg.set_script(preload("res://core/mesh_background.gd"))
	_bg.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	add_child(_bg)
	var overlay := Control.new()
	overlay.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	overlay.mouse_filter = MOUSE_FILTER_IGNORE
	overlay.draw.connect(_draw_overlay.bind(overlay))
	add_child(overlay)
	_mascot = Control.new()
	_mascot.set_script(preload("res://core/mascot.gd"))
	_mascot.mouse_filter = MOUSE_FILTER_IGNORE
	_mascot.custom_minimum_size = Vector2(220, 220)
	_mascot.size = Vector2(220, 220)
	_mascot.scale = Vector2.ZERO
	add_child(_mascot)
	_place_mascot()


func _place_mascot() -> void:
	_mascot.pivot_offset = _mascot.size / 2.0
	_mascot.position = size / 2.0 - _mascot.size / 2.0 - Vector2(0, 70)


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and _mascot:
		_place_mascot()


func _gui_input(event: InputEvent) -> void:
	if (event is InputEventMouseButton and event.pressed) or (event is InputEventKey and event.pressed):
		accept_event()
		_leave()


func _process(delta: float) -> void:
	_t += delta
	# Iris pops in with a springy overshoot.
	var pop := clampf((_t - 0.1) / 0.55, 0.0, 1.0)
	_mascot.scale = Vector2.ONE * _back_out(pop)
	for c in get_children():
		if c is CanvasItem:
			c.queue_redraw()
	if _t > DURATION:
		_leave()


func _leave() -> void:
	if _leaving:
		return
	_leaving = true
	var tw := create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tw.set_parallel(true)
	tw.tween_property(self, "modulate:a", 0.0, 0.45)
	tw.tween_property(_mascot, "scale", Vector2.ONE * 1.25, 0.45)
	tw.chain().tween_callback(func():
		done.emit()
		queue_free())


func _draw_overlay(ci: Control) -> void:
	var c := size / 2.0 - Vector2(0, 70)
	# Light rings rippling out from Iris.
	for i in 3:
		var k := fposmod(_t * 0.55 - i * 0.33, 1.0)
		if _t < 0.35 + i * 0.25:
			continue
		var r := 120.0 + k * maxf(size.x, size.y) * 0.45
		ci.draw_arc(c, r, 0, TAU, 128, Color(1, 1, 1, 0.35 * (1.0 - k)), 1.5 + 3.0 * (1.0 - k), true)
	# Title and tagline rise in after the pop.
	var a := clampf((_t - 0.55) / 0.5, 0.0, 1.0)
	var e := _cubic_out(a)
	var ty := c.y + 195 + (1.0 - e) * 30.0
	ci.draw_string(_font_bold, Vector2(0, ty), "Eye Lab", HORIZONTAL_ALIGNMENT_CENTER, size.x, 64, Color(1, 1, 1, e))
	var b := _cubic_out(clampf((_t - 0.85) / 0.5, 0.0, 1.0))
	ci.draw_string(_font, Vector2(0, ty + 52 + (1.0 - b) * 16.0), "See less. Perceive more.", HORIZONTAL_ALIGNMENT_CENTER, size.x, 24, Color(1, 1, 1, 0.85 * b))
	# Sparkles bursting around Iris.
	var s := clampf((_t - 0.35) / 0.9, 0.0, 1.0)
	if sin(s * PI) > 0.08:
		for i in 8:
			var ang := TAU * i / 8.0 + 0.3
			var p := c + Vector2(cos(ang), sin(ang)) * (130.0 + 90.0 * _cubic_out(s))
			var sz := 14.0 * sin(s * PI)
			ci.draw_colored_polygon(preload("res://core/warm_background.gd").sparkle_points(p, sz), Color(1, 1, 1, 0.9))


static func _back_out(x: float) -> float:
	var c1 := 1.70158
	var c3 := c1 + 1.0
	return 1.0 + c3 * pow(x - 1.0, 3) + c1 * pow(x - 1.0, 2)


static func _cubic_out(x: float) -> float:
	return 1.0 - pow(1.0 - x, 3)
