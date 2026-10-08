extends Control
## Chat drawer for Iris (Claude). Slides in from the right over the home screen.
## The conversation lives in the Iris autoload, so it survives page rebuilds.

const INK := UI.LABEL
const INK_MUTED := UI.LABEL_2
const ACCENT := UI.ACCENT
const WIDTH := 400.0
const HEIGHT := 580.0

const SUGGESTIONS := [
	"What does the High-pass filter do?",
	"Start the Letter E test",
	"How am I doing?",
	"What's the science behind Dot hunt?",
	"Turn on Magic glasses for the whole screen",
]

signal closed

var _panel: PanelContainer
var _list: VBoxContainer
var _scroll: ScrollContainer
var _input: LineEdit
var _send: Button
var _typing: Label
var _chips: HFlowContainer
var _t := 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_IGNORE

	# Popover anchored above the "Ask Iris" button in the bottom-right corner.
	_panel = UI.glass_panel(24.0, 0, Color(1, 1, 1, 0.96))
	_panel.anchor_left = 1.0
	_panel.anchor_right = 1.0
	_panel.anchor_top = 1.0
	_panel.anchor_bottom = 1.0
	_panel.offset_left = -WIDTH - 24
	_panel.offset_right = -24
	_panel.offset_bottom = -92
	_panel.offset_top = -92 - minf(HEIGHT, get_viewport_rect().size.y - 190)
	add_child(_panel)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 0)
	_panel.add_child(col)

	# Header.
	var head_m := MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		head_m.add_theme_constant_override("margin_" + side, 14)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 12)
	var face := Control.new()
	face.set_script(preload("res://core/mascot.gd"))
	face.custom_minimum_size = Vector2(44, 44)
	face.mouse_filter = MOUSE_FILTER_IGNORE
	head.add_child(face)
	var hv := VBoxContainer.new()
	hv.add_theme_constant_override("separation", 0)
	hv.alignment = BoxContainer.ALIGNMENT_CENTER
	hv.size_flags_horizontal = SIZE_EXPAND_FILL
	hv.add_child(UI.label("Iris", 17, INK, 600))
	hv.add_child(UI.label("Eye Lab guide · powered by Claude", 12, INK_MUTED, 400))
	head.add_child(hv)
	var close := _ink_button("", "x")
	close.tooltip_text = "Close"
	close.pressed.connect(func(): closed.emit())
	head.add_child(close)
	head_m.add_child(head)
	col.add_child(head_m)
	col.add_child(_divider())

	# Messages.
	_scroll = ScrollContainer.new()
	_scroll.size_flags_vertical = SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var lm := MarginContainer.new()
	lm.size_flags_horizontal = SIZE_EXPAND_FILL
	for side in ["left", "right", "top", "bottom"]:
		lm.add_theme_constant_override("margin_" + side, 16)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 10)
	lm.add_child(_list)
	_scroll.add_child(lm)
	col.add_child(_scroll)

	_typing = UI.label("", 14, INK_MUTED, 600)
	var tm := MarginContainer.new()
	tm.add_theme_constant_override("margin_left", 20)
	tm.add_child(_typing)
	col.add_child(tm)

	# Suggestions.
	var cm := MarginContainer.new()
	for side in ["left", "right"]:
		cm.add_theme_constant_override("margin_" + side, 14)
	cm.add_theme_constant_override("margin_bottom", 8)
	_chips = HFlowContainer.new()
	_chips.add_theme_constant_override("h_separation", 6)
	_chips.add_theme_constant_override("v_separation", 6)
	for s in SUGGESTIONS:
		var chip := _chip(s)
		chip.pressed.connect(_submit.bind(s))
		_chips.add_child(chip)
	cm.add_child(_chips)
	col.add_child(cm)
	col.add_child(_divider())

	# Input row.
	var im := MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		im.add_theme_constant_override("margin_" + side, 14)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_input = LineEdit.new()
	_input.placeholder_text = "Ask Iris about Eye Lab…"
	_input.size_flags_horizontal = SIZE_EXPAND_FILL
	_input.custom_minimum_size = Vector2(0, 40)
	_input.add_theme_font_size_override("font_size", 15)
	_input.add_theme_color_override("font_color", INK)
	_input.add_theme_color_override("font_placeholder_color", INK_MUTED)
	_input.add_theme_color_override("caret_color", ACCENT)
	var ib := UI.box(Color(0.47, 0.47, 0.5, 0.12), 20, 8)
	ib.content_margin_left = 16
	_input.add_theme_stylebox_override("normal", ib)
	var ibf := ib.duplicate()
	ibf.bg_color = Color(1, 1, 1, 0.9)
	ibf.border_color = Color(ACCENT, 0.5)
	ibf.set_border_width_all(1)
	_input.add_theme_stylebox_override("focus", ibf)
	_input.text_submitted.connect(_submit)
	row.add_child(_input)
	_send = UI.apple_button("", "send", "filled", ACCENT, 15, 40.0)
	_send.icon = Icons.tex("send", 17, Color.WHITE)
	_send.tooltip_text = "Send"
	_send.pressed.connect(func(): _submit(_input.text))
	row.add_child(_send)
	im.add_child(row)
	col.add_child(im)

	Iris.reply.connect(_on_reply)
	Iris.busy_changed.connect(_on_busy)
	_render_history()
	_on_busy(Iris.busy)

	# Slide in.
	_panel.modulate.a = 0.0
	_panel.pivot_offset = Vector2(WIDTH, _panel.size.y)
	_panel.scale = Vector2(0.94, 0.94)
	var tw := create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_parallel(true)
	tw.tween_property(_panel, "modulate:a", 1.0, 0.2)
	tw.tween_property(_panel, "scale", Vector2.ONE, 0.28)
	_input.grab_focus.call_deferred()


func _process(delta: float) -> void:
	if Iris.busy:
		_t += delta
		_typing.text = "Iris is thinking" + ".".repeat(1 + int(_t * 3.0) % 3)


func _submit(text: String) -> void:
	text = text.strip_edges()
	if text == "" or Iris.busy:
		return
	_input.text = ""
	_add_bubble(text, true)
	_chips.hide()
	Iris.ask(text)


func _on_reply(text: String) -> void:
	_add_bubble(text, false)


func _on_busy(b: bool) -> void:
	_typing.visible = b
	_send.disabled = b
	if not b:
		_typing.text = ""


func _render_history() -> void:
	if Iris.messages.is_empty():
		_add_bubble("Hi%s! I'm Iris. Ask me about any game, the filters, or the science behind Eye Lab. I can also start games and switch filters for you." % (
			", " + str(Lab.settings["name"]) if str(Lab.settings["name"]) != "" else ""), false)
		return
	_chips.hide()
	for m in Iris.messages:
		if m["role"] == "user" and typeof(m["content"]) == TYPE_STRING:
			_add_bubble(m["content"], true)
		elif m["role"] == "assistant":
			for b in m["content"]:
				if b.get("type", "") == "text" and str(b.get("text", "")).strip_edges() != "":
					_add_bubble(str(b["text"]).strip_edges(), false)


func _add_bubble(text: String, mine: bool) -> void:
	var row := HBoxContainer.new()
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(40, 0)
	var bubble := PanelContainer.new()
	var sb := UI.box(ACCENT if mine else Color(0.47, 0.47, 0.5, 0.12), 18, 10)
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	if mine:
		sb.corner_radius_bottom_right = 6
	else:
		sb.corner_radius_bottom_left = 6
	bubble.add_theme_stylebox_override("panel", sb)
	bubble.size_flags_horizontal = SIZE_EXPAND_FILL
	var l := UI.label(text, 15, Color.WHITE if mine else INK, 400, true)
	l.custom_minimum_size = Vector2(240, 0)
	bubble.add_child(l)
	if mine:
		row.add_child(spacer)
		row.add_child(bubble)
	else:
		row.add_child(bubble)
		row.add_child(spacer)
	_list.add_child(row)
	_scroll_to_end.call_deferred()


func _scroll_to_end() -> void:
	await get_tree().process_frame
	_scroll.scroll_vertical = int(_scroll.get_v_scroll_bar().max_value)


func _divider() -> ColorRect:
	var d := ColorRect.new()
	d.color = UI.SEPARATOR
	d.custom_minimum_size = Vector2(0, 1)
	return d


func _chip(text: String) -> Button:
	return UI.apple_button(text, "", "tinted", ACCENT, 13, 30.0)


func _ink_button(text: String, icon: String) -> Button:
	var b := UI.apple_button(text, icon, "gray", INK, 14, 30.0)
	b.icon = Icons.tex(icon, 16, INK_MUTED)
	for key in ["icon_normal_color", "icon_hover_color", "icon_pressed_color", "font_color", "font_hover_color"]:
		b.add_theme_color_override(key, INK_MUTED)
	for st in ["normal", "hover", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, UI.box(UI.FILL if st == "normal" else Color(UI.FILL, 0.22), 14, 6))
	return b
