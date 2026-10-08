class_name UI
## Shared look: palette, theme, fonts and button factories.

# One palette for the whole app: dark ink on white cards over the sunset gradient,
# a single orange accent for actions, and four section hues that run from sunset
# to dusk so they sit with the background instead of fighting it.
const LABEL := Color("2d2a32")         # primary text (ink)
const LABEL_2 := Color("7a7080")       # secondary text
const LABEL_3 := Color("b8b0bd")       # hints, disabled
const FILL := Color(0.47, 0.42, 0.5, 0.12)     # neutral control fill
const SEPARATOR := Color(0, 0, 0, 0.08)
const CARD := Color(1, 1, 1, 0.94)     # white card on the gradient
const SHEET := Color("faf8f7")         # modal sheet background
const DIM := Color(0.3, 0.12, 0.18, 0.16)      # warm scrim behind sheets and cards

const ACCENT := Color("f47d31")        # primary actions, toggles, sliders
const CORAL := Color("ec6448")         # Eye check-up
const ROSE := Color("de4f86")          # Spot the odd one
const PLUM := Color("9156c4")          # Brain games
const INDIGO := Color("5160d4")        # Magic glasses
const GOLD := Color("f2a516")          # trophies
const SUCCESS := Color("2fa37f")       # done, calibrated, goal met

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

	t.set_color("font_color", "Label", LABEL)

	var bpad := func(sb: StyleBoxFlat) -> StyleBoxFlat:
		sb.content_margin_left = 16
		sb.content_margin_right = 16
		sb.content_margin_top = 10
		sb.content_margin_bottom = 10
		return sb
	t.set_stylebox("normal", "Button", bpad.call(box(FILL, 12)))
	t.set_stylebox("hover", "Button", bpad.call(box(Color(FILL, 0.2), 12)))
	t.set_stylebox("pressed", "Button", bpad.call(box(Color(FILL, 0.28), 12)))
	t.set_stylebox("hover_pressed", "Button", bpad.call(box(Color(FILL, 0.28), 12)))
	t.set_stylebox("disabled", "Button", bpad.call(box(Color(FILL, 0.06), 12)))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	for key in ["font_color", "font_hover_color", "font_pressed_color", "icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		t.set_color(key, "Button", LABEL)
	t.set_color("font_disabled_color", "Button", LABEL_3)
	t.set_constant("h_separation", "Button", 10)

	t.set_stylebox("panel", "PanelContainer", box(Color.WHITE, 18, 22))
	t.set_stylebox("panel", "PopupMenu", box(Color.WHITE, 10, 8))
	t.set_stylebox("hover", "PopupMenu", box(Color(ACCENT, 0.12), 8, 6))
	t.set_color("font_color", "PopupMenu", LABEL)
	t.set_color("font_hover_color", "PopupMenu", LABEL)

	t.set_stylebox("background", "ProgressBar", box(Color(0, 0, 0, 0.08), 6, 0))
	t.set_stylebox("fill", "ProgressBar", box(ACCENT, 6, 0))

	var slider := box(Color(0, 0, 0, 0.1), 3, 0)
	slider.content_margin_top = 2
	slider.content_margin_bottom = 2
	t.set_stylebox("slider", "HSlider", slider)
	var area := box(ACCENT, 3, 0)
	area.content_margin_top = 2
	area.content_margin_bottom = 2
	t.set_stylebox("grabber_area", "HSlider", area)
	t.set_stylebox("grabber_area_highlight", "HSlider", area)
	t.set_icon("grabber", "HSlider", _knob(10))
	t.set_icon("grabber_highlight", "HSlider", _knob(11))

	t.set_color("font_color", "TooltipLabel", LABEL)
	t.set_stylebox("panel", "TooltipPanel", box(Color.WHITE, 8, 8))

	var field := box(FILL, 10, 10)
	field.content_margin_left = 12
	field.content_margin_right = 12
	var field_focus := box(Color.WHITE, 10, 10, ACCENT)
	field_focus.set_border_width_all(1)
	field_focus.content_margin_left = 12
	field_focus.content_margin_right = 12
	t.set_stylebox("normal", "LineEdit", field)
	t.set_stylebox("focus", "LineEdit", field_focus)
	t.set_color("font_color", "LineEdit", LABEL)
	t.set_color("font_placeholder_color", "LineEdit", LABEL_3)
	t.set_color("caret_color", "LineEdit", ACCENT)
	t.set_color("selection_color", "LineEdit", Color(ACCENT, 0.25))
	return t


## White slider knob with a faint outline so it reads on white cards.
static func _knob(r: int) -> Texture2D:
	var s := Lab.ui_scale()
	var n := int(ceil(r * 2 * s))
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var c := Vector2(n, n) / 2.0
	for y in n:
		for x in n:
			var d := Vector2(x + 0.5, y + 0.5).distance_to(c)
			var a := clampf(r * s - d + 0.5, 0.0, 1.0)
			var rim := clampf(d - (r - 1.0) * s + 0.5, 0.0, 1.0)
			img.set_pixel(x, y, Color(Color.WHITE.lerp(Color(0.78, 0.75, 0.8), rim), a))
	var t := ImageTexture.create_from_image(img)
	t.set_size_override(Vector2i(r * 2, r * 2))
	return t


static func label(text: String, size := 16, col := LABEL, weight := 400, wrap := false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	if weight != 400:
		l.add_theme_font_override("font", font(weight))
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


## Large answer button with the icon above the label: a white card with ink text,
## tinted with the game's colour while pressed. Sits above the filter, so it stays
## readable over any stimulus.
static func choice(text: String, icon := "", accent := ACCENT, icon_tex: Texture2D = null, size := Vector2(120, 104)) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.add_theme_font_size_override("font_size", 15)
	b.add_theme_font_override("font", font(600))
	b.custom_minimum_size = size
	b.icon = icon_tex if icon_tex else (Icons.tex(icon, 40, Color.WHITE) if icon != "" else null)
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	for key in ["font_color", "font_hover_color", "icon_normal_color", "icon_hover_color"]:
		b.add_theme_color_override(key, LABEL)
	for key in ["font_pressed_color", "font_hover_pressed_color", "icon_pressed_color", "icon_hover_pressed_color"]:
		b.add_theme_color_override(key, accent.darkened(0.2))
	b.add_theme_color_override("font_disabled_color", LABEL_3)
	b.add_theme_color_override("icon_disabled_color", LABEL_3)
	var looks := {"normal": CARD, "hover": Color.WHITE, "pressed": Color.WHITE.lerp(accent, 0.14),
		"hover_pressed": Color.WHITE.lerp(accent, 0.14), "disabled": Color(1, 1, 1, 0.6)}
	for st in looks:
		var sb := box(looks[st], 18)
		sb.content_margin_left = 16
		sb.content_margin_right = 16
		sb.content_margin_top = 12
		sb.content_margin_bottom = 10
		sb.shadow_color = Color(0, 0, 0, 0.1)
		sb.shadow_size = 10
		sb.shadow_offset = Vector2(0, 3)
		b.add_theme_stylebox_override(st, sb)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	add_press_feel(b)
	return b


## White capsule for readouts and small controls over a game.
static func pill(content: Control, alpha := 0.94) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := box(Color(1, 1, 1, alpha), 19, 8)
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.shadow_color = Color(0, 0, 0, 0.08)
	sb.shadow_size = 8
	sb.shadow_offset = Vector2(0, 2)
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


## iOS-style capsule button.
## style: "filled" (accent fill, white text), "tinted" (accent-tinted fill),
## "gray" (neutral fill), "plain" (text only).
static func apple_button(text: String, icon := "", style := "filled", color := ACCENT, font_size := 15, height := 40.0) -> Button:
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
