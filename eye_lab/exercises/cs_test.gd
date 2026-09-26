extends Exercise
## Contrast sensitivity at several spatial frequencies (the curves in the slides).
## A Gabor patch tilts left or right; a staircase finds the faintest contrast you can
## still judge. Run it before and after a few weeks of frequency patching.

const SFS := [1.5, 3.0, 6.0, 12.0]   # cycles per degree
const TRIALS_PER_SF := 18
const STIM_TIME := 0.5
const SF_NAMES := {1.5: "wide", 3.0: "medium", 6.0: "narrow", 12.0: "very fine"}

var sfs: Array = []
var sf_index := 0
var stair: Staircase
var results := {}          # sf -> sensitivity
var tilt := 1
var phase := "idle"        # blank, stim, answer, feedback
var _gabor: ColorRect


func _setup() -> void:
	id = "contrast"
	title = "Contrast sensitivity"
	steps = ["Look at the middle of the grey screen.", "A faint striped patch flashes for a moment.", "Tap which way the stripes lean.", "It gets fainter as you get it right, so guess if you're unsure."]
	instructions = "Four stripe sizes are tested, from wide to very fine. Testing %s eye(s)." % str(Lab.settings["eye"]).to_lower()
	for sf in SFS:
		# Skip frequencies the screen can't draw (need ≥ 4 px per cycle).
		if ppd() / sf >= 4.0:
			sfs.append(sf)
	_gabor = ColorRect.new()
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/grating.gdshader")
	m.set_shader_parameter("gabor", true)
	_gabor.material = m
	_gabor.mouse_filter = MOUSE_FILTER_IGNORE
	_gabor.hide()
	add_child(_gabor)


func _begin() -> void:
	set_answers([
		{"id": -1, "text": "Leans left", "icon": "lean_left", "tip": "Shortcut: ←"},
		{"id": 1, "text": "Leans right", "icon": "lean_right", "tip": "Shortcut: →"},
	], Vector2(150, 110))
	_start_sf()


func _start_sf() -> void:
	if sf_index >= sfs.size():
		end()
		return
	stair = Staircase.new(0.2, 0.002, 1.0, 1.5)
	_next()


func _next() -> void:
	if stair.trials >= TRIALS_PER_SF:
		results[sfs[sf_index]] = 1.0 / stair.threshold()
		sf_index += 1
		_start_sf()
		return
	phase = "blank"
	_gabor.hide()
	set_answers_enabled(false)
	set_status("Stripe size %d of %d (%s)  ·  %d / %d" % [
		sf_index + 1, sfs.size(), SF_NAMES.get(sfs[sf_index], ""), stair.trials + 1, TRIALS_PER_SF])
	queue_redraw()
	after(0.6, _show)


func _show() -> void:
	var side := minf(4.0 * ppd(), size.y * 0.5)
	_gabor.size = Vector2(side, side)
	_gabor.position = ((size - _gabor.size) / 2.0 - Vector2(0, 50)).round()
	tilt = 1 if randf() < 0.5 else -1
	var m := _gabor.material as ShaderMaterial
	m.set_shader_parameter("cycles", sfs[sf_index] * side / ppd())
	m.set_shader_parameter("angle_deg", 45.0 * tilt)
	m.set_shader_parameter("contrast", stair.value)
	m.set_shader_parameter("phase", randf() * TAU)
	_gabor.show()
	phase = "stim"
	set_answers_enabled(true)
	after(STIM_TIME, func():
		_gabor.hide()
		if phase == "stim":
			phase = "answer"
			queue_redraw())


func _on_answer(a: Variant) -> void:
	if phase not in ["stim", "answer"]:
		return
	_gabor.hide()
	var ok: bool = int(a) == tilt
	stair.record(ok)
	feedback(ok)
	phase = "feedback"
	set_answers_enabled(false)
	after(0.3, _next)


func _on_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k and k.pressed and not k.echo:
		if k.keycode in [KEY_RIGHT, KEY_D]:
			_on_answer(1)
		elif k.keycode in [KEY_LEFT, KEY_A]:
			_on_answer(-1)


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.5, 0.5, 0.5))
	if started and not _ended:
		if phase == "blank":
			DrawUtil.fixation(self, size / 2.0 - Vector2(0, 50), 8, Color(0.3, 0.3, 0.3))
		elif phase == "answer":
			draw_prompt("Which way did the stripes lean?", size.y / 2.0 - 50, Color(0.22, 0.22, 0.22))


func _summary() -> Dictionary:
	if results.is_empty():
		return {"text": "Stopped before any stripe size was finished."}
	var lines := []
	var log_sum := 0.0
	var detail := {}
	for sf in results:
		var cs: float = results[sf]
		log_sum += log(cs) / log(10.0)
		detail[str(sf)] = cs
		lines.append("•  %s stripes (%.1f c/°): you saw them down to %.2f%% contrast" % [
			str(SF_NAMES.get(sf, "")).capitalize(), sf, 100.0 / cs])
	var mean_log := log_sum / results.size()
	return {
		"value": mean_log,
		"unit": "mean log CS",
		"text": "\n".join(lines) + "\n\nOverall score: %.2f (higher is better).\nA screen can't show very faint contrast precisely, so compare against your own earlier results, not clinical charts." % mean_log,
		"detail": detail,
	}
