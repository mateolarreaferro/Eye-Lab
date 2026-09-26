extends Exercise
## Sinha-lab "odd one out": triads of disks appear along a winding path anywhere in
## the visual field; click the one that differs. A staircase makes the difference
## smaller as you get better. Modes: color, acuity, orientation, depth (red/cyan glasses).

const TRIALS := 30
const GRATING_CPD := 3.0

var mode := "color"
var stair: Staircase
var trial := 0
var disks: Array = []            # [{pos, r, odd, hue, rot, angle, disp}]
var waiting := false

var _path := PackedVector2Array()
var _grass: Array = []           # [[from, to, color]]
var _gratings: Array[ColorRect] = []
var _anaglyph: Control


func _setup() -> void:
	mode = config.get("mode", "color")
	id = "odd_" + mode
	title = "Odd one out: " + mode.capitalize()
	match mode:
		"color":
			steps = ["Three disks pop up somewhere on the path.", "One of them is a slightly different color.", "Tap the odd one out.", "The colors get closer as you improve."]
			instructions = ""
			stair = Staircase.new(40.0, 0.5, 120.0, 1.5)
		"acuity":
			steps = ["Three disks with a letter E pop up on the path.", "One E points a different way.", "Tap the odd one out.", "The letters shrink as you improve."]
			instructions = ""
			stair = Staircase.new(maxf(ppd() * 0.6, 24.0), 5.0, 200.0, 1.3)
		"orientation":
			steps = ["Three striped disks pop up on the path.", "One disk's stripes are tilted differently.", "Tap the odd one out.", "The tilt gets smaller as you improve."]
			instructions = ""
			stair = Staircase.new(30.0, 0.5, 60.0, 1.5)
			for i in 3:
				var r := ColorRect.new()
				r.material = ShaderMaterial.new()
				(r.material as ShaderMaterial).shader = preload("res://shaders/grating.gdshader")
				r.mouse_filter = MOUSE_FILTER_IGNORE
				r.hide()
				add_child(r)
				_gratings.append(r)
		"depth":
			steps = ["Put on red/cyan 3D glasses, red lens over your LEFT eye.", "Three disks appear.", "One floats in front of or behind the other two.", "Tap the one that's at a different depth."]
			instructions = "This game only works with 3D glasses."
			stair = Staircase.new(12.0, 1.0, 40.0, 1.4)
			_anaglyph = Control.new()
			_anaglyph.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
			_anaglyph.mouse_filter = MOUSE_FILTER_IGNORE
			var m := CanvasItemMaterial.new()
			m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
			_anaglyph.material = m
			_anaglyph.draw.connect(_draw_anaglyph)
			add_child(_anaglyph)


func _begin() -> void:
	_build_path()
	_next()


func _notification(what: int) -> void:
	super(what)
	if what == NOTIFICATION_RESIZED and started:
		_build_path()


func _build_path() -> void:
	_path.clear()
	var w := size.x
	var h := size.y
	for i in 81:
		var t := i / 80.0
		_path.append(Vector2(w * (0.5 + 0.36 * sin(t * TAU * 1.05 + 0.9)), h * (1.02 - 0.97 * t)))
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	_grass.clear()
	for i in 900:
		var p := Vector2(rng.randf() * w, rng.randf() * h)
		var shade := rng.randf_range(-0.12, 0.1)
		_grass.append([p, p + Vector2(rng.randf_range(-3, 3), -rng.randf_range(6, 16)),
			Color(0.3 + shade, 0.58 + shade, 0.18 + shade * 0.5)])


func _path_point(t: float) -> Vector2:
	var f := t * (_path.size() - 1)
	var i := int(f)
	return _path[i].lerp(_path[mini(i + 1, _path.size() - 1)], f - i)


func _next() -> void:
	trial += 1
	if trial > TRIALS:
		end()
		return
	var t := randf_range(0.03, 0.97)
	var r := clampf(ppd() * 0.75, 30.0, 80.0) * lerpf(1.0, 0.55, t)
	if mode == "acuity":
		r = maxf(r * 0.8, stair.value * 0.85 + 6.0)
	var c := _path_point(t) + Vector2(randf_range(-1, 1), randf_range(-1, 1)) * r
	var m := r * 2.3
	c = c.clamp(Vector2(m, m + 70), size - Vector2(m, m + 90))  # stay clear of the filter badge

	var odd := randi() % 3
	var base_hue := randf()
	var base_rot := randi() % 4
	var odd_rot := (base_rot + 1 + randi() % 3) % 4
	var base_angle := randf() * 180.0
	var dir_sign := 1.0 if randf() < 0.5 else -1.0
	var base_disp := randf_range(-4.0, 4.0)
	var offsets := [Vector2(0, -1.0), Vector2(-0.9, 0.55), Vector2(0.9, 0.55)]
	disks.clear()
	for i in 3:
		var is_odd: bool = i == odd
		disks.append({
			"pos": c + offsets[i] * r * 1.15,
			"r": r,
			"odd": is_odd,
			"hue": wrapf(base_hue + (stair.value / 360.0 * dir_sign if is_odd else 0.0), 0.0, 1.0),
			"rot": odd_rot if is_odd else base_rot,
			"angle": base_angle + (stair.value * dir_sign if is_odd else 0.0),
			"disp": base_disp + (stair.value * dir_sign if is_odd else 0.0),
		})
	if mode == "orientation":
		for i in 3:
			var g := _gratings[i]
			var d: Dictionary = disks[i]
			g.position = d["pos"] - Vector2(r, r)
			g.size = Vector2(r, r) * 2.0
			var mat := g.material as ShaderMaterial
			mat.set_shader_parameter("cycles", maxf(2.5, 2.0 * r / ppd() * GRATING_CPD))
			mat.set_shader_parameter("angle_deg", d["angle"])
			mat.set_shader_parameter("phase", randf() * TAU)
			g.show()
	waiting = true
	set_status("Round %d of %d  ·  difference %s" % [trial, TRIALS, _difference_text(stair.value)])
	if _anaglyph:
		_anaglyph.queue_redraw()


func _difference_text(v: float) -> String:
	match mode:
		"color": return "%.1f° hue" % v
		"acuity": return "letter %.0f px (%.1f arcmin)" % [v, v / ppd() * 60.0]
		"orientation": return "%.1f° tilt" % v
		"depth": return "%.0f arcsec" % (v / ppd() * 3600.0)
	return str(v)


func _on_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb == null or not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT or not waiting:
		return
	for d in disks:
		if mb.position.distance_to(d["pos"]) <= d["r"] * 1.1:
			waiting = false
			stair.record(d["odd"])
			feedback(d["odd"])
			after(0.45, _next)
			return


func _draw_scene() -> void:
	if mode == "depth":
		draw_rect(Rect2(Vector2.ZERO, size), Color.BLACK)
		return
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.33, 0.6, 0.2))
	for g in _grass:
		draw_line(g[0], g[1], g[2], 2.0)
	if _path.size() > 1:
		var pw := size.x * 0.075
		draw_polyline(_path, Color(0.55, 0.57, 0.55), pw + 8, true)
		draw_polyline(_path, Color(0.8, 0.82, 0.82), pw, true)
	if not started or _ended:
		return
	for d in disks:
		var p: Vector2 = d["pos"]
		var r: float = d["r"]
		match mode:
			"color":
				draw_circle(p, r, Color.from_hsv(d["hue"], 0.75, 0.78))
			"acuity":
				draw_circle(p, r, Color(0.1, 0.35, 0.25))
				draw_circle(p, r - 3, Color.WHITE)
				DrawUtil.tumbling_e(self, p, stair.value, d["rot"], Color.BLACK)
			"orientation":
				draw_circle(p, r + 3, Color(0.05, 0.05, 0.05))


func _draw_anaglyph() -> void:
	if not started or _ended:
		return
	# Left eye (red lens) sees the red copy; shifting it right brings the disk closer.
	for d in disks:
		var p: Vector2 = d["pos"]
		var half: float = d["disp"] / 2.0
		_anaglyph.draw_circle(p + Vector2(half, 0), d["r"], Color(0.8, 0.0, 0.0))
		_anaglyph.draw_circle(p - Vector2(half, 0), d["r"], Color(0.0, 0.7, 0.8))


func _summary() -> Dictionary:
	if stair.trials < 8:
		return {"text": "Too few trials to estimate a threshold."}
	var th := stair.threshold()
	var value := th
	var unit := ""
	match mode:
		"color": unit = "° hue"
		"acuity":
			value = log(th / 5.0 / ppd() * 60.0) / log(10.0)   # logMAR of the E stroke
			unit = "logMAR"
		"orientation": unit = "° tilt"
		"depth":
			value = th / ppd() * 3600.0
			unit = "arcsec"
	return {
		"value": value,
		"unit": unit,
		"text": "Threshold: %.2f %s\nAccuracy: %d%%   ·   Trophies: %d\n\n(Lower is better.)" % [
			value, unit, int(stair.accuracy() * 100), trophies],
	}
