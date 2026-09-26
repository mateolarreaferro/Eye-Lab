extends Exercise
## Field-of-view mapping: fixate the centre, press Space whenever a faint dot appears.
## Positions follow the polar grid from the slides, clipped to what the screen covers
## at your viewing distance. Cover one eye to find its blind spot (~15° to the side).

const RINGS := [3.0, 6.0, 10.0, 15.0, 20.0, 25.0, 30.0]
const SPOKES := 12
const CATCH_FRACTION := 0.12
const STIM_TIME := 0.2
const RESPONSE_WINDOW := 1.1

var queue: Array = []      # [{deg: Vector2, catch: bool}]
var tested: Array = []     # [{deg, seen}]
var current := {}
var phase := "idle"        # wait, stim, window, results
var t := 0.0
var false_alarms := 0
var catch_trials := 0


func _setup() -> void:
	id = "field_map"
	title = "Visual field map"
	steps = ["Keep your eyes on the red dot in the middle the whole time.", "Small grey dots pop up around it.", "Click anywhere (or tap \"I saw a dot\") as soon as you see one.", "Some rounds have no dot, so don't guess."]
	instructions = "Tip: cover one eye to find its blind spot, about 15° out to that side."


func _begin() -> void:
	var half := (size / 2.0 - Vector2(20, 20)) / ppd()
	for ri in RINGS.size():
		var ecc: float = RINGS[ri]
		for s in SPOKES:
			var a := (s + (0.5 if ri % 2 else 0.0)) * TAU / SPOKES
			var deg := Vector2(cos(a), sin(a)) * ecc
			if absf(deg.x) < half.x and absf(deg.y) < half.y:
				queue.append({"deg": deg, "catch": false})
	var n_catch := int(queue.size() * CATCH_FRACTION)
	for i in n_catch:
		queue.append({"deg": Vector2.ZERO, "catch": true})
	queue.shuffle()
	set_answers([{"id": "seen", "text": "I saw a dot", "icon": "eye", "tip": "Or click anywhere / press Space"}], Vector2(200, 96))
	_next()


func _next() -> void:
	if queue.is_empty():
		phase = "results"
		set_status("Your map: green = seen, red = missed")
		set_answers([{"id": "finish", "text": "See summary", "icon": "check"}], Vector2(200, 96))
		queue_redraw()
		return
	current = queue.pop_back()
	phase = "wait"
	t = randf_range(0.8, 1.8)
	set_status("%d locations left" % queue.size())
	queue_redraw()


func _tick(delta: float) -> void:
	t -= delta
	if t > 0.0:
		return
	match phase:
		"wait":
			phase = "stim"
			t = STIM_TIME
			queue_redraw()
		"stim":
			phase = "window"
			t = RESPONSE_WINDOW - STIM_TIME
			queue_redraw()
		"window":
			_resolve(false)


func _resolve(pressed: bool) -> void:
	if current["catch"]:
		catch_trials += 1
		false_alarms += int(pressed)
	else:
		tested.append({"deg": current["deg"], "seen": pressed})
	_next()


func _on_answer(a: Variant) -> void:
	if a == "finish":
		end()
	elif phase in ["stim", "window"]:
		_resolve(true)
	elif phase == "wait":
		false_alarms += 1


func _on_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	var click := event as InputEventMouseButton
	if (k and k.pressed and not k.echo and k.keycode == KEY_SPACE) or (click and click.pressed):
		_on_answer("finish" if phase == "results" else "seen")


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.18, 0.18, 0.18))
	if not started or _ended:
		return
	var c := size / 2.0
	if phase == "results":
		_draw_results(c)
		return
	draw_circle(c, 5, Color(0.9, 0.15, 0.15))
	if phase == "stim" and not current["catch"]:
		draw_circle(c + current["deg"] * ppd(), clampf(ppd() * 0.2, 4.0, 10.0), Color(0.42, 0.42, 0.42))


func _draw_results(c: Vector2) -> void:
	for ecc in RINGS:
		var rr: float = ecc * ppd()
		if rr < size.length():
			draw_arc(c, rr, 0, TAU, 96, Color(0.4, 0.4, 0.4), 1.0, true)
			draw_string(font, c + Vector2(rr + 4, -4), "%d°" % int(ecc), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.6, 0.6, 0.6))
	draw_line(Vector2(0, c.y), Vector2(size.x, c.y), Color(0.4, 0.4, 0.4))
	draw_line(Vector2(c.x, 0), Vector2(c.x, size.y), Color(0.4, 0.4, 0.4))
	for r in tested:
		draw_circle(c + r["deg"] * ppd(), 8, Color(0.2, 0.8, 0.3) if r["seen"] else Color(0.9, 0.2, 0.2))


func _summary() -> Dictionary:
	if tested.size() < 10:
		return {"text": "Too few locations tested."}
	var seen := tested.filter(func(r): return r["seen"]).size()
	var pct := 100.0 * seen / tested.size()
	var misses: Array = tested.filter(func(r): return not r["seen"]).map(
		func(r): return [snappedf(r["deg"].x, 0.1), snappedf(r["deg"].y, 0.1)])
	return {
		"value": pct,
		"unit": "% seen",
		"text": "Seen: %d / %d locations (%.0f%%)\nFalse alarms: %d (catch trials: %d)\n\nMissed spots can be your blind spot, a lapse in fixation, or a real field loss. Repeat before reading anything into it." % [
			seen, tested.size(), pct, false_alarms, catch_trials],
		"detail": {"missed_deg": misses, "false_alarms": false_alarms},
	}
