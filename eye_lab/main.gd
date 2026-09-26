extends Control
## Eye Lab home: a calm, Apple-style dashboard. Games are grouped into sections of
## frosted-glass cards over a slowly shifting gradient; Iris (the Claude-powered
## guide) lives in the floating button at the bottom right.

const INK := UI.LABEL
const INK_MUTED := UI.LABEL_2

const SECTIONS := [
	{"name": "Eye check-up", "tag": "Measure how you see", "icon": "eye", "color": UI.SYS_BLUE},
	{"name": "Spot the odd one", "tag": "Train fine detail", "icon": "search", "color": UI.SYS_GREEN},
	{"name": "Brain games", "tag": "Attention and space", "icon": "sun", "color": UI.SYS_PURPLE},
	{"name": "Magic glasses", "tag": "See less, perceive more", "icon": "kaleido", "color": UI.ACCENT},
]

const EXERCISES := [
	{"key": "acuity", "tag": "Smallest letter", "section": 0, "name": "Letter E", "desc": "Acuity test: which way does the E point?", "icon": "letter_e", "script": "res://exercises/acuity_test.gd"},
	{"key": "contrast", "tag": "Faintest pattern", "section": 0, "name": "Faint stripes", "desc": "Contrast sensitivity: how faint can you see?", "icon": "contrast", "script": "res://exercises/cs_test.gd"},
	{"key": "field_map", "tag": "Your field of view", "section": 0, "name": "Dot hunt", "desc": "Visual field map: spot dots around the edges", "icon": "target", "script": "res://exercises/field_map.gd"},
	{"key": "odd_color", "tag": "Hue difference", "section": 1, "name": "Colors", "desc": "Which disk has a different color?", "icon": "palette", "script": "res://exercises/odd_one_out.gd", "config": {"mode": "color"}},
	{"key": "odd_acuity", "tag": "Letter direction", "section": 1, "name": "Letters", "desc": "Which E points another way?", "icon": "letter_e", "script": "res://exercises/odd_one_out.gd", "config": {"mode": "acuity"}},
	{"key": "odd_orientation", "tag": "Tilt difference", "section": 1, "name": "Stripes", "desc": "Which stripes are tilted?", "icon": "stripes", "script": "res://exercises/odd_one_out.gd", "config": {"mode": "orientation"}},
	{"key": "odd_depth", "tag": "Red/cyan glasses", "section": 1, "name": "3D", "desc": "Needs red/cyan 3D glasses", "icon": "glasses", "script": "res://exercises/odd_one_out.gd", "config": {"mode": "depth"}},
	{"key": "spot_count", "tag": "Quick flashes", "section": 2, "name": "Count lights", "desc": "How many lights flashed?", "icon": "sun", "script": "res://exercises/spot_count.gd"},
	{"key": "location", "tag": "Spatial memory", "section": 2, "name": "Did it move?", "desc": "Same place, or did the light move?", "icon": "pin", "script": "res://exercises/location.gd"},
	{"key": "mot", "tag": "Multiple tracking", "section": 2, "name": "Follow dots", "desc": "Keep track of the marked dots", "icon": "dots", "script": "res://exercises/mot.gd"},
	{"key": "search", "tag": "Visual search", "section": 2, "name": "Find it!", "desc": "Find the shape in the crowd", "icon": "search", "script": "res://exercises/search.gd"},
	{"key": "pong", "tag": "Predictive pursuit", "section": 2, "name": "Pong", "desc": "Bounce the ball back", "icon": "pong", "script": "res://exercises/pong.gd"},
	{"key": "patch_room", "tag": "Webcam through a filter", "section": 3, "name": "Magic glasses", "desc": "See the world through a filter (frequency patching)", "icon": "camera", "script": "res://exercises/patch_room.gd"},
	{"key": "whole_screen", "tag": "Filter everything", "section": 3, "name": "Whole screen", "desc": "Put the filter on the whole computer, even movies and other apps. Turn it off here or from the eye icon in the menu bar.", "icon": "monitor", "toggle": true},
]

## Which direction is "better" for each logged metric.
const HIGHER_IS_BETTER := {"contrast": true, "mot": true, "pong": true, "field_map": true}

var _home: Control
var _fab: Control
var _grownups: Control
var _chat: Control
var _chat_open := false
var _profile: Control
var _running: Exercise
var _running_ex: Dictionary
var _last_text := ""

# Grown-ups panel widgets
var _dist_label: Label
var _goal_value: Label
var _calib_chip: Label
var _calib_text: Label
var _metric: OptionButton
var _chart: Control
var _last_label: Label
var _metric_ids: Array = []


func _ready() -> void:
	Iris.action.connect(_on_iris_action)
	_build()
	if not OS.get_cmdline_user_args().has("--nosplash") and not _is_cli_shot():
		_show_splash()
	Filter.system_changed.connect(func(_on):
		if _running == null:
			_rebuild())
	_handle_cli.call_deferred()


func _is_cli_shot() -> bool:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			return not OS.get_cmdline_user_args().has("--splash")
	return false


func _show_splash() -> void:
	var splash := Control.new()
	splash.set_script(preload("res://core/splash.gd"))
	Filter.set_toolbar_visible(false)
	splash.done.connect(func(): Filter.set_toolbar_visible(true))
	add_child(splash)


func _rebuild() -> void:
	for c in get_children():
		if c != _running:
			c.queue_free()
	_grownups = null
	_chat = null
	_profile = null
	_build()
	if _chat_open and _running == null:
		_open_chat()


func _build() -> void:
	var bg := Control.new()
	bg.set_script(preload("res://core/mesh_background.gd"))
	bg.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	add_child(bg)

	_home = MarginContainer.new()
	_home.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	_home.add_theme_constant_override("margin_left", 56)
	_home.add_theme_constant_override("margin_right", 56)
	_home.add_theme_constant_override("margin_top", 84)    # room for the filter bar
	_home.add_theme_constant_override("margin_bottom", 24)
	add_child(_home)

	var page := VBoxContainer.new()
	page.add_theme_constant_override("separation", 26)
	_home.add_child(page)
	page.add_child(_header())

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	page.add_child(scroll)
	var cols := HBoxContainer.new()
	cols.size_flags_horizontal = SIZE_EXPAND_FILL
	cols.add_theme_constant_override("separation", 40)
	scroll.add_child(cols)
	for column in [[0, 3], [1, 2]]:
		var col := VBoxContainer.new()
		col.size_flags_horizontal = SIZE_EXPAND_FILL
		col.size_flags_stretch_ratio = 3.0 if column[0] == 0 else 5.0
		col.add_theme_constant_override("separation", 12)
		cols.add_child(col)
		for si in column:
			_section(col, si)

	_fab = _iris_button()
	add_child(_fab)


func _section(parent: Control, si: int) -> void:
	var sec: Dictionary = SECTIONS[si]
	var col: Color = sec["color"]
	var sh := HBoxContainer.new()
	sh.add_theme_constant_override("separation", 10)
	sh.add_child(UI.label(sec["name"], 20, Color.WHITE, 600))
	var tag := UI.label(sec["tag"], 14, Color(1, 1, 1, 0.8), 400)
	tag.size_flags_vertical = SIZE_SHRINK_END
	tag.custom_minimum_size = Vector2(0, 0)
	sh.add_child(tag)
	parent.add_child(sh)
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 12)
	flow.add_theme_constant_override("v_separation", 12)
	parent.add_child(flow)
	for ex in EXERCISES:
		if ex["section"] == si:
			flow.add_child(_tile(ex, col))
	parent.add_child(UI.label("", 10))


func _header() -> Control:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)

	var tv := VBoxContainer.new()
	tv.add_theme_constant_override("separation", 0)
	tv.alignment = BoxContainer.ALIGNMENT_CENTER
	tv.add_child(UI.label(_date_caption(), 13, Color(1, 1, 1, 0.85), 600))
	var nm := str(Lab.settings["name"]).strip_edges()
	tv.add_child(UI.label(_greeting() + (", " + nm if nm != "" else ""), 34, Color.WHITE, 600))
	h.add_child(tv)

	var spacer := Control.new()
	spacer.size_flags_horizontal = SIZE_EXPAND_FILL
	h.add_child(spacer)

	h.add_child(_stat_chip("trophy", UI.SYS_ORANGE, str(Lab.stars), "Trophies"))
	h.add_child(_stat_chip("flame", UI.SYS_PINK, str(Lab.streak()), "Day streak"))

	# Filter minutes today as an Activity-style ring.
	var goal := float(Lab.settings["daily_filter_goal_min"])
	var done := Lab.filter_minutes_today()
	var ring := Control.new()
	ring.custom_minimum_size = Vector2(30, 30)
	ring.size_flags_vertical = SIZE_SHRINK_CENTER
	var frac := clampf(done / goal, 0.0, 1.0)
	ring.draw.connect(func():
		var c := ring.size / 2.0
		ring.draw_arc(c, 12, 0, TAU, 48, Color(UI.SYS_GREEN, 0.18), 5.0, true)
		if frac > 0.0:
			ring.draw_arc(c, 12, -PI / 2, -PI / 2 + TAU * frac, 48, UI.SYS_GREEN, 5.0, true))
	var mv := VBoxContainer.new()
	mv.add_theme_constant_override("separation", -3)
	mv.alignment = BoxContainer.ALIGNMENT_CENTER
	mv.add_child(UI.label("%d/%d min" % [int(done), int(goal)], 16, INK, 600))
	mv.add_child(UI.label("Filter time", 12, INK_MUTED, 400))
	var mg := HBoxContainer.new()
	mg.add_theme_constant_override("separation", 10)
	mg.add_child(ring)
	mg.add_child(mv)
	var chip := UI.glass_panel(16.0, 10, Color(1, 1, 1, 0.92))
	chip.add_child(mg)
	chip.size_flags_vertical = SIZE_SHRINK_CENTER
	chip.tooltip_text = "Minutes today with a filter on"
	h.add_child(chip)

	var gap := Control.new()
	gap.custom_minimum_size = Vector2(8, 0)
	h.add_child(gap)
	h.add_child(_avatar_button())
	var gear := _circle_button("settings", "Settings: viewing setup, calibration and test history")
	gear.pressed.connect(_open_grownups)
	h.add_child(gear)
	return h


func _stat_chip(icon: String, color: Color, value: String, caption: String) -> Control:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	var ic := TextureRect.new()
	ic.texture = Icons.tex(icon, 22, color)
	ic.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	h.add_child(ic)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", -3)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(UI.label(value, 16, INK, 600))
	v.add_child(UI.label(caption, 12, INK_MUTED, 400))
	h.add_child(v)
	var chip := UI.glass_panel(16.0, 10, Color(1, 1, 1, 0.92))
	chip.add_child(h)
	chip.size_flags_vertical = SIZE_SHRINK_CENTER
	return chip


func _circle_button(icon: String, tip: String) -> Button:
	var b := UI.apple_button("", icon, "gray", UI.SYS_BLUE, 15, 44.0)
	b.icon = Icons.tex(icon, 20, Color.WHITE)
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	for key in ["icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_hover_pressed_color"]:
		b.add_theme_color_override(key, INK)
	for st in ["normal", "hover", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, UI.box(Color(1, 1, 1, 0.92 if st == "normal" else 1.0), 22, 0))
	b.tooltip_text = tip
	b.size_flags_vertical = SIZE_SHRINK_CENTER
	UI.add_press_feel(b)
	return b


func _avatar_button() -> Button:
	var colors: Array = preload("res://core/profile_page.gd").AVATAR_COLORS
	var col: Color = colors[int(Lab.settings.get("avatar_color", 0)) % colors.size()]
	var nm := str(Lab.settings["name"]).strip_edges()
	var b := Button.new()
	b.focus_mode = FOCUS_NONE
	b.mouse_default_cursor_shape = CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(44, 44)
	b.size_flags_vertical = SIZE_SHRINK_CENTER
	b.tooltip_text = "My profile: progress, streak and badges"
	b.text = nm.substr(0, 1).to_upper() if nm != "" else ""
	if nm == "":
		b.icon = Icons.tex("user", 20, Color.WHITE)
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_theme_font_size_override("font_size", 18)
	b.add_theme_font_override("font", UI.font(600))
	for key in ["font_color", "font_hover_color", "font_pressed_color"]:
		b.add_theme_color_override(key, Color.WHITE)
	for st in ["normal", "hover", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, UI.box(col if st == "normal" else col.lightened(0.08), 22, 0))
	b.pressed.connect(_open_profile)
	UI.add_press_feel(b)
	return b


func _date_caption() -> String:
	var d := Time.get_datetime_dict_from_system()
	var days := ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
	var months := ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]
	return "%s, %s %d" % [days[d["weekday"]], months[d["month"] - 1], d["day"]]


func _greeting() -> String:
	var hour: int = Time.get_datetime_dict_from_system()["hour"]
	if hour < 12:
		return "Good morning"
	if hour < 18:
		return "Good afternoon"
	return "Good evening"


## Game card: frosted glass with an icon tile, title and a short tagline.
## Lifts slightly on hover and presses in on click, like iOS.
func _tile(ex: Dictionary, color: Color) -> Button:
	var b := Button.new()
	b.focus_mode = FOCUS_NONE
	b.mouse_default_cursor_shape = CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(162, 132)
	b.tooltip_text = ex["desc"]
	for st in ["normal", "hover", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	var glass := UI.glass_panel(20.0, 16, Color(1, 1, 1, 0.94))
	glass.mouse_filter = MOUSE_FILTER_IGNORE
	glass.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	b.add_child(glass)

	var v := VBoxContainer.new()
	v.mouse_filter = MOUSE_FILTER_IGNORE
	v.add_theme_constant_override("separation", 2)
	glass.add_child(v)
	var top := HBoxContainer.new()
	top.mouse_filter = MOUSE_FILTER_IGNORE
	top.add_child(UI.icon_tile(ex["icon"], color, 38.0))
	var sp := Control.new()
	sp.size_flags_horizontal = SIZE_EXPAND_FILL
	sp.mouse_filter = MOUSE_FILTER_IGNORE
	top.add_child(sp)
	if ex.get("toggle", false):
		top.add_child(_switch(Filter.system_on))
	elif not Lab.results_for(ex["key"]).is_empty():
		var done := TextureRect.new()
		done.texture = Icons.tex("check", 16, UI.LABEL_3)
		done.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
		done.size_flags_vertical = SIZE_SHRINK_BEGIN
		done.mouse_filter = MOUSE_FILTER_IGNORE
		top.add_child(done)
	v.add_child(top)
	var grow := Control.new()
	grow.size_flags_vertical = SIZE_EXPAND_FILL
	grow.mouse_filter = MOUSE_FILTER_IGNORE
	v.add_child(grow)
	var name := UI.label(ex["name"], 16, INK, 600)
	name.mouse_filter = MOUSE_FILTER_IGNORE
	v.add_child(name)
	var tag := UI.label(ex.get("tag", ""), 13, INK_MUTED, 400)
	tag.mouse_filter = MOUSE_FILTER_IGNORE
	v.add_child(tag)

	b.mouse_entered.connect(func(): glass.set_tint(Color(1, 1, 1, 1.0)))
	b.mouse_exited.connect(func(): glass.set_tint(Color(1, 1, 1, 0.94)))
	UI.add_press_feel(b, 1.02)
	if ex.get("toggle", false):
		b.pressed.connect(func(): Filter.set_system(not Filter.system_on))
	else:
		b.pressed.connect(_launch.bind(ex, color))
	return b


## iOS-style switch (display only; the whole card is the tap target).
func _switch(on: bool) -> Control:
	var sw := Control.new()
	sw.custom_minimum_size = Vector2(42, 26)
	sw.size_flags_vertical = SIZE_SHRINK_BEGIN
	sw.mouse_filter = MOUSE_FILTER_IGNORE
	sw.draw.connect(func():
		sw.draw_style_box(UI.box(UI.SYS_GREEN if on else Color(0.47, 0.47, 0.5, 0.25), 13, 0), Rect2(Vector2.ZERO, sw.size))
		var knob_x := sw.size.x - 13.0 if on else 13.0
		sw.draw_circle(Vector2(knob_x, 13) + Vector2(0, 1), 11.5, Color(0, 0, 0, 0.08))
		sw.draw_circle(Vector2(knob_x, 13), 11, Color.WHITE))
	return sw


## Floating "Ask Iris" button, bottom right.
func _iris_button() -> Control:
	var b := Button.new()
	b.focus_mode = FOCUS_NONE
	b.mouse_default_cursor_shape = CURSOR_POINTING_HAND
	b.tooltip_text = "Ask Iris about the games, filters and research"
	for st in ["normal", "hover", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	var glass := UI.glass_panel(28.0, 8, Color(1, 1, 1, 0.95))
	glass.mouse_filter = MOUSE_FILTER_IGNORE
	b.add_child(glass)
	var h := HBoxContainer.new()
	h.mouse_filter = MOUSE_FILTER_IGNORE
	h.add_theme_constant_override("separation", 8)
	var face := Control.new()
	face.set_script(preload("res://core/mascot.gd"))
	face.custom_minimum_size = Vector2(40, 40)
	face.mouse_filter = MOUSE_FILTER_IGNORE
	h.add_child(face)
	var l := UI.label("Ask Iris", 15, INK, 600)
	l.mouse_filter = MOUSE_FILTER_IGNORE
	h.add_child(l)
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(6, 0)
	pad.mouse_filter = MOUSE_FILTER_IGNORE
	h.add_child(pad)
	glass.add_child(h)
	b.custom_minimum_size = Vector2(140, 56)
	glass.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	b.anchor_left = 1.0
	b.anchor_right = 1.0
	b.anchor_top = 1.0
	b.anchor_bottom = 1.0
	b.offset_left = -164
	b.offset_right = -24
	b.offset_top = -80
	b.offset_bottom = -24
	UI.add_press_feel(b, 1.03)
	b.pressed.connect(_toggle_chat)
	return b


# --- Grown-ups panel ------------------------------------------------------------

func _open_grownups() -> void:
	if _grownups:
		return
	var dim := ColorRect.new()
	dim.color = Color(0.06, 0.06, 0.1, 0.32)
	dim.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	add_child(dim)
	_grownups = dim
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	dim.add_child(center)
	var panel := PanelContainer.new()
	var sheet := UI.box(Color(0.97, 0.97, 0.98, 0.98), 24, 24)
	sheet.shadow_color = Color(0, 0, 0, 0.18)
	sheet.shadow_size = 40
	sheet.shadow_offset = Vector2(0, 14)
	panel.add_theme_stylebox_override("panel", sheet)
	center.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 18)
	panel.add_child(col)

	var head := HBoxContainer.new()
	head.add_child(UI.icon_tile("settings", Color("8e8e93"), 44.0))
	var hv := VBoxContainer.new()
	hv.add_child(UI.label("Settings", 22, INK, 700))
	hv.add_child(UI.label("Viewing setup, calibration, sound and test history", 13, INK_MUTED))
	hv.size_flags_horizontal = SIZE_EXPAND_FILL
	head.add_theme_constant_override("separation", 14)
	head.add_child(hv)
	var close := UI.apple_button("Done", "", "tinted", UI.ACCENT, 15, 36.0)
	close.size_flags_vertical = SIZE_SHRINK_CENTER
	close.pressed.connect(_close_grownups)
	head.add_child(close)
	col.add_child(head)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	col.add_child(row)

	var setup := _panel(row, "Setup", "settings", UI.SYS_BLUE)
	setup.get_parent().custom_minimum_size = Vector2(360, 0)
	setup.add_child(UI.label("Distance from eyes to screen", 13, INK_MUTED))
	_dist_label = UI.label("", 17, INK, 600)
	setup.add_child(_stepper(_dist_label,
		func(): _set_setting("distance_cm", clampf(float(Lab.settings["distance_cm"]) - 5, 20, 400)),
		func(): _set_setting("distance_cm", clampf(float(Lab.settings["distance_cm"]) + 5, 20, 400))))
	setup.add_child(UI.label("Eye being tested", 13, INK_MUTED))
	var eyes := HBoxContainer.new()
	eyes.add_theme_constant_override("separation", 6)
	var group := ButtonGroup.new()
	for e in ["Both", "Left", "Right"]:
		var b := UI.apple_button(e, "", "gray", UI.SYS_BLUE, 14, 34.0)
		b.toggle_mode = true
		b.button_group = group
		b.size_flags_horizontal = SIZE_EXPAND_FILL
		b.add_theme_stylebox_override("pressed", UI.box(UI.ACCENT, 17, 8))
		b.add_theme_stylebox_override("hover_pressed", UI.box(UI.ACCENT, 17, 8))
		for key in ["font_pressed_color", "font_hover_pressed_color"]:
			b.add_theme_color_override(key, Color.WHITE)
		b.button_pressed = Lab.settings["eye"] == e
		b.pressed.connect(func(): _set_setting("eye", e))
		eyes.add_child(b)
	setup.add_child(eyes)
	setup.add_child(UI.label("Daily goal with a filter on", 13, INK_MUTED))
	_goal_value = UI.label("", 17, INK, 600)
	setup.add_child(_stepper(_goal_value,
		func(): _set_setting("daily_filter_goal_min", clampf(float(Lab.settings["daily_filter_goal_min"]) - 15, 15, 480)),
		func(): _set_setting("daily_filter_goal_min", clampf(float(Lab.settings["daily_filter_goal_min"]) + 15, 15, 480))))
	var cal_row := HBoxContainer.new()
	cal_row.add_theme_constant_override("separation", 10)
	_calib_chip = UI.label("", 12, Color.BLACK, 700)
	_calib_chip.size_flags_vertical = SIZE_SHRINK_CENTER
	cal_row.add_child(_calib_chip)
	_calib_text = UI.label("", 12, INK_MUTED, 400, true)
	_calib_text.size_flags_horizontal = SIZE_EXPAND_FILL
	cal_row.add_child(_calib_text)
	setup.add_child(cal_row)
	var calib := UI.apple_button("Calibrate with a card", "card", "tinted", UI.ACCENT, 15, 38.0)
	calib.pressed.connect(func():
		_close_grownups()
		_launch({"key": "calibrate", "script": "res://exercises/calibrate.gd", "icon": "card"}, UI.BLUE))
	setup.add_child(calib)
	var snd_row := HBoxContainer.new()
	var snd_label := UI.label("Interface sounds", 15, INK, 400)
	snd_label.size_flags_horizontal = SIZE_EXPAND_FILL
	snd_row.add_child(snd_label)
	var snd := Button.new()
	snd.toggle_mode = true
	snd.button_pressed = Sfx.enabled
	snd.focus_mode = FOCUS_NONE
	snd.mouse_default_cursor_shape = CURSOR_POINTING_HAND
	snd.custom_minimum_size = Vector2(50, 30)
	for st in ["normal", "hover", "pressed", "hover_pressed", "focus"]:
		snd.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	snd.draw.connect(func():
		var on := snd.button_pressed
		snd.draw_style_box(UI.box(UI.ACCENT if on else Color(0.47, 0.47, 0.5, 0.25), 15, 0), Rect2(Vector2.ZERO, snd.size))
		var kx := snd.size.x - 15.0 if on else 15.0
		snd.draw_circle(Vector2(kx, 15.5), 13.5, Color(0, 0, 0, 0.08))
		snd.draw_circle(Vector2(kx, 15), 13, Color.WHITE))
	snd.toggled.connect(func(on):
		Sfx.set_enabled(on)
		snd.queue_redraw())
	snd_row.add_child(snd)
	setup.add_child(snd_row)


	var prog := _panel(row, "Test history", "chart", UI.SYS_INDIGO)
	prog.get_parent().custom_minimum_size = Vector2(440, 0)
	_metric = OptionButton.new()
	_metric.focus_mode = FOCUS_NONE
	for st in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		var ob := UI.box(Color(0.47, 0.47, 0.5, 0.12 if st != "hover" else 0.2), 10, 8)
		ob.content_margin_left = 12
		_metric.add_theme_stylebox_override(st, ob)
	for key in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		_metric.add_theme_color_override(key, INK)
	_metric.add_theme_color_override("font_disabled_color", INK_MUTED)
	_metric.add_theme_font_size_override("font_size", 14)
	_metric.item_selected.connect(func(_i): _chart.queue_redraw())
	prog.add_child(_metric)
	_chart = Control.new()
	_chart.custom_minimum_size = Vector2(0, 230)
	_chart.draw.connect(_draw_chart)
	prog.add_child(_chart)
	_last_label = UI.label(_last_text, 13, INK_MUTED, 400, true)
	prog.add_child(_last_label)
	_refresh_grownups()


func _close_grownups() -> void:
	if _grownups:
		_grownups.queue_free()
		_grownups = null


func _panel(parent: Control, heading: String, icon: String, color: Color) -> VBoxContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", UI.box(Color.WHITE, 16, 18))
	parent.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	p.add_child(v)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	var ic := TextureRect.new()
	ic.texture = Icons.tex(icon, 20, color)
	ic.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	h.add_child(ic)
	h.add_child(UI.label(heading, 16, INK, 600))
	v.add_child(h)
	return v


func _stepper(value_label: Label, minus: Callable, plus: Callable) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	var m := UI.apple_button("", "minus", "gray", UI.SYS_BLUE, 14, 36.0)
	m.icon = Icons.tex("minus", 16, Color.WHITE)
	m.add_theme_color_override("icon_normal_color", INK)
	m.add_theme_color_override("icon_hover_color", INK)
	m.pressed.connect(minus)
	h.add_child(m)
	value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	value_label.size_flags_horizontal = SIZE_EXPAND_FILL
	h.add_child(value_label)
	var p := UI.apple_button("", "plus", "gray", UI.SYS_BLUE, 14, 36.0)
	p.icon = Icons.tex("plus", 16, Color.WHITE)
	p.add_theme_color_override("icon_normal_color", INK)
	p.add_theme_color_override("icon_hover_color", INK)
	p.pressed.connect(plus)
	h.add_child(p)
	return h


func _set_setting(key: String, value: Variant) -> void:
	Lab.settings[key] = value
	Lab.save_data()
	_refresh_grownups()


func _refresh_grownups() -> void:
	if _grownups == null:
		return
	_dist_label.text = "%d cm" % int(Lab.settings["distance_cm"])
	_goal_value.text = "%d min" % int(Lab.settings["daily_filter_goal_min"])
	if Lab.is_calibrated():
		_calib_chip.text = " CALIBRATED "
		_calib_chip.add_theme_stylebox_override("normal", UI.box(UI.GREEN, 6, 3))
		_calib_text.text = "1° of vision = %.0f px at %d cm" % [Lab.px_per_deg(), int(Lab.settings["distance_cm"])]
	else:
		_calib_chip.text = " NOT CALIBRATED "
		_calib_chip.add_theme_stylebox_override("normal", UI.box(UI.ORANGE, 6, 3))
		_calib_text.text = "Sizes are estimated. Calibrate for accurate tests."

	var prev: String = _metric_ids[_metric.selected] if _metric.selected >= 0 and _metric.selected < _metric_ids.size() else ""
	_metric.clear()
	_metric_ids.clear()
	for r in Lab.results:
		if r["id"] not in _metric_ids:
			_metric_ids.append(r["id"])
			_metric.add_item("%s (%s)" % [r["title"], r["unit"]])
	if _metric_ids.is_empty():
		_metric.add_item("No results yet")
		_metric.disabled = true
	else:
		_metric.disabled = false
		_metric.selected = maxi(0, _metric_ids.find(prev))
	_chart.queue_redraw()


func _draw_chart() -> void:
	var r := Rect2(Vector2.ZERO, _chart.size)
	_chart.draw_style_box(UI.box(Color(0.47, 0.47, 0.5, 0.08), 12, 0), r)
	var font := ThemeDB.fallback_font
	if _metric_ids.is_empty():
		_chart.draw_string(font, Vector2(16, r.size.y / 2.0), "Finish a test and results will appear here.", HORIZONTAL_ALIGNMENT_CENTER, r.size.x - 32, 13, INK_MUTED)
		return
	var mid: String = _metric_ids[clampi(_metric.selected, 0, _metric_ids.size() - 1)]
	var rows := Lab.results_for(mid)
	rows = rows.slice(maxi(0, rows.size() - 30))
	var vals: Array = rows.map(func(x): return float(x["value"]))
	var lo: float = vals.min()
	var hi: float = vals.max()
	if hi - lo < 1e-6:
		lo -= 1.0
		hi += 1.0
	var pad := Vector2(44, 26)
	var plot := Rect2(r.position + pad, r.size - pad * 2)
	var pts := PackedVector2Array()
	for i in vals.size():
		var x := plot.position.x + (plot.size.x * i / maxf(1.0, vals.size() - 1.0) if vals.size() > 1 else plot.size.x / 2.0)
		var y: float = plot.end.y - (vals[i] - lo) / (hi - lo) * plot.size.y
		pts.append(Vector2(x, y))
	for g in 3:
		var gy := plot.position.y + plot.size.y * g / 2.0
		_chart.draw_line(Vector2(plot.position.x, gy), Vector2(plot.end.x, gy), Color(0, 0, 0, 0.06))
	if pts.size() > 1:
		_chart.draw_polyline(pts, UI.SYS_INDIGO, 2.5, true)
	for p in pts:
		_chart.draw_circle(p, 4.5, Color.WHITE)
		_chart.draw_circle(p, 3.5, UI.SYS_INDIGO)
	_chart.draw_string(font, Vector2(8, plot.position.y + 4), "%.2f" % hi, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, INK_MUTED)
	_chart.draw_string(font, Vector2(8, plot.end.y + 4), "%.2f" % lo, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, INK_MUTED)
	var better := "higher is better" if HIGHER_IS_BETTER.get(mid, false) else "lower is better"
	_chart.draw_string(font, Vector2(plot.position.x, r.end.y - 8), "%d sessions  ·  %s" % [vals.size(), better], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, INK_MUTED)


# --- Iris chat, profile ------------------------------------------------------------

func _toggle_chat() -> void:
	if _chat:
		_close_chat()
	else:
		_open_chat()


func _open_chat() -> void:
	if _chat:
		return
	_chat_open = true
	_chat = Control.new()
	_chat.set_script(preload("res://core/chat_panel.gd"))
	_chat.closed.connect(_close_chat)
	add_child(_chat)


func _close_chat() -> void:
	_chat_open = false
	if _chat:
		_chat.queue_free()
		_chat = null


func _open_profile() -> void:
	_close_grownups()
	if _profile:
		return
	_profile = Control.new()
	_profile.set_script(preload("res://core/profile_page.gd"))
	_profile.back.connect(_close_profile)
	_profile.play.connect(func(key):
		for ex in EXERCISES:
			if ex["key"] == key:
				_launch(ex, SECTIONS[ex["section"]]["color"]))
	add_child(_profile)
	_home.hide()
	move_child(_fab, -1)
	if _chat:
		move_child(_chat, -1)


func _close_profile() -> void:
	if _profile:
		_profile.queue_free()
		_profile = null
	_rebuild()


## Iris (Claude) asked the app to do something.
func _on_iris_action(kind: String, data: Dictionary) -> void:
	if _running:
		return
	match kind:
		"open_game":
			for ex in EXERCISES:
				if ex["key"] == data.get("game", ""):
					_chat_open = false
					_launch(ex, SECTIONS[ex["section"]]["color"])
		"open_page":
			match str(data.get("page", "home")):
				"profile":
					_open_profile()
				"settings":
					if _profile:
						_close_profile()
					_open_grownups()
					if _chat:
						move_child(_chat, -1)
				_:
					if _profile:
						_close_profile()
					_close_grownups()


# --- Running exercises ------------------------------------------------------------

func _launch(ex: Dictionary, color: Color) -> Exercise:
	var e: Exercise = load(ex["script"]).new()
	e.config = ex.get("config", {})
	e.icon = ex.get("icon", "eye")
	e.accent = color
	e.finished.connect(_on_finished)
	_home.hide()
	_fab.hide()
	if _chat:
		_chat.queue_free()
		_chat = null
	if _profile:
		_profile.queue_free()
		_profile = null
	add_child(e)
	_running = e
	_running_ex = {"ex": ex, "color": color}
	return e


func _on_finished(summary: Dictionary) -> void:
	if summary.get("started", false) and summary.get("id", "") != "calibrate":
		Lab.record_session(summary["id"], summary["title"], int(summary.get("trophies", 0)))
	if summary.has("value"):
		Lab.log_result(summary["id"], summary["title"], summary["value"], summary.get("unit", ""), summary.get("detail", {}))
		_last_text = "Last session: %s, %.2f %s" % [summary["title"], summary["value"], summary.get("unit", "")]
	if _running:
		_running.queue_free()
		_running = null
	if summary.get("again", false):
		_launch(_running_ex["ex"], _running_ex["color"])
		return
	# Rebuild so the star counter, stickers and minutes are current.
	_rebuild()


## Screenshot hook for testing:
##   Godot --path . -- --shot=odd_color --filter=1 --out=/tmp/x.png [--wait=1.5] [--intro] [--grownups]
func _handle_cli() -> void:
	var args := {}
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else ""
	if args.has("export-sfx"):
		# Dev: write each interface sound to a WAV file for previewing.
		for n in Sfx._sounds:
			Sfx._sounds[n].save_to_wav(str(args["export-sfx"]).path_join(n + ".wav"))
		get_tree().quit()
		return
	if args.has("iris-test"):
		# Dev check: ask Iris each "|"-separated question in a fresh chat and print what happens.
		Iris.reply.connect(func(t): print("IRIS: ", t))
		Iris.action.connect(func(k, d): print("ACTION: ", k, " ", d))
		for q in str(args["iris-test"]).split("|"):
			Iris.reset()
			print("\nUSER: ", q)
			Iris.ask(q)
			while Iris.busy:
				await get_tree().process_frame
		get_tree().quit()
		return
	if not args.has("out"):
		return
	if args.has("filter"):
		Filter.set_mode(int(args["filter"]))
	if args.has("grownups"):
		_open_grownups()
	if args.has("profile"):
		_open_profile()
	if args.has("chat"):
		_open_chat()
	if args.has("shot") and args["shot"] != "menu":
		for ex in EXERCISES:
			if ex["key"] == args["shot"]:
				var e := _launch(ex, SECTIONS[ex["section"]]["color"])
				if not args.has("intro"):
					e.start.call_deferred()
	await get_tree().create_timer(float(args.get("wait", "1.5"))).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(args["out"])
	get_tree().quit()
