extends Exercise
## Multiple object tracking across the whole screen (objects can go into the periphery).
## Some dots are cued red, then all move; click the cued ones. Speed adapts.

const TRIALS := 12
const N_DOTS := 10
const N_TARGETS := 4

var stair: Staircase
var trial := 0
var dots: Array = []      # [{p, v, target, picked}]
var phase := "idle"       # cue, track, respond, feedback
var phase_t := 0.0


func _setup() -> void:
	id = "mot"
	title = "Multiple object tracking"
	steps = ["%d dots get a red ring. Remember them." % N_TARGETS, "The rings vanish and all the dots move around.", "When they stop, tap the %d dots you remember." % N_TARGETS, "They speed up as you improve."]
	instructions = ""
	stair = Staircase.new(5.0, 1.0, 40.0, 1.3, false)


func _begin() -> void:
	_next()


func _r() -> float:
	return clampf(ppd() * 0.35, 10.0, 22.0)


func _next() -> void:
	trial += 1
	if trial > TRIALS:
		end()
		return
	dots.clear()
	var r := _r()
	while dots.size() < N_DOTS:
		var p := Vector2(randf_range(r * 3, size.x - r * 3), randf_range(r * 3 + 70, size.y - r * 3 - 60))
		var ok := true
		for d in dots:
			if p.distance_to(d["p"]) < r * 5:
				ok = false
		if ok:
			dots.append({"p": p, "v": Vector2.from_angle(randf() * TAU), "target": dots.size() < N_TARGETS, "picked": false})
	phase = "cue"
	phase_t = 2.0
	set_status("Round %d of %d  ·  speed %.1f°/s" % [trial, TRIALS, stair.value])


func _tick(delta: float) -> void:
	if phase == "cue":
		phase_t -= delta
		if phase_t <= 0.0:
			phase = "track"
			phase_t = 6.0
	elif phase == "track":
		phase_t -= delta
		_move(delta)
		if phase_t <= 0.0:
			phase = "respond"
			set_status("Click the %d marked dots" % N_TARGETS)
		queue_redraw()


func _move(delta: float) -> void:
	var r := _r()
	var speed := stair.value * ppd()
	var lo := Vector2(r, r + 70)
	var hi := size - Vector2(r, r + 60)
	for d in dots:
		var v: Vector2 = d["v"]
		v = v.rotated(randf_range(-1.5, 1.5) * delta).normalized()
		var p: Vector2 = d["p"] + v * speed * delta
		if p.x < lo.x or p.x > hi.x:
			v.x = -v.x
		if p.y < lo.y or p.y > hi.y:
			v.y = -v.y
		d["p"] = p.clamp(lo, hi)
		d["v"] = v
	# Push overlapping dots apart so they never merge.
	for i in dots.size():
		for j in range(i + 1, dots.size()):
			var a: Dictionary = dots[i]
			var b: Dictionary = dots[j]
			var diff: Vector2 = b["p"] - a["p"]
			if diff.length() < r * 2.4 and diff.length() > 0.001:
				var n := diff.normalized()
				a["v"] = (a["v"] as Vector2).bounce(n)
				b["v"] = (b["v"] as Vector2).bounce(-n)


func _on_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb == null or not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT or phase != "respond":
		return
	var best: Dictionary = {}
	var best_d := _r() * 2.0
	for d in dots:
		var dist := mb.position.distance_to(d["p"])
		if dist < best_d:
			best_d = dist
			best = d
	if best.is_empty():
		return
	best["picked"] = not best["picked"]
	queue_redraw()
	var picked := dots.filter(func(d): return d["picked"])
	if picked.size() == N_TARGETS:
		var hits := picked.filter(func(d): return d["target"]).size()
		var ok := hits == N_TARGETS
		stair.record(ok)
		feedback(ok)
		phase = "feedback"
		set_status("%d of %d correct" % [hits, N_TARGETS])
		after(1.4, _next)


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.96, 0.96, 0.94))
	if not started or _ended:
		return
	var r := _r()
	for d in dots:
		var p: Vector2 = d["p"]
		draw_circle(p, r, Color(0.08, 0.08, 0.08))
		if phase == "cue" and d["target"]:
			draw_arc(p, r * 1.6, 0, TAU, 32, Color(0.9, 0.1, 0.1), 3.0, true)
		if phase in ["respond", "feedback"] and d["picked"]:
			draw_arc(p, r * 1.6, 0, TAU, 32, Color(0.2, 0.4, 0.95), 3.0, true)
		if phase == "feedback" and d["target"]:
			draw_arc(p, r * 2.1, 0, TAU, 32, Color(0.1, 0.7, 0.2), 3.0, true)


func _summary() -> Dictionary:
	if stair.trials < 4:
		return {"text": "Too few trials to estimate a threshold."}
	var th := stair.threshold()
	return {
		"value": th,
		"unit": "°/s",
		"text": "Tracking speed threshold: %.1f°/s with %d targets\nAccuracy: %d%%\n\n(Higher is better.)" % [th, N_TARGETS, int(stair.accuracy() * 100)],
	}
