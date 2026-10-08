class_name Exercise
extends Control
## Base for all lab exercises. The stimulus is drawn on this Control (so the vision
## filter applies to it); the chrome (back button, trophies, status, answer buttons,
## start and result cards) lives on a CanvasLayer above the filter so it stays readable.
##
## Subclasses override _setup, _begin, _draw_scene, _on_input, _on_answer, _tick and
## _summary, and call set_answers() to put clickable answer buttons at the bottom.

signal finished(summary: Dictionary)

var id := ""
var title := ""
var instructions := ""          # optional extra note under the steps
var steps: Array = []           # "How to play" steps shown before the game starts
var icon := "eye"
var accent := UI.ACCENT
var config := {}
var trophies := 0
var started := false
var font: Font

var ui: Control                  # full-screen overlay root (above the filter)
var answer_bar: HBoxContainer

var _layer: CanvasLayer
var _status: Label
var _status_pill: PanelContainer
var _trophy_label: Label
var _hud: Control
var _intro: Control
var _result: Dictionary = {}
var _ended := false
var _flash_t := 0.0
var _flash_color := Color.TRANSPARENT
var _answer_buttons: Array[Button] = []

const FLASH_TIME := 0.25


func _ready() -> void:
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	focus_mode = FOCUS_ALL
	mouse_filter = MOUSE_FILTER_STOP
	font = ThemeDB.fallback_font
	_setup()
	_build_chrome()
	grab_focus.call_deferred()


# --- overridable hooks -------------------------------------------------------

func _setup() -> void:
	pass


func _begin() -> void:
	pass


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("f4f3ef"))


func _on_input(_event: InputEvent) -> void:
	pass


## Called when one of the set_answers() buttons is clicked.
func _on_answer(_answer_id: Variant) -> void:
	pass


func _tick(_delta: float) -> void:
	pass


## Return {"value": float, "unit": String, "text": String, "detail": Dictionary}.
## Leave out "value" when too few trials were run to be worth logging.
func _summary() -> Dictionary:
	return {}


# --- helpers ------------------------------------------------------------------

func ppd() -> float:
	return Lab.px_per_deg()


func set_status(t: String) -> void:
	if _status:
		_status.text = t
		_status_pill.visible = t != "" and started and not _ended


func feedback(ok: bool) -> void:
	Sfx.play("success" if ok else "fail")
	_flash_t = FLASH_TIME
	_flash_color = Color(0.2, 0.9, 0.35, 0.3) if ok else Color(0.95, 0.2, 0.2, 0.3)
	if ok:
		trophies += 1
		_trophy_label.text = str(trophies)
	queue_redraw()


## Replace the bottom answer buttons. Each option: {id, text, icon?, tex?, key?}.
func set_answers(options: Array, button_size := Vector2(120, 104)) -> void:
	for b in _answer_buttons:
		b.queue_free()
	_answer_buttons.clear()
	for o in options:
		var b := UI.choice(o.get("text", ""), o.get("icon", ""), accent, o.get("tex", null), button_size)
		if o.has("tip"):
			b.tooltip_text = o["tip"]
		if o.has("font_size"):
			b.add_theme_font_size_override("font_size", o["font_size"])
		var answer_id = o["id"]
		b.pressed.connect(func():
			if started and not _ended:
				_on_answer(answer_id))
		answer_bar.add_child(b)
		_answer_buttons.append(b)


func set_answers_enabled(on: bool) -> void:
	for b in _answer_buttons:
		b.disabled = not on


## Run fn after sec seconds; cancelled automatically if the exercise ends or is freed.
func after(sec: float, fn: Callable) -> void:
	var t := Timer.new()
	t.one_shot = true
	t.wait_time = maxf(sec, 0.001)
	add_child(t)
	t.timeout.connect(func():
		t.queue_free()
		if not _ended:
			fn.call())
	t.start()


func start() -> void:
	if started:
		return
	started = true
	_intro.queue_free()
	_hud.show()
	set_status(_status.text)
	grab_focus()
	_begin()
	queue_redraw()


func end() -> void:
	if _ended:
		return
	_ended = true
	_result = _summary()
	for c in get_children():
		if c is CanvasItem:
			c.hide()
	_hud.hide()
	queue_redraw()
	if _result.has("text"):
		Sfx.play("complete")
		_show_result_card()
	else:
		_close()


func _close(again := false) -> void:
	_result["id"] = id
	_result["title"] = title
	_result["trophies"] = trophies
	_result["again"] = again
	_result["started"] = started
	finished.emit(_result)


# --- chrome -------------------------------------------------------------------

func _build_chrome() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 102
	add_child(_layer)
	ui = Control.new()
	ui.theme = UI.theme()
	ui.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	ui.mouse_filter = MOUSE_FILTER_IGNORE
	_layer.add_child(ui)

	_hud = Control.new()
	_hud.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	_hud.mouse_filter = MOUSE_FILTER_IGNORE
	_hud.hide()
	ui.add_child(_hud)

	var back := UI.apple_button("Home", "arrow_left", "gray", UI.LABEL, 15, 38.0)
	back.icon = Icons.tex("arrow_left", 18, Color.WHITE)
	for st in ["normal", "hover", "pressed", "hover_pressed"]:
		var bsb := UI.box(Color(1, 1, 1, 0.94 if st == "normal" else 1.0), 19, 0)
		bsb.content_margin_left = 14
		bsb.content_margin_right = 18
		bsb.shadow_color = Color(0, 0, 0, 0.08)
		bsb.shadow_size = 8
		bsb.shadow_offset = Vector2(0, 2)
		back.add_theme_stylebox_override(st, bsb)
	UI.add_press_feel(back)
	back.tooltip_text = "Stop and go back home (Esc)"
	back.position = Vector2(16, 12)
	back.pressed.connect(end)
	_hud.add_child(back)

	var trow := HBoxContainer.new()
	trow.add_theme_constant_override("separation", 6)
	var ti := TextureRect.new()
	ti.texture = Icons.tex("trophy", 20, UI.GOLD)
	ti.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	trow.add_child(ti)
	_trophy_label = UI.label("0", 18, UI.LABEL, 700)
	trow.add_child(_trophy_label)
	var tp := _material(trow)
	tp.grow_horizontal = GROW_DIRECTION_BEGIN
	tp.set_anchors_and_offsets_preset(PRESET_TOP_RIGHT, PRESET_MODE_MINSIZE, 14)
	tp.tooltip_text = "Correct answers this session"
	_hud.add_child(tp)

	_status = UI.label("", 15, UI.LABEL)
	_status_pill = _material(_status)
	_status_pill.grow_vertical = GROW_DIRECTION_BEGIN
	_status_pill.set_anchors_and_offsets_preset(PRESET_BOTTOM_LEFT, PRESET_MODE_MINSIZE, 16)
	_status_pill.mouse_filter = MOUSE_FILTER_IGNORE
	_status_pill.hide()
	_hud.add_child(_status_pill)

	answer_bar = HBoxContainer.new()
	answer_bar.add_theme_constant_override("separation", 12)
	answer_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	answer_bar.grow_horizontal = GROW_DIRECTION_BOTH
	answer_bar.grow_vertical = GROW_DIRECTION_BEGIN
	answer_bar.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM, PRESET_MODE_MINSIZE, 24)
	_hud.add_child(answer_bar)

	_intro = _card(icon, "HOW TO PLAY", title, steps, instructions, [
		{"text": "Back", "icon": "arrow_left", "kind": "light", "fn": _close.bind(false)},
		{"text": "Let's go", "icon": "play", "kind": "primary", "fn": start},
	])
	ui.add_child(_intro)


func _show_result_card() -> void:
	var buttons := [
		{"text": "Done", "icon": "check", "kind": "primary", "fn": _close.bind(false)},
	]
	if id != "calibrate":
		buttons.push_front({"text": "Play again", "icon": "replay", "kind": "light", "fn": _close.bind(true)})
	var kicker := "NICE WORK!" if trophies > 0 else "ALL DONE"
	var sub_line := "" if id == "calibrate" else ("%d trophies this round" % trophies if trophies != 1 else "1 trophy this round")
	ui.add_child(_card("trophy" if trophies > 0 else icon, kicker, title, [], str(_result["text"]), buttons, sub_line))


const INK := UI.LABEL
const INK_MUTED := UI.LABEL_2


## White capsule for readouts over the game, matching the filter bar.
func _material(content: Control) -> PanelContainer:
	return UI.pill(content)


## Warm dimmed backdrop with a white card: badge, kicker, title, numbered steps,
## a note, and buttons. Used for "How to play" and for results.
func _card(card_icon: String, kicker: String, heading: String, step_list: Array, note: String,
		buttons: Array, sub_line := "") -> Control:
	var dim := ColorRect.new()
	dim.color = UI.DIM
	dim.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	dim.add_child(center)
	var panel := PanelContainer.new()
	var sb := UI.box(UI.SHEET, 26, 32)
	sb.shadow_color = Color(0, 0, 0, 0.18)
	sb.shadow_size = 40
	sb.shadow_offset = Vector2(0, 14)
	panel.add_theme_stylebox_override("panel", sb)
	panel.custom_minimum_size = Vector2(minf(600.0, get_viewport_rect().size.x - 60.0), 0)
	center.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 18)
	panel.add_child(col)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 18)
	var badge := UI.icon_tile(card_icon, UI.GOLD if card_icon == "trophy" else accent, 64.0)
	badge.size_flags_vertical = SIZE_SHRINK_CENTER
	head.add_child(badge)
	var hv := VBoxContainer.new()
	hv.alignment = BoxContainer.ALIGNMENT_CENTER
	hv.add_theme_constant_override("separation", 2)
	hv.add_child(UI.label(kicker, 12, UI.LABEL_2, 600))
	hv.add_child(UI.label(heading, 28, INK, 700))
	if sub_line != "":
		hv.add_child(UI.label(sub_line, 15, INK_MUTED, 600))
	head.add_child(hv)
	col.add_child(head)

	for i in step_list.size():
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 14)
		var num := UI.label(str(i + 1), 14, accent.darkened(0.15), 700)
		num.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		num.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		num.custom_minimum_size = Vector2(28, 28)
		num.size_flags_vertical = SIZE_SHRINK_BEGIN
		num.add_theme_stylebox_override("normal", UI.box(Color(accent, 0.13), 14, 0))
		row.add_child(num)
		var t := UI.label(str(step_list[i]), 17, INK, 400, true)
		t.size_flags_horizontal = SIZE_EXPAND_FILL
		t.custom_minimum_size = Vector2(440, 0)
		row.add_child(t)
		col.add_child(row)

	if note != "":
		var n := UI.label(note, 16 if step_list.is_empty() else 14, INK if step_list.is_empty() else INK_MUTED, 500, true)
		n.custom_minimum_size = Vector2(480, 0)
		if not step_list.is_empty():
			n.add_theme_stylebox_override("normal", UI.box(UI.FILL, 12, 12))
		col.add_child(n)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	row.alignment = BoxContainer.ALIGNMENT_END
	for b in buttons:
		var btn := UI.apple_button(b["text"], b["icon"], "gray" if b["kind"] == "light" else "filled", UI.ACCENT, 16, 46.0)
		if b["kind"] == "light":
			btn.icon = Icons.tex(b["icon"], 18, Color.WHITE)
			for key in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
				btn.add_theme_color_override(key, INK)
		btn.custom_minimum_size = Vector2(0, 46)
		UI.add_press_feel(btn)
		btn.pressed.connect(b["fn"])
		row.add_child(btn)
	col.add_child(UI.label("", 2))
	col.add_child(row)
	return dim


# --- engine callbacks ---------------------------------------------------------

func _process(delta: float) -> void:
	if _flash_t > 0.0:
		_flash_t -= delta
		queue_redraw()
	if started and not _ended:
		_tick(delta)


func _gui_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	var pressed_key := key != null and key.pressed and not key.echo
	if _ended:
		if pressed_key and key.keycode in [KEY_ESCAPE, KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
			accept_event()
			_close()
		return
	if pressed_key and key.keycode == KEY_ESCAPE:
		accept_event()
		if started:
			end()
		else:
			_close()
		return
	if not started:
		if pressed_key and key.keycode in [KEY_SPACE, KEY_ENTER, KEY_KP_ENTER]:
			accept_event()
			start()
		return
	_on_input(event)


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		queue_redraw()


func _draw() -> void:
	_draw_scene()
	if _flash_t > 0.0:
		draw_rect(Rect2(Vector2.ZERO, size), Color(_flash_color, _flash_color.a * _flash_t / FLASH_TIME))


## Centred prompt text drawn into the scene (e.g. "How many lights?").
func draw_prompt(text: String, y: float, col := Color(0.85, 0.87, 0.9), fs := 24) -> void:
	draw_string(font, Vector2(0, y), text, HORIZONTAL_ALIGNMENT_CENTER, size.x, fs, col)
