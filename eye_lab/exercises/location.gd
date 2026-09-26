extends Exercise
## Spatial localization: a light, a blank, then a light again. Same place or different?
## The shift shrinks as you improve. Only "moved" trials drive the staircase.

const TRIALS := 36

var stair: Staircase
var trial := 0
var p1 := Vector2.ZERO
var p2 := Vector2.ZERO
var same := true
var phase := "idle"   # fixate, first, blank, second, answer, feedback
var same_correct := 0
var same_total := 0


func _setup() -> void:
	id = "location"
	title = "Same place?"
	steps = ["Keep your eyes on the cross in the middle.", "A light appears, then disappears.", "It comes back, in the same spot or a new one.", "Tap \"Same place\" or \"It moved\"."]
	instructions = ""
	stair = Staircase.new(2.0, 0.05, 8.0, 1.4)


func _begin() -> void:
	set_answers([
		{"id": "same", "text": "Same place", "icon": "pin", "tip": "Shortcut: S"},
		{"id": "moved", "text": "It moved", "icon": "move", "tip": "Shortcut: D"},
	], Vector2(160, 104))
	_next()


func _next() -> void:
	trial += 1
	if trial > TRIALS:
		end()
		return
	phase = "fixate"
	set_answers_enabled(false)
	set_status("Round %d of %d  ·  shift %.2f°" % [trial, TRIALS, stair.value])
	queue_redraw()
	var r := clampf(ppd() * 0.35, 10.0, 24.0)
	var margin := r * 3 + stair.value * ppd()
	p1 = Vector2(randf_range(margin, size.x - margin), randf_range(margin + 70, size.y - margin - 140))
	same = randf() < 0.4
	p2 = p1 if same else p1 + Vector2.from_angle(randf() * TAU) * stair.value * ppd()
	after(0.6, func():
		phase = "first"
		queue_redraw()
		after(0.5, func():
			phase = "blank"
			queue_redraw()
			after(0.9, func():
				phase = "second"
				set_answers_enabled(true)
				queue_redraw()
				after(0.5, func():
					phase = "answer"
					queue_redraw()))))


func _on_answer(a: Variant) -> void:
	if phase not in ["second", "answer"]:
		return
	var ok: bool = (a == "same") == same
	if same:
		same_total += 1
		same_correct += int(ok)
	else:
		stair.record(ok)
	feedback(ok)
	phase = "feedback"
	set_answers_enabled(false)
	set_status(("Right! " if ok else "Not quite. ") + ("It was the same place." if same else "It moved."))
	queue_redraw()
	after(0.9, _next)


func _on_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k and k.pressed and not k.echo:
		if k.keycode == KEY_S:
			_on_answer("same")
		elif k.keycode == KEY_D:
			_on_answer("moved")


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color.BLACK)
	if not started or _ended:
		return
	DrawUtil.fixation(self, size / 2.0, 12)
	var r := clampf(ppd() * 0.35, 10.0, 24.0)
	if phase == "first":
		DrawUtil.sun(self, p1, r)
	elif phase == "second":
		DrawUtil.sun(self, p2, r)
	elif phase == "feedback":
		DrawUtil.sun(self, p1, r * 0.6)
		DrawUtil.sun(self, p2, r * 0.6)
	elif phase == "answer":
		draw_prompt("Same place, or did it move?", size.y / 2.0 + 64)


func _summary() -> Dictionary:
	if stair.trials < 8:
		return {"text": "Too few rounds to measure. Try a full session next time."}
	var th := stair.threshold()
	return {
		"value": th,
		"unit": "°",
		"text": "You reliably notice a light moving by %.2f° or more.\nCorrect on \"same place\" rounds: %d of %d.\n\nSmaller is better. If you missed many \"same place\" rounds, you may be answering \"moved\" too often." % [th, same_correct, same_total],
	}
