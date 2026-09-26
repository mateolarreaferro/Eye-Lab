extends Exercise
## Screen calibration: resize the rectangle until it matches a credit/ID card
## (85.6 mm wide, ISO/IEC 7810 ID-1). Gives pixels per cm for visual-angle maths.

const CARD_W_CM := 8.56
const CARD_H_CM := 5.398

var card_w := 400.0
var saved := false
var _slider: HSlider


func _setup() -> void:
	id = "calibrate"
	title = "Calibrate screen"
	icon = "card"
	steps = ["Hold a bank card flat against the screen.", "Drag the slider until the rectangle is exactly as wide as the card.", "Tap Save."]
	instructions = "This lets the lab draw things at their true size, which the tests need."
	card_w = Lab.px_per_cm() * CARD_W_CM


func _begin() -> void:
	set_answers([
		{"id": "minus", "text": "Smaller", "icon": "minus"},
		{"id": "plus", "text": "Bigger", "icon": "plus"},
		{"id": "save", "text": "Save", "icon": "check"},
	], Vector2(120, 96))
	_slider = HSlider.new()
	_slider.min_value = 150
	_slider.max_value = size.x - 80
	_slider.step = 0.5
	_slider.value = card_w
	_slider.focus_mode = FOCUS_NONE
	_slider.custom_minimum_size = Vector2(520, 24)
	_slider.value_changed.connect(func(v):
		card_w = v
		queue_redraw())
	var pill := UI.pill(_slider)
	pill.grow_horizontal = GROW_DIRECTION_BOTH
	pill.grow_vertical = GROW_DIRECTION_BEGIN
	pill.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM, PRESET_MODE_MINSIZE, 150)
	_hud.add_child(pill)    # part of the HUD so it hides with it


func _on_answer(a: Variant) -> void:
	match a:
		"minus": _slider.value -= 1.0
		"plus": _slider.value += 1.0
		"save":
			Lab.settings["px_per_cm"] = card_w / CARD_W_CM
			Lab.save_data()
			saved = true
			end()


func _on_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb and mb.pressed:
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			_slider.value += 1.0
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_slider.value -= 1.0


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), UI.BG)
	if not started or _ended:
		return
	var h := card_w * CARD_H_CM / CARD_W_CM
	var r := Rect2((size - Vector2(card_w, h)) / 2.0 - Vector2(0, 80), Vector2(card_w, h))
	draw_rect(r, UI.BLUE.darkened(0.2))
	draw_rect(r, Color.WHITE, false, 2.0)
	draw_prompt("Match the width of a bank card", r.position.y - 24, UI.MUTED, 18)
	draw_prompt("%.1f px per cm" % (card_w / CARD_W_CM), r.end.y + 36, UI.TEXT, 18)


func _summary() -> Dictionary:
	if not saved:
		return {}
	return {"text": "Saved: %.1f px per cm.\nAt %d cm from the screen, 1° of your vision covers %.0f px." % [
		float(Lab.settings["px_per_cm"]), int(Lab.settings["distance_cm"]), Lab.px_per_deg()]}
