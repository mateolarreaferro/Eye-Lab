extends Control
## Warm sunset gradient (orange to pink) with a few soft light fields drifting
## slowly across it; the tones gently shift over time.

const PALETTE_A := [Color("ffb36b"), Color("ffc38f"), Color("f7a6c4"), Color("ffd08a")]
const PALETTE_B := [Color("ffc59a"), Color("f9b1c9"), Color("ffbe86"), Color("f6b3d6")]

var _t := 0.0
var _glow: Texture2D


func _ready() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE
	_glow = UI.radial_texture(Color.WHITE, Color(1, 1, 1, 0), 256)


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func _draw() -> void:
	var w := size.x
	var h := size.y
	var top := Color("ff8f3f").lerp(Color("fb9557"), 0.5 + 0.5 * sin(_t * 0.05))
	var bottom := Color("ec94c8").lerp(Color("f19aba"), 0.5 + 0.5 * cos(_t * 0.04))
	var bands := 24
	for i in bands:
		var t := float(i) / bands
		draw_rect(Rect2(0, h * t, w, h / bands + 1), top.lerp(bottom, t))
	var mix := 0.5 + 0.5 * sin(_t * 0.07)
	var big := maxf(w, h)
	for i in PALETTE_A.size():
		var c: Color = (PALETTE_A[i] as Color).lerp(PALETTE_B[i], mix)
		var phase := i * 1.7
		var p := Vector2(
			w * (0.5 + 0.42 * sin(_t * (0.045 + i * 0.011) + phase)),
			h * (0.5 + 0.42 * cos(_t * (0.038 + i * 0.009) + phase * 1.3)))
		var r := big * (0.42 + 0.06 * sin(_t * 0.09 + i))
		draw_texture_rect(_glow, Rect2(p - Vector2(r, r), Vector2(r, r) * 2), false, Color(c, 0.35))

