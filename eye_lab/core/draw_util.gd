class_name DrawUtil
## Stimulus drawing shared by the exercises.

const SHAPES := ["circle", "square", "triangle", "diamond", "star", "cross", "ring", "hexagon"]


## Tumbling E. dir: 0 = opening right, 1 = down, 2 = left, 3 = up.
static func tumbling_e(ci: CanvasItem, center: Vector2, size: float, dir: int, col: Color) -> void:
	var u := size / 5.0
	ci.draw_set_transform(center, dir * PI / 2.0, Vector2.ONE)
	var o := Vector2(-size / 2.0, -size / 2.0)
	ci.draw_rect(Rect2(o, Vector2(u, size)), col)
	for row in [0, 2, 4]:
		ci.draw_rect(Rect2(o + Vector2(0, row * u), Vector2(size, u)), col)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


static func star_points(center: Vector2, r_out: float, r_in: float, n: int, rot := -PI / 2.0) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n * 2:
		var r := r_out if i % 2 == 0 else r_in
		var a := rot + i * PI / n
		pts.append(center + Vector2(cos(a), sin(a)) * r)
	return pts


static func regular_points(center: Vector2, r: float, n: int, rot := -PI / 2.0) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n:
		var a := rot + i * TAU / n
		pts.append(center + Vector2(cos(a), sin(a)) * r)
	return pts


## The yellow "spot of light" from the slides.
static func sun(ci: CanvasItem, c: Vector2, r: float) -> void:
	ci.draw_colored_polygon(star_points(c, r, r * 0.55, 8), Color(1.0, 0.72, 0.05))
	ci.draw_circle(c, r * 0.38, Color.WHITE)


static func trophy(ci: CanvasItem, c: Vector2, s: float) -> void:
	var gold := Color(0.98, 0.76, 0.2)
	ci.draw_colored_polygon(PackedVector2Array([
		c + Vector2(-s * 0.45, -s * 0.5), c + Vector2(s * 0.45, -s * 0.5),
		c + Vector2(s * 0.3, 0), c + Vector2(-s * 0.3, 0)]), gold)
	ci.draw_arc(c + Vector2(-s * 0.42, -s * 0.3), s * 0.16, PI / 2, PI * 1.5, 8, gold, maxf(1.0, s * 0.07))
	ci.draw_arc(c + Vector2(s * 0.42, -s * 0.3), s * 0.16, -PI / 2, PI / 2, 8, gold, maxf(1.0, s * 0.07))
	ci.draw_rect(Rect2(c + Vector2(-s * 0.06, 0), Vector2(s * 0.12, s * 0.28)), gold)
	ci.draw_rect(Rect2(c + Vector2(-s * 0.25, s * 0.28), Vector2(s * 0.5, s * 0.14)), gold.darkened(0.2))


static func shape(ci: CanvasItem, kind: String, c: Vector2, r: float, col: Color) -> void:
	match kind:
		"circle":
			ci.draw_circle(c, r, col)
		"square":
			ci.draw_rect(Rect2(c - Vector2(r, r) * 0.85, Vector2(r, r) * 1.7), col)
		"triangle":
			ci.draw_colored_polygon(regular_points(c + Vector2(0, r * 0.15), r * 1.1, 3), col)
		"diamond":
			ci.draw_colored_polygon(regular_points(c, r * 1.05, 4), col)
		"star":
			ci.draw_colored_polygon(star_points(c, r * 1.1, r * 0.48, 5), col)
		"cross":
			ci.draw_rect(Rect2(c - Vector2(r, r * 0.33), Vector2(r * 2, r * 0.66)), col)
			ci.draw_rect(Rect2(c - Vector2(r * 0.33, r), Vector2(r * 0.66, r * 2)), col)
		"ring":
			ci.draw_arc(c, r * 0.78, 0, TAU, 32, col, r * 0.44, true)
		"hexagon":
			ci.draw_colored_polygon(regular_points(c, r, 6, 0.0), col)


static func fixation(ci: CanvasItem, c: Vector2, s: float, col := Color.WHITE) -> void:
	ci.draw_line(c - Vector2(s, 0), c + Vector2(s, 0), col, 2.0)
	ci.draw_line(c - Vector2(0, s), c + Vector2(0, s), col, 2.0)
