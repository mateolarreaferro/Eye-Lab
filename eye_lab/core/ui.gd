class_name UI
## Shared look: palette, theme, fonts and button factories.

const BG := Color("120e26")
const SURFACE := Color("1c1738")
const SURFACE_2 := Color("272048")
const SURFACE_3 := Color("342b5c")
const TEXT := Color("f3f0ff")
const MUTED := Color("a39cc4")
const BLUE := Color("4fa3ff")
const GREEN := Color("5fd068")
const PURPLE := Color("b07cff")
const ORANGE := Color("ff9f43")
const RED := Color("ff5d73")
const YELLOW := Color("ffd23f")

# Apple system colours (light appearance).
const LABEL := Color("2d2a32")
const LABEL_2 := Color("7a7080")
const LABEL_3 := Color("b8b0bd")
const FILL := Color(0.47, 0.47, 0.5, 0.12)
const SEPARATOR := Color(0, 0, 0, 0.08)
const SYS_BLUE := Color("4a7cf5")
const SYS_GREEN := Color("2fb88f")
const SYS_INDIGO := Color("8e6cef")
const SYS_PURPLE := Color("8e6cef")
const SYS_ORANGE := Color("f47d31")
const ACCENT := Color("f47d31")        # Headspace orange: primary actions
const SYS_PINK := Color("f06fa6")
const SYS_TEAL := Color("30b0c7")

static var _fonts := {}


static var _theme: Theme


## macOS system font (SF, a variable font); heavier weights set its "wght" axis.
static func font(weight := 400) -> Font:
	if not _fonts.has(weight):
		if not _fonts.has(400):
			_fonts[400] = _base_font()
		if weight != 400:
			var v := FontVariation.new()
			v.base_font = _fonts[400]
			v.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): weight}
			_fonts[weight] = v
	return _fonts[weight]


## SF Pro (the macOS system font, a variable font) so weights map to its "wght" axis.
static func _base_font() -> Font:
	const SF := "/System/Library/Fonts/SFNS.ttf"
	if FileAccess.file_exists(SF):
		var ff := FontFile.new()
		if ff.load_dynamic_font(SF) == OK:
			ff.antialiasing = TextServer.FONT_ANTIALIASING_GRAY
			var sys := SystemFont.new()
			sys.font_names = PackedStringArray([".AppleSystemUIFont"])
			ff.fallbacks = [sys]
			return ff
	var base := SystemFont.new()
	base.font_names = PackedStringArray(["Arial Rounded MT Bold", ".AppleSystemUIFont", "Helvetica Neue", "Arial"])
	base.antialiasing = TextServer.FONT_ANTIALIASING_GRAY
	return base


## The shared theme. Set on the window and on overlay roots inside CanvasLayers,
## which don't inherit the window theme.
static func theme() -> Theme:
	if _theme == null:
		_theme = make_theme()
	return _theme


static func box(col: Color, radius := 12, margin := 12, border := Color.TRANSPARENT) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(margin)
	sb.anti_aliasing = true
	if border.a > 0.0:
		sb.border_color = border
		sb.set_border_width_all(2)
	return sb


static func make_theme() -> Theme:
	var t := Theme.new()
	t.default_font = font(400)
	t.default_font_size = 16

	t.set_color("font_color", "Label", TEXT)

	var bpad := func(sb: StyleBoxFlat) -> StyleBoxFlat:
		sb.content_margin_left = 16
		sb.content_margin_right = 16
		sb.content_margin_top = 10
		sb.content_margin_bottom = 10
		return sb
	t.set_stylebox("normal", "Button", bpad.call(box(SURFACE_2, 12)))
	t.set_stylebox("hover", "Button", bpad.call(box(SURFACE_3, 12)))
	t.set_stylebox("pressed", "Button", bpad.call(box(BLUE.darkened(0.35), 12)))
	t.set_stylebox("hover_pressed", "Button", bpad.call(box(BLUE.darkened(0.25), 12)))
	t.set_stylebox("disabled", "Button", bpad.call(box(SURFACE_2.darkened(0.2), 12)))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	t.set_color("font_color", "Button", TEXT)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", MUTED.darkened(0.3))
	t.set_color("icon_normal_color", "Button", TEXT)
	t.set_color("icon_hover_color", "Button", Color.WHITE)
	t.set_color("icon_pressed_color", "Button", Color.WHITE)
	t.set_constant("h_separation", "Button", 10)

	t.set_stylebox("panel", "PanelContainer", box(SURFACE, 18, 22))
	t.set_stylebox("panel", "PopupMenu", box(SURFACE_2, 10, 8))
	t.set_stylebox("hover", "PopupMenu", box(SURFACE_3, 8, 6))
	t.set_color("font_color", "PopupMenu", TEXT)

	var bar_bg := box(SURFACE_3, 6, 0)
	var bar_fill := box(GREEN, 6, 0)
	t.set_stylebox("background", "ProgressBar", bar_bg)
	t.set_stylebox("fill", "ProgressBar", bar_fill)

	var slider := box(SURFACE_3, 4, 0)
	slider.content_margin_top = 3
	slider.content_margin_bottom = 3
	t.set_stylebox("slider", "HSlider", slider)
	var area := box(BLUE, 4, 0)
	area.content_margin_top = 3
	area.content_margin_bottom = 3
	t.set_stylebox("grabber_area", "HSlider", area)
	t.set_stylebox("grabber_area_highlight", "HSlider", area)
	t.set_icon("grabber", "HSlider", _dot(9, Color.WHITE))
	t.set_icon("grabber_highlight", "HSlider", _dot(10, Color.WHITE))

	t.set_color("font_color", "TooltipLabel", TEXT)
	t.set_stylebox("panel", "TooltipPanel", box(SURFACE_3, 8, 8))
	return t


static func _dot(r: int, col: Color) -> Texture2D:
	var s := Lab.ui_scale()
	var n := int(ceil(r * 2 * s))
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var c := Vector2(n, n) / 2.0
	for y in n:
		for x in n:
			var d := Vector2(x + 0.5, y + 0.5).distance_to(c)
			img.set_pixel(x, y, Color(col, clampf(r * s - d + 0.5, 0.0, 1.0)))
	var t := ImageTexture.create_from_image(img)
	t.set_size_override(Vector2i(r * 2, r * 2))
	return t


static func label(text: String, size := 16, col := TEXT, weight := 400, wrap := false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	if weight != 400:
		l.add_theme_font_override("font", font(weight))
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


## kind: "primary" (filled accent), "secondary" (surface), "ghost" (transparent).
static func button(text: String, icon := "", kind := "secondary", accent := BLUE, font_size := 16) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.add_theme_font_size_override("font_size", font_size)
	b.add_theme_font_override("font", font(600))
	if icon != "":
		b.icon = Icons.tex(icon, font_size + 4, Color.WHITE)
	match kind:
		"secondary":
			_style(b, SURFACE_2, SURFACE_3, BLUE.darkened(0.35))
		"primary":
			_style(b, accent, accent.lightened(0.12), accent.darkened(0.15))
		"ghost":
			_style(b, Color(1, 1, 1, 0.0), Color(1, 1, 1, 0.08), Color(1, 1, 1, 0.14))
		"danger":
			_style(b, RED.darkened(0.2), RED, RED.darkened(0.35))
	return b


## Large answer button with the icon above the label.
static func choice(text: String, icon := "", accent := BLUE, icon_tex: Texture2D = null, size := Vector2(120, 104)) -> Button:
	var b := button(text, "", "secondary", accent, 15)
	b.custom_minimum_size = size
	b.icon = icon_tex if icon_tex else (Icons.tex(icon, 40, Color.WHITE) if icon != "" else null)
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	b.add_theme_font_override("font", font(500))
	_style(b, Color(0.11, 0.11, 0.13, 0.72), Color(0.2, 0.2, 0.24, 0.8), accent.darkened(0.1), 18)
	add_press_feel(b)
	return b


static func _style(b: Button, normal: Color, hover: Color, pressed: Color, radius := 12) -> void:
	for pair in [["normal", normal], ["hover", hover], ["pressed", pressed], ["hover_pressed", pressed]]:
		var sb := box(pair[1], radius)
		sb.content_margin_left = 16
		sb.content_margin_right = 16
		sb.content_margin_top = 10
		sb.content_margin_bottom = 10
		b.add_theme_stylebox_override(pair[0], sb)


## Round tinted bubble holding an icon, used on menu cards and cards.
static func icon_bubble(icon: String, accent: Color, d := 52.0) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := box(Color(accent, 0.18), int(d / 2.0), 0)
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(d, d)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tr := TextureRect.new()
	tr.texture = Icons.tex(icon, d * 0.5, accent)
	tr.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(tr)
	return p


static func pill(content: Control, alpha := 0.72) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := box(Color(SURFACE.r, SURFACE.g, SURFACE.b, alpha), 14, 10)
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	p.add_theme_stylebox_override("panel", sb)
	p.add_child(content)
	return p


static var _tex_cache := {}


## Radial gradient from `inner` at the centre to `outer` at the edge (for glows).
static func radial_texture(inner: Color, outer: Color, px := 128) -> Texture2D:
	var key := "r%s%s%d" % [inner.to_html(), outer.to_html(), px]
	if not _tex_cache.has(key):
		var g := Gradient.new()
		g.set_color(0, inner)
		g.set_color(1, outer)
		g.add_point(0.35, Color(inner, inner.a * 0.45))
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		t.width = px
		t.height = px
		_tex_cache[key] = t
	return _tex_cache[key]


## Shaded sphere: light from the upper left, deep colour at the far edge.
static func sphere_texture(col: Color, depth := 0.55) -> Texture2D:
	var key := "s%s%.2f" % [col.to_html(), depth]
	if not _tex_cache.has(key):
		var g := Gradient.new()
		g.set_color(0, col.lightened(0.55))
		g.set_color(1, col.darkened(depth))
		g.add_point(0.45, col)
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.36, 0.3)
		t.fill_to = Vector2(1.05, 0.95)
		t.width = 256
		t.height = 256
		_tex_cache[key] = t
	return _tex_cache[key]


## Frosted glass card: translucent fill, hairline border, optional coloured glow.
static func glass(alpha := 0.06, radius := 24, border_alpha := 0.1, glow_color := Color.TRANSPARENT, glow_size := 0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, alpha)
	sb.set_corner_radius_all(radius)
	sb.border_color = Color(1, 1, 1, border_alpha)
	sb.set_border_width_all(1)
	sb.anti_aliasing = true
	sb.set_content_margin_all(16)
	if glow_size > 0:
		sb.shadow_color = glow_color
		sb.shadow_size = glow_size
	return sb


## iOS-style capsule button.
## style: "filled" (accent fill, white text), "tinted" (accent-tinted fill),
## "gray" (neutral fill), "plain" (text only).
static func apple_button(text: String, icon := "", style := "filled", color := SYS_BLUE, font_size := 15, height := 40.0) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.add_theme_font_size_override("font_size", font_size)
	b.add_theme_font_override("font", font(600))
	b.custom_minimum_size = Vector2(height if text == "" else 0.0, height)
	var fg := Color.WHITE
	var bg := color
	match style:
		"tinted":
			fg = color
			bg = Color(color, 0.14)
		"gray":
			fg = LABEL
			bg = FILL
		"plain":
			fg = color
			bg = Color(0, 0, 0, 0)
	if icon != "":
		b.icon = Icons.tex(icon, font_size + 3, Color.WHITE)
	for key in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color",
			"icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_hover_pressed_color"]:
		b.add_theme_color_override(key, fg)
	b.add_theme_color_override("font_disabled_color", Color(fg, 0.4))
	b.add_theme_color_override("icon_disabled_color", Color(fg, 0.4))
	for st in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		var c := bg
		if st == "hover":
			c = bg.lightened(0.08) if style == "filled" else Color(bg, bg.a + 0.06)
		elif st.contains("pressed"):
			c = bg.darkened(0.12) if style == "filled" else Color(bg, bg.a + 0.12)
		elif st == "disabled":
			c = Color(bg, bg.a * 0.5)
		var sb := box(c, int(height / 2.0), 0)
		sb.content_margin_left = 14.0 if text == "" else 18.0
		sb.content_margin_right = 14.0 if text == "" else 18.0
		b.add_theme_stylebox_override(st, sb)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	return b


## iOS Settings-style icon tile: rounded square in `color` with a white glyph.
static func icon_tile(icon: String, color: Color, side := 40.0) -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(side, side)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_theme_stylebox_override("panel", box(color, int(side * 0.28), 0))
	var tr := TextureRect.new()
	tr.texture = Icons.tex(icon, side * 0.56, Color.WHITE)
	tr.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(tr)
	return p


## Frosted-glass panel (see core/glass_panel.gd).
static func glass_panel(radius := 20.0, padding := 16, tint := Color(1, 1, 1, 0.7), shadow := false) -> GlassPanel:
	var g := GlassPanel.new()
	g.radius = radius
	g.padding = padding
	g.tint = tint
	g.shadow = shadow
	return g


## iOS-like press feedback: shrink slightly on press, spring back on release.
static func add_press_feel(b: BaseButton, hover_scale := 1.0) -> void:
	b.resized.connect(func(): b.pivot_offset = b.size / 2.0)
	var to := func(s: float, t := 0.14):
		var tw := b.create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tw.tween_property(b, "scale", Vector2(s, s), t)
	b.button_down.connect(func(): to.call(0.97, 0.08))
	b.button_up.connect(func(): to.call(hover_scale if b.is_hovered() else 1.0, 0.25))
	if hover_scale != 1.0:
		b.mouse_entered.connect(func(): to.call(hover_scale))
		b.mouse_exited.connect(func(): to.call(1.0))
