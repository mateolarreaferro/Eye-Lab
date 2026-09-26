class_name Icons
## Line icons (24×24, Lucide-style) rasterised from SVG at the screen's backing scale,
## tinted per use and cached.

const _HEAD := "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">"
const _CLIP := "<defs><clipPath id=\"c\"><circle cx=\"12\" cy=\"12\" r=\"9\"/></clipPath></defs>"

const SVG := {
	"eye": "<path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
	"letter_e": "<path fill=\"currentColor\" stroke=\"none\" d=\"M5 4h14v3.2H8.4v3.2H17v3.2H8.4v3.2H19V20H5z\"/>",
	"contrast": _CLIP + "<g clip-path=\"url(#c)\" stroke-width=\"2.4\"><path d=\"M7 2v20M12 2v20M17 2v20\" stroke-opacity=\"0.55\"/></g><circle cx=\"12\" cy=\"12\" r=\"9\"/>",
	"target": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1.2\" fill=\"currentColor\"/>",
	"palette": "<circle cx=\"8\" cy=\"9\" r=\"4\"/><circle cx=\"16\" cy=\"9\" r=\"4\"/><circle cx=\"12\" cy=\"16.5\" r=\"4\" fill=\"currentColor\"/>",
	"stripes": _CLIP + "<g clip-path=\"url(#c)\"><path d=\"M4 0l-4 24M10 0L6 24M16 0l-4 24M22 0l-4 24\"/></g><circle cx=\"12\" cy=\"12\" r=\"9\"/>",
	"lean_left": _CLIP + "<g clip-path=\"url(#c)\" stroke-width=\"2.6\"><path d=\"M-3 0l12 24M3 0l12 24M9 0l12 24M15 0l12 24\"/></g><circle cx=\"12\" cy=\"12\" r=\"9\"/>",
	"lean_right": _CLIP + "<g clip-path=\"url(#c)\" stroke-width=\"2.6\"><path d=\"M27 0L15 24M21 0L9 24M15 0L3 24M9 0L-3 24\"/></g><circle cx=\"12\" cy=\"12\" r=\"9\"/>",
	"glasses": "<circle cx=\"6.5\" cy=\"14\" r=\"3.5\"/><circle cx=\"17.5\" cy=\"14\" r=\"3.5\"/><path d=\"M10 14h4M3 14l2-7h2M21 14l-2-7h-2\"/>",
	"sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/>",
	"pin": "<path d=\"M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z\"/><circle cx=\"12\" cy=\"9.5\" r=\"2.5\"/>",
	"move": "<path d=\"M4 12h16M16 8l4 4-4 4M8 8l-4 4 4 4\"/>",
	"dots": "<circle cx=\"6\" cy=\"7\" r=\"2.5\"/><circle cx=\"18\" cy=\"6\" r=\"2.5\"/><circle cx=\"9\" cy=\"18\" r=\"2.5\"/><circle cx=\"18\" cy=\"17\" r=\"2.5\" fill=\"currentColor\"/><path d=\"M9 9.5l1.5 2M15 7l-3 .5M12 18h3\" stroke-dasharray=\"1 2\"/>",
	"search": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M21 21l-4.3-4.3\"/>",
	"pong": "<path d=\"M4 5v8M20 11v8M12 3v2M12 9v2M12 15v2M12 21v0\"/><rect x=\"14.5\" y=\"6.5\" width=\"3\" height=\"3\" fill=\"currentColor\"/>",
	"camera": "<path d=\"M3 8.5a2 2 0 0 1 2-2h2.2L9 4h6l1.8 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><circle cx=\"12\" cy=\"13\" r=\"3.5\"/>",
	"image": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"2\"/><path d=\"M21 16l-5-5-9 9\"/>",
	"shelf": "<path d=\"M3 21h18M4 21V3h16v18M4 12h16\"/><circle cx=\"8.5\" cy=\"9\" r=\"2\"/><rect x=\"13\" y=\"6\" width=\"4\" height=\"5\"/><path d=\"M7 20l2.5-4 2.5 4M14 20v-4h3v4\"/>",
	"card": "<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M2 10h20M6 15h4\"/>",
	"arrow_left": "<path d=\"M19 12H5M12 19l-7-7 7-7\"/>",
	"x": "<path d=\"M18 6L6 18M6 6l12 12\"/>",
	"play": "<path d=\"M7 4.5l12 7.5-12 7.5z\" fill=\"currentColor\"/>",
	"check": "<path d=\"M20 6L9 17l-5-5\"/>",
	"replay": "<path d=\"M3 12a9 9 0 1 0 2.6-6.4L3 8\"/><path d=\"M3 3v5h5\"/>",
	"minus": "<path d=\"M5 12h14\"/>",
	"plus": "<path d=\"M12 5v14M5 12h14\"/>",
	"trophy": "<path d=\"M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z\"/><path d=\"M17 5.5h3V7a3 3 0 0 1-3 3M7 5.5H4V7a3 3 0 0 0 3 3\"/>",
	"clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
	"chart": "<path d=\"M3 3v18h18\"/><path d=\"M7 15l4-4 3 3 5-6\"/>",
	"settings": "<path d=\"M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0\"/><circle cx=\"16\" cy=\"6\" r=\"2\"/><circle cx=\"10\" cy=\"12\" r=\"2\"/><circle cx=\"18\" cy=\"18\" r=\"2\"/>",
	"chevron_up": "<path d=\"M6 15l6-6 6 6\"/>",
	"chevron_down": "<path d=\"M6 9l6 6 6-6\"/>",
	"hide": "<path d=\"M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6\"/><path d=\"M9.9 9.9a3 3 0 0 0 4.2 4.2\"/>",
	"monitor": "<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M8 21h8M12 17v4\"/>",
	"chat": "<path d=\"M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z\"/>",
	"send": "<path d=\"M22 2L11 13M22 2l-7 20-4-9-9-4z\"/>",
	"flame": "<path d=\"M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 7 0 5 3 9 7 9z\"/>",
	"user": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>",
	"lock": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"/>",
	"medal": "<circle cx=\"12\" cy=\"15\" r=\"6\"/><path d=\"M8.5 10L6 2h4l2 5 2-5h4l-2.5 8\"/>",
	"key": "<circle cx=\"8\" cy=\"15\" r=\"4\"/><path d=\"M11 12l9-9M17 6l3 3M15 8l2 2\"/>",
	"gamepad": "<rect x=\"2\" y=\"7\" width=\"20\" height=\"11\" rx=\"5\"/><path d=\"M7 11v3M5.5 12.5h3M15 12h.01M18 13.5h.01\"/>",
	# Vision filters
	"filter_off": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M5.6 5.6l12.8 12.8\"/>",
	"high_pass": "<path d=\"M3 19h5c3.5 0 4-13 8-13h5\"/><path d=\"M3 22h18\" stroke-opacity=\"0.35\"/>",
	"low_pass": "<path d=\"M3 6h5c4 0 4.5 13 8 13h5\"/><path d=\"M3 22h18\" stroke-opacity=\"0.35\"/>",
	"edges": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" stroke-dasharray=\"3 2.6\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
	"invert": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 3a9 9 0 0 0 0 18z\" fill=\"currentColor\"/>",
	"kaleido": "<path d=\"M12 2l2.6 6.4L21 9l-5 4.4L17.6 21 12 17.3 6.4 21 8 13.4 3 9l6.4-.6z\"/>",
}

static var _cache := {}


## Texture of `name` at `px` logical pixels, drawn in `color`.
## rot turns the icon in 90° steps (used for the tumbling-E answer buttons).
static func tex(name: String, px := 24.0, color := Color.WHITE, rot := 0) -> Texture2D:
	var key := "%s|%d|%s|%d" % [name, int(px), color.to_html(), rot]
	if _cache.has(key):
		return _cache[key]
	var body: String = SVG.get(name, SVG["eye"])
	if rot != 0:
		body = "<g transform=\"rotate(%d 12 12)\">%s</g>" % [rot * 90, body]
	var src := (_HEAD + body + "</svg>").replace("currentColor", "#" + color.to_html(false))
	if color.a < 1.0:
		src = src.replace("<svg ", "<svg opacity=\"%.2f\" " % color.a)
	var img := Image.new()
	var scale := px * Lab.ui_scale() / 24.0
	img.load_svg_from_string(src, scale)
	var t := ImageTexture.create_from_image(img)
	t.set_size_override(Vector2i(int(px), int(px)))
	_cache[key] = t
	return t
