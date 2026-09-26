extends Exercise
## "How many spots of light?" (number of attentional foci). Lights flash briefly
## anywhere in the field while you fixate the centre; the flash gets shorter as you improve.

const TRIALS := 20

var stair: Staircase
var trial := 0
var spots := PackedVector2Array()
var n := 0
var phase := "idle"   # fixate, show, answer, feedback


func _setup() -> void:
	id = "spot_count"
	title = "Counting lights"
	steps = ["Keep your eyes on the cross in the middle.", "A few lights flash for a moment.", "Tap how many lights you saw.", "The flashes get shorter as you improve."]
	instructions = ""
	stair = Staircase.new(900.0, 40.0, 2500.0, 1.3)


func _begin() -> void:
	var opts := []
	for i in range(1, 10):
		opts.append({"id": i, "text": str(i), "font_size": 30})
	set_answers(opts, Vector2(72, 72))
	_next()


func _next() -> void:
	trial += 1
	if trial > TRIALS:
		end()
		return
	phase = "fixate"
	spots.clear()
	set_answers_enabled(false)
	set_status("Round %d of %d  ·  flash %d ms" % [trial, TRIALS, int(stair.value)])
	queue_redraw()
	after(randf_range(0.7, 1.2), _show)


func _show() -> void:
	n = randi_range(1, 7)
	var r := _spot_r()
	var center := size / 2.0
	var tries := 0
	while spots.size() < n and tries < 2000:
		tries += 1
		var p := Vector2(randf_range(r * 2, size.x - r * 2), randf_range(r * 2 + 70, size.y - r * 2 - 130))
		if p.distance_to(center) < r * 4:
			continue
		var ok := true
		for q in spots:
			if p.distance_to(q) < r * 4:
				ok = false
				break
		if ok:
			spots.append(p)
	n = spots.size()
	phase = "show"
	set_answers_enabled(true)
	queue_redraw()
	after(stair.value / 1000.0, func():
		phase = "answer"
		queue_redraw())


func _spot_r() -> float:
	return clampf(ppd() * 0.45, 12.0, 30.0)


func _on_answer(k: Variant) -> void:
	if phase not in ["show", "answer"]:
		return
	var ok: bool = int(k) == n
	stair.record(ok)
	feedback(ok)
	phase = "feedback"
	set_answers_enabled(false)
	set_status("Correct, there were %d." % n if ok else "There were %d." % n)
	queue_redraw()
	after(0.9, _next)


func _on_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k and k.pressed and not k.echo:
		var ch := char(k.unicode)
		if ch.is_valid_int() and int(ch) >= 1:
			_on_answer(int(ch))


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color.BLACK)
	if not started or _ended:
		return
	DrawUtil.fixation(self, size / 2.0, 12)
	if phase in ["show", "feedback"]:
		var r := _spot_r()
		for p in spots:
			DrawUtil.sun(self, p, r)
	if phase == "answer":
		draw_prompt("How many lights did you see?", size.y / 2.0 + 64)


func _summary() -> Dictionary:
	if stair.trials < 8:
		return {"text": "Too few rounds to measure. Try a full session next time."}
	var th := stair.threshold()
	return {
		"value": th,
		"unit": "ms",
		"text": "You can count the lights reliably in flashes as short as %d ms.\nAccuracy: %d%%\n\nShorter is better." % [int(th), int(stair.accuracy() * 100)],
	}
