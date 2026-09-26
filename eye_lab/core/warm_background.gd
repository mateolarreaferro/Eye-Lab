extends Control
## Home backdrop: a warm sunset gradient (orange to pink) with soft rolling hills,
## flat drifting clouds and twinkling four-point sparkles. Calm and flat, no glow.

var _t := 0.0
var _clouds: Array = []    # [x (0..1), y (0..1), scale, speed]
var _sparks: Array = []    # [x, y, size, phase]


func _ready() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	for i in 5:
		_clouds.append([rng.randf(), rng.randf_range(0.82, 0.95), rng.randf_range(0.7, 1.2), rng.randf_range(0.003, 0.008)])
	for i in 9:
		_sparks.append([rng.randf(), rng.randf_range(0.02, 0.2), rng.randf_range(5.0, 11.0), rng.randf() * TAU])


func _process(delta: float) -> void:
	_t += delta
	for c in _clouds:
		c[0] = wrapf(c[0] + c[3] * delta, -0.15, 1.15)
	queue_redraw()


func _draw() -> void:
	var w := size.x
	var h := size.y
	var stops := [Color("ff8f3a"), Color("f6936a"), Color("ee9aba"), Color("e98fd6")]
	var bands := 48
	for i in bands:
		var t := float(i) / (bands - 1)
		var f := t * (stops.size() - 1)
		var k := mini(int(f), stops.size() - 2)
		draw_rect(Rect2(0, h * i / bands, w, h / bands + 1), (stops[k] as Color).lerp(stops[k + 1], f - k))
	# Soft hills.
	_hill(h * 0.84, Color("f3a6d6"), 0.0025, 40, 0.5)
	_hill(h * 0.92, Color("f7b8df"), 0.004, 26, 2.2)
	# Flat clouds.
	for c in _clouds:
		_cloud(Vector2(c[0] * w, c[1] * h), 30.0 * c[2])
	# Sparkles.
	for s in _sparks:
		var tw := 0.55 + 0.45 * sin(_t * 1.6 + s[3])
		_sparkle(Vector2(s[0] * w, s[1] * h), s[2] * tw, Color(1, 1, 1, 0.55 + 0.4 * tw))


func _hill(base_y: float, col: Color, freq: float, amp: float, phase: float) -> void:
	var pts := PackedVector2Array()
	var x := 0.0
	while x <= size.x + 24:
		pts.append(Vector2(x, base_y - amp * sin(x * freq + phase)))
		x += 24.0
	pts.append(Vector2(size.x + 24, size.y))
	pts.append(Vector2(0, size.y))
	draw_colored_polygon(pts, col)


## Flat cloud: the upper outline of three overlapping circles on a flat base,
## pale mint on top with a slightly deeper band underneath.
func _cloud(p: Vector2, s: float) -> void:
	var bumps: Array[Vector2] = [Vector2(-0.9, 0.75), Vector2(0.2, 1.1), Vector2(1.3, 0.7)]   # (x offset, radius) × s
	var x0 := p.x + (bumps[0].x - bumps[0].y) * s
	var x1 := p.x + (bumps[2].x + bumps[2].y) * s
	var pts := PackedVector2Array()
	var x := x0
	while x <= x1:
		var y := p.y
		for b in bumps:
			var dx: float = x - (p.x + b.x * s)
			var r: float = b.y * s
			if absf(dx) < r:
				y = minf(y, p.y - sqrt(r * r - dx * dx))
		pts.append(Vector2(x, y))
		x += s / 10.0
	pts.append(Vector2(x1, p.y))
	pts.append(Vector2(x0, p.y))
	draw_colored_polygon(pts, Color("c9f1ec"))
	var band := s * 0.22
	draw_rect(Rect2(x0, p.y, x1 - x0, band), Color("a9e3dc"))
	draw_circle(Vector2(x1, p.y + band / 2.0), band / 2.0, Color("a9e3dc"))
	draw_circle(Vector2(x0, p.y + band / 2.0), band / 2.0, Color("a9e3dc"))


static func sparkle_points(c: Vector2, r: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 8:
		var a := -PI / 2 + i * PI / 4
		pts.append(c + Vector2(cos(a), sin(a)) * (r if i % 2 == 0 else r * 0.28))
	return pts


func _sparkle(c: Vector2, r: float, col: Color) -> void:
	draw_colored_polygon(sparkle_points(c, r), col)
