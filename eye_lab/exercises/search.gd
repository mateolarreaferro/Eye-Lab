extends Exercise
## Directed search: memorise a reference object, then find it in a crowded field
## (Where's Waldo style). Distractors share its shape or its color, so you have to
## bind both features. The field gets more crowded as you go.

const TRIALS := 14
const COLORS := [Color(0.85, 0.15, 0.15), Color(0.15, 0.45, 0.9), Color(0.1, 0.65, 0.3),
	Color(0.95, 0.75, 0.1), Color(0.6, 0.25, 0.8), Color(0.95, 0.5, 0.1), Color(0.1, 0.1, 0.1)]
const TIMEOUT := 25.0

var trial := 0
var target := {}
var items: Array = []     # [{p, shape, color, target}]
var phase := "idle"       # reference, search, feedback
var t0 := 0.0
var rts: Array[float] = []
var misses := 0
var wrong_clicks := 0


func _setup() -> void:
	id = "search"
	title = "Directed search"
	steps = ["Remember the shape shown first.", "Then find it in a crowd of shapes.", "Tap it as fast as you can.", "Careful: some share its shape, some its color."]
	instructions = ""


func _begin() -> void:
	_next()


func _r() -> float:
	return clampf(ppd() * 0.4, 12.0, 26.0)


func _next() -> void:
	trial += 1
	if trial > TRIALS:
		end()
		return
	target = {"shape": DrawUtil.SHAPES.pick_random(), "color": COLORS.pick_random()}
	phase = "reference"
	set_status("Round %d of %d  ·  remember this one" % [trial, TRIALS])
	after(1.5, _show_field)


func _show_field() -> void:
	var n := 30 + trial * 8
	var r := _r()
	var area := Rect2(Vector2(r * 2, 80), size - Vector2(r * 4, 140))
	var cols := int(ceil(sqrt(n * area.size.x / area.size.y)))
	var rows := int(ceil(float(n) / cols))
	var cell := area.size / Vector2(cols, rows)
	var cells := range(cols * rows)
	cells.shuffle()
	items.clear()
	for i in n:
		var cx: int = cells[i] % cols
		var cy: int = cells[i] / cols
		var jitter := (cell - Vector2(r, r) * 2.2).max(Vector2.ZERO) / 2.0
		var p := area.position + (Vector2(cx, cy) + Vector2(0.5, 0.5)) * cell \
			+ Vector2(randf_range(-jitter.x, jitter.x), randf_range(-jitter.y, jitter.y))
		var it := {"p": p, "target": i == 0}
		if i == 0:
			it.merge(target)
		else:
			# Conjunction search: half the distractors share the shape, half the color.
			var shape = target["shape"]
			var color = target["color"]
			while shape == target["shape"] and color == target["color"]:
				if randf() < 0.5:
					color = COLORS.pick_random()
				else:
					shape = DrawUtil.SHAPES.pick_random()
			it["shape"] = shape
			it["color"] = color
		items.append(it)
	phase = "search"
	t0 = Time.get_ticks_msec() / 1000.0
	set_status("Round %d of %d  ·  %d objects" % [trial, TRIALS, n])
	after(TIMEOUT, func():
		if phase == "search":
			misses += 1
			feedback(false)
			phase = "feedback"
			after(1.2, _next))


func _on_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb == null or not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT or phase != "search":
		return
	var r := _r()
	for it in items:
		if mb.position.distance_to(it["p"]) < r * 1.3:
			if it["target"]:
				rts.append(Time.get_ticks_msec() / 1000.0 - t0)
				feedback(true)
				phase = "feedback"
				set_status("Found in %.2f s" % rts[-1])
				after(0.9, _next)
			else:
				wrong_clicks += 1
				feedback(false)
			return


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.97, 0.96, 0.92))
	if not started or _ended:
		return
	var r := _r()
	if phase == "reference":
		draw_string(font, Vector2(0, size.y / 2.0 - r * 4), "Find this:", HORIZONTAL_ALIGNMENT_CENTER, size.x, 24, Color(0.2, 0.2, 0.2))
		DrawUtil.shape(self, target["shape"], size / 2.0, r * 2.5, target["color"])
		return
	for it in items:
		DrawUtil.shape(self, it["shape"], it["p"], r, it["color"])
	if phase == "feedback":
		for it in items:
			if it["target"]:
				draw_arc(it["p"], r * 2.0, 0, TAU, 32, Color(0.1, 0.7, 0.2), 4.0, true)


func _summary() -> Dictionary:
	if rts.size() < 3:
		return {"text": "Too few targets found to score this session."}
	var sorted := rts.duplicate()
	sorted.sort()
	var median: float = sorted[sorted.size() / 2]
	return {
		"value": median,
		"unit": "s",
		"text": "Median search time: %.2f s\nFound %d / %d   ·   wrong clicks: %d\n\n(Lower is better.)" % [median, rts.size(), TRIALS, wrong_clicks],
	}
