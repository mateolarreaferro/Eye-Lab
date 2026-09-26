extends Exercise
## Tumbling-E acuity test (4 alternatives, 3-down-1-up staircase on letter size).
## Reports logMAR and the Snellen equivalent. Accuracy depends on calibration and distance.

const MAX_TRIALS := 60
const MAX_REVERSALS := 10
const DIR_NAMES := ["Right", "Down", "Left", "Up"]

var stair: Staircase
var dir := 0
var phase := "idle"    # show, feedback


func _setup() -> void:
	id = "acuity"
	title = "Acuity test"
	steps = ["Sit %d cm from the screen and stay there." % int(Lab.settings["distance_cm"]), "A letter E appears in the middle.", "Tap the E button that points the same way.", "Not sure? Take a guess. It's part of the test."]
	instructions = "Testing %s eye(s). If you're testing one eye, cover the other." % str(Lab.settings["eye"]).to_lower()
	# Staircase variable: stroke width in arcmin (E height = 5 strokes). Start at 20/200.
	stair = Staircase.new(10.0, 0.2, 40.0, 1.26, true, 3)


func _begin() -> void:
	var opts := []
	for d in 4:
		opts.append({"id": d, "text": DIR_NAMES[d], "tex": Icons.tex("letter_e", 44, Color.WHITE, d)})
	set_answers(opts, Vector2(110, 110))
	_next()


func _min_stroke_arcmin() -> float:
	return 60.0 / ppd()     # one screen pixel


func _next() -> void:
	if stair.trials >= MAX_TRIALS or stair.reversals.size() >= MAX_REVERSALS:
		end()
		return
	stair.value = maxf(stair.value, _min_stroke_arcmin())
	dir = randi() % 4
	phase = "show"
	set_answers_enabled(true)
	set_status("Letter %d  ·  size %s" % [stair.trials + 1, _snellen(stair.value)])
	queue_redraw()


func _snellen(stroke_arcmin: float) -> String:
	return "20/%d" % int(round(20.0 * stroke_arcmin))


func _on_answer(a: Variant) -> void:
	if phase != "show":
		return
	var ok: bool = int(a) == dir
	stair.record(ok)
	feedback(ok)
	phase = "feedback"
	set_answers_enabled(false)
	queue_redraw()
	after(0.35, _next)


func _on_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo:
		return
	match k.keycode:
		KEY_RIGHT, KEY_D: _on_answer(0)
		KEY_DOWN, KEY_S: _on_answer(1)
		KEY_LEFT, KEY_A: _on_answer(2)
		KEY_UP, KEY_W: _on_answer(3)


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color.WHITE)
	if not started or _ended or phase != "show":
		return
	var letter_px := stair.value * 5.0 / 60.0 * ppd()
	DrawUtil.tumbling_e(self, (size / 2.0 - Vector2(0, 50)).round(), maxf(round(letter_px), 5.0), dir, Color.BLACK)


func _summary() -> Dictionary:
	if stair.trials < 12:
		return {"text": "Too few letters to measure acuity. Try a full session next time."}
	var th := stair.threshold()
	var logmar := log(th) / log(10.0)
	var notes := ""
	if th <= _min_stroke_arcmin() * 1.3:
		notes += "\n\nYou reached the smallest letter this screen can draw. Sit further back (and update the distance in Setup) to measure finer."
	if not Lab.is_calibrated():
		notes += "\n\nYour screen isn't calibrated yet, so this is an estimate."
	return {
		"value": logmar,
		"unit": "logMAR",
		"text": "Your acuity: about %s  (%.2f logMAR)\nEye: %s  ·  distance %d cm%s\n\n20/20 (0.0 logMAR) is typical adult vision; lower numbers are better." % [
			_snellen(th), logmar, Lab.settings["eye"], int(Lab.settings["distance_cm"]), notes],
		"detail": {"snellen": _snellen(th), "distance_cm": Lab.settings["distance_cm"]},
	}
