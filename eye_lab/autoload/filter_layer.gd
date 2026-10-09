extends CanvasLayer
## Global vision filter over the whole lab (menu, exercises, camera room), with a
## clickable toolbar at the top of the screen. The toolbar sits above the filter so it
## always stays readable. Keyboard shortcuts still work: Tab cycles, [ ] cutoff, H hides.
## Time spent with any filter on counts toward the daily "frequency patching" dose.

enum Mode { OFF, HIGH_PASS, LOW_PASS }
const NAMES := ["Off", "High-pass", "Low-pass"]
const ICONS := ["filter_off", "high_pass", "low_pass"]
const TIPS := [
	"No filter",
	"Removes coarse shapes and keeps fine detail. This is the \"frequency patching\" filter.",
	"Blurs away fine detail and keeps coarse shapes",
]


signal mode_changed(mode: int)
signal system_changed(on: bool)
signal params_changed

## How the high-pass and low-pass filters behave; set from Settings > Filters and
## saved in Lab.settings["filter"]. lod: blur scale 2^lod px (higher = coarser cutoff).
## hp_gain: contrast boost of what's left. hp_keep: share of the coarse image kept
## (0 = pure high-pass). lp_mix: 0 = original, 1 = fully blurred.
const DEFAULTS := {"hp_lod": 3.0, "hp_gain": 1.6, "hp_keep": 0.0, "lp_lod": 3.0, "lp_mix": 1.0}

var mode: int = Mode.OFF
var params: Dictionary = DEFAULTS.duplicate()
## Cutoff of the current filter (high-pass and low-pass each have their own).
var cutoff_lod: float:
	get:
		return float(params[_lod_key()])
## True while the whole-screen overlay helper is filtering the entire Mac.
var system_on := false

var _rect: ColorRect
var _mat: ShaderMaterial
var _bar: PanelContainer
var _mini: Button
var _buttons: Array[Button] = []
var _cutoff_box: HBoxContainer
var _slider: HSlider
var _cutoff_label: Label
var _minutes_label: Label
var _minutes_bar: ProgressBar
var _tick := 0.0
var _sys_btn: Button
var _poll := 0.0
var _launched_at := 0.0
var _ui_root: Control


func _ready() -> void:
	layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS

	_mat = ShaderMaterial.new()
	_mat.shader = preload("res://shaders/filter.gdshader")
	_rect = ColorRect.new()
	_rect.material = _mat
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_rect)

	var ui_layer := CanvasLayer.new()
	ui_layer.layer = 101
	add_child(ui_layer)
	var root := Control.new()
	_ui_root = root
	root.theme = UI.theme()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_layer.add_child(root)

	var saved = Lab.settings.get("filter")
	if typeof(saved) == TYPE_DICTIONARY:
		for k in DEFAULTS:
			params[k] = float(saved.get(k, DEFAULTS[k]))
	_build_toolbar(root)
	set_mode(Mode.OFF)
	_detect_running_overlay()


func _build_toolbar(root: Control) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	row.alignment = BoxContainer.ALIGNMENT_CENTER

	# Segmented control: the selected segment is a white "thumb" with a soft shadow.
	var seg_bg := PanelContainer.new()
	seg_bg.add_theme_stylebox_override("panel", UI.box(UI.FILL, 12, 2))
	var seg := HBoxContainer.new()
	seg.add_theme_constant_override("separation", 0)
	seg_bg.add_child(seg)
	var group := ButtonGroup.new()
	for i in NAMES.size():
		var b := Button.new()
		b.text = NAMES[i]
		b.icon = Icons.tex(ICONS[i], 15, Color.WHITE)
		b.toggle_mode = true
		b.button_group = group
		b.tooltip_text = TIPS[i]
		b.focus_mode = Control.FOCUS_NONE
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		b.add_theme_font_size_override("font_size", 13)
		b.add_theme_font_override("font", UI.font(500))
		b.add_theme_constant_override("h_separation", 6)
		for key in ["font_color", "font_hover_color", "icon_normal_color", "icon_hover_color"]:
			b.add_theme_color_override(key, UI.LABEL_2)
		for key in ["font_pressed_color", "font_hover_pressed_color", "icon_pressed_color", "icon_hover_pressed_color"]:
			b.add_theme_color_override(key, UI.LABEL)
		var plain := UI.box(Color(0, 0, 0, 0), 10, 0)
		_pad(plain, 12, 6)
		var hover := UI.box(Color(1, 1, 1, 0.35), 10, 0)
		_pad(hover, 12, 6)
		var thumb := UI.box(Color.WHITE, 10, 0)
		_pad(thumb, 12, 6)
		thumb.shadow_color = Color(0, 0, 0, 0.12)
		thumb.shadow_size = 4
		thumb.shadow_offset = Vector2(0, 1)
		b.add_theme_stylebox_override("normal", plain)
		b.add_theme_stylebox_override("hover", hover)
		b.add_theme_stylebox_override("pressed", thumb)
		b.add_theme_stylebox_override("hover_pressed", thumb)
		b.pressed.connect(set_mode.bind(i))
		seg.add_child(b)
		_buttons.append(b)
	row.add_child(seg_bg)

	_sys_btn = UI.apple_button("Whole screen", "monitor", "gray", UI.LABEL, 13, 34.0)
	_sys_btn.icon = Icons.tex("monitor", 15, Color.WHITE)
	_sys_btn.toggle_mode = true
	_sys_btn.tooltip_text = "Filter the whole computer, including other apps and videos.\nIt keeps running after you close Eye Lab; turn it off here or from the eye icon in the menu bar."
	for key in ["icon_normal_color", "icon_hover_color"]:
		_sys_btn.add_theme_color_override(key, UI.LABEL)
	for key in ["font_pressed_color", "font_hover_pressed_color", "icon_pressed_color", "icon_hover_pressed_color"]:
		_sys_btn.add_theme_color_override(key, Color.WHITE)
	var on_sb := UI.box(UI.ACCENT, 17, 0)
	_pad(on_sb, 14, 0)
	_sys_btn.add_theme_stylebox_override("pressed", on_sb)
	_sys_btn.add_theme_stylebox_override("hover_pressed", on_sb)
	_sys_btn.toggled.connect(func(on): set_system(on))
	row.add_child(_sys_btn)

	_cutoff_box = HBoxContainer.new()
	_cutoff_box.add_theme_constant_override("separation", 8)
	_cutoff_box.add_child(UI.label("Coarse", 12, UI.LABEL_2, 500))
	_slider = HSlider.new()
	_slider.custom_minimum_size = Vector2(110, 0)
	_slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_slider.min_value = 0.5
	_slider.max_value = 7.0
	_slider.step = 0.25
	_slider.value = 7.5 - cutoff_lod
	_slider.focus_mode = Control.FOCUS_NONE
	_slider.tooltip_text = "Which detail sizes the filter splits at. More options in Settings > Filters."
	var track := UI.box(Color(0, 0, 0, 0.1), 2, 0)
	track.content_margin_top = 2
	track.content_margin_bottom = 2
	var fill := UI.box(UI.ACCENT, 2, 0)
	fill.content_margin_top = 2
	fill.content_margin_bottom = 2
	_slider.add_theme_stylebox_override("slider", track)
	_slider.add_theme_stylebox_override("grabber_area", fill)
	_slider.add_theme_stylebox_override("grabber_area_highlight", fill)
	_slider.value_changed.connect(func(v): set_cutoff(7.5 - v))
	_cutoff_box.add_child(_slider)
	_cutoff_box.add_child(UI.label("Fine", 12, UI.LABEL_2, 500))
	_cutoff_label = UI.label("", 12, UI.LABEL_3, 500)
	_cutoff_label.custom_minimum_size = Vector2(58, 0)
	_cutoff_box.add_child(_cutoff_label)
	row.add_child(_cutoff_box)

	var timer_box := VBoxContainer.new()
	timer_box.add_theme_constant_override("separation", 3)
	timer_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_minutes_label = UI.label("", 12, UI.LABEL_2, 500)
	timer_box.add_child(_minutes_label)
	_minutes_bar = ProgressBar.new()
	_minutes_bar.show_percentage = false
	_minutes_bar.custom_minimum_size = Vector2(72, 3)
	_minutes_bar.add_theme_stylebox_override("background", UI.box(Color(0, 0, 0, 0.08), 2, 0))
	_minutes_bar.add_theme_stylebox_override("fill", UI.box(UI.ACCENT, 2, 0))
	timer_box.add_child(_minutes_bar)
	timer_box.tooltip_text = "Minutes today with a filter on"
	var tm := MarginContainer.new()
	tm.add_theme_constant_override("margin_left", 6)
	tm.add_child(timer_box)
	row.add_child(tm)

	var hide_btn := UI.apple_button("", "chevron_up", "plain", UI.LABEL_2, 13, 30.0)
	hide_btn.icon = Icons.tex("chevron_up", 15, Color.WHITE)
	hide_btn.tooltip_text = "Hide the filter bar"
	hide_btn.pressed.connect(_set_collapsed.bind(true))
	row.add_child(hide_btn)

	_bar = UI.glass_panel(19.0, 6, Color(1, 1, 1, 0.9))
	_bar.add_child(row)
	_bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	root.add_child(_bar)
	_bar.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP, Control.PRESET_MODE_MINSIZE, 14)

	_mini = UI.apple_button("Filters", "eye", "gray", UI.LABEL, 13, 34.0)
	_mini.icon = Icons.tex("eye", 15, Color.WHITE)
	for key in ["icon_normal_color", "icon_hover_color"]:
		_mini.add_theme_color_override(key, UI.LABEL)
	var mini_sb := UI.box(Color(1, 1, 1, 0.8), 17, 0)
	_pad(mini_sb, 14, 0)
	_mini.add_theme_stylebox_override("normal", mini_sb)
	_mini.tooltip_text = "Show the filter bar"
	_mini.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_mini.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP, Control.PRESET_MODE_MINSIZE, 14)
	_mini.pressed.connect(_set_collapsed.bind(false))
	_mini.hide()
	root.add_child(_mini)


func _pad(sb: StyleBoxFlat, h: float, v: float) -> void:
	sb.content_margin_left = h
	sb.content_margin_right = h
	sb.content_margin_top = v
	sb.content_margin_bottom = v


## Shrink the bar to its contents and keep it centred (its content width changes).
func _fit_bar() -> void:
	_bar.reset_size()
	_bar.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP, Control.PRESET_MODE_MINSIZE, 14)


func set_toolbar_visible(v: bool) -> void:
	_ui_root.visible = v


func _set_collapsed(c: bool) -> void:
	_bar.visible = not c
	_mini.visible = c
	_update_labels()


func set_mode(m: int) -> void:
	mode = wrapi(m, 0, NAMES.size())
	if system_on:
		if mode == Mode.OFF:
			set_system(false)
			return
		_write_state()
	# While the overlay runs it already filters this window, so don't filter twice.
	_rect.visible = mode != Mode.OFF and not system_on
	_apply_params()
	for i in _buttons.size():
		_buttons[i].set_pressed_no_signal(i == mode)
	_cutoff_box.visible = mode != Mode.OFF
	_fit_bar.call_deferred()
	_update_labels()
	mode_changed.emit(mode)


## Cutoff of the current filter (the toolbar slider and Iris use this).
func set_cutoff(lod: float) -> void:
	set_param(_lod_key(), lod)


func set_param(key: String, value: float) -> void:
	var limits := {"hp_lod": [0.5, 7.0], "lp_lod": [0.5, 7.0], "hp_gain": [0.5, 4.0], "hp_keep": [0.0, 1.0], "lp_mix": [0.0, 1.0]}
	params[key] = clampf(value, limits[key][0], limits[key][1])
	_params_updated()


func reset_params() -> void:
	params = DEFAULTS.duplicate()
	_params_updated()


func _params_updated() -> void:
	Lab.settings["filter"] = params.duplicate()
	Lab.mark_dirty()
	_apply_params()
	if system_on:
		_write_state()
	_update_labels()
	params_changed.emit()


func _lod_key() -> String:
	return "lp_lod" if mode == Mode.LOW_PASS else "hp_lod"


func _apply_params() -> void:
	_mat.set_shader_parameter("mode", mode)
	_mat.set_shader_parameter("lod", cutoff_lod)
	_mat.set_shader_parameter("gain", params["hp_gain"])
	_mat.set_shader_parameter("keep", params["hp_keep"])
	_mat.set_shader_parameter("amount", params["lp_mix"])
	if _slider:
		_slider.set_value_no_signal(7.5 - cutoff_lod)


## Approximate cutoff in cycles per degree for a given blur scale.
func lod_to_cpd(lod: float) -> float:
	return Lab.px_per_deg() * Lab.ui_scale() / pow(2.0, lod + 1.0)


## Approximate spatial-frequency cutoff of the blur, in cycles per degree.
func cutoff_cpd() -> float:
	# The shader works in physical pixels; px_per_deg is in logical units.
	return lod_to_cpd(cutoff_lod)


func _input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo:
		return
	# Shortcuts must not fire while typing (e.g. chatting with Iris).
	var focus := get_viewport().gui_get_focus_owner()
	if focus is LineEdit or focus is TextEdit:
		return
	match k.keycode:
		KEY_TAB:
			set_mode(mode + (-1 if k.shift_pressed else 1))
		KEY_BRACKETLEFT:
			set_cutoff(cutoff_lod - 0.5)
		KEY_BRACKETRIGHT:
			set_cutoff(cutoff_lod + 0.5)
		KEY_H:
			_set_collapsed(_bar.visible)
		_:
			return
	get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	if mode != Mode.OFF and not system_on:
		Lab.add_filter_time(delta)
	if system_on:
		_poll += delta
		if _poll > 1.0:
			_poll = 0.0
			_sync_from_overlay()
	_tick += delta
	if _tick > 1.0:
		_update_labels()


func _update_labels() -> void:
	_tick = 0.0
	var goal := float(Lab.settings["daily_filter_goal_min"])
	var done := Lab.filter_minutes_today()
	_minutes_label.text = "%d / %d min" % [int(done), int(goal)]
	_minutes_bar.max_value = goal
	_minutes_bar.value = done
	_cutoff_label.text = "≈%.1f c/°" % cutoff_cpd()
	_mini.text = "Filters" if mode == Mode.OFF else "Filter: " + NAMES[mode]


# --- Whole-screen overlay -------------------------------------------------------

func _state_path() -> String:
	return ProjectSettings.globalize_path("user://overlay.json")


## Eye Lab ships the overlay helper inside its Resources and installs it on first
## use to ~/Applications, and always launches that installed copy. The helper must
## run from outside Eye Lab.app: macOS would otherwise tie its screen-recording
## permission to Eye Lab's exact build and revoke it whenever Eye Lab is updated.
func helper_path() -> String:
	var installed := OS.get_environment("HOME").path_join("Applications/Eye Lab Overlay.app")
	var bundled := OS.get_executable_path().get_base_dir().path_join("../Resources/Eye Lab Overlay.app").simplify_path()
	if DirAccess.dir_exists_absolute(bundled):
		var bin := "Contents/MacOS/EyeLabOverlay"
		var src_md5 := FileAccess.get_md5(bundled.path_join(bin))
		if not FileAccess.file_exists(installed.path_join(bin)) or FileAccess.get_md5(installed.path_join(bin)) != src_md5:
			DirAccess.make_dir_recursive_absolute(installed.get_base_dir())
			OS.execute("/usr/bin/ditto", [bundled, installed])
			# It came inside Eye Lab, which the user already chose to open.
			OS.execute("/usr/bin/xattr", ["-dr", "com.apple.quarantine", installed])
		return installed
	for c in [installed, "/Applications/Eye Lab Overlay.app",
			ProjectSettings.globalize_path("res://").path_join("../build/Eye Lab Overlay.app")]:
		if DirAccess.dir_exists_absolute(c):
			return c.simplify_path()
	return ""


func set_system(on: bool) -> void:
	if on == system_on:
		_sys_btn.set_pressed_no_signal(on)
		return
	if on:
		var helper := helper_path()
		if helper == "":
			push_warning("Eye Lab Overlay.app not found")
			_sys_btn.set_pressed_no_signal(false)
			return
		if mode == Mode.OFF:
			mode = Mode.HIGH_PASS
		system_on = true
		_write_state()
		# Launch through Launch Services so macOS asks the helper (not Eye Lab)
		# for screen-recording permission.
		OS.create_process("/usr/bin/open", ["-a", helper, "--args", "--state", _state_path()])
		_launched_at = Time.get_ticks_msec() / 1000.0
	else:
		system_on = false
		_write_state(0)
	_sys_btn.set_pressed_no_signal(system_on)
	system_changed.emit(system_on)
	set_mode(mode)


func _write_state(force_mode := -1) -> void:
	var f := FileAccess.open(_state_path(), FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"mode": force_mode if force_mode >= 0 else mode, "lod": cutoff_lod,
			"gain": params["hp_gain"], "keep": params["hp_keep"], "mix": params["lp_mix"]}))


## True if the helper process is alive.
func _overlay_running() -> bool:
	return OS.execute("/usr/bin/pgrep", ["-x", "EyeLabOverlay"], []) == 0


## Pick up changes made from the overlay's menu bar icon (including "Turn off"),
## and notice when the helper isn't running (e.g. it quit because macOS hasn't
## granted screen recording yet), so the toggle doesn't claim it's on.
func _sync_from_overlay() -> void:
	if Time.get_ticks_msec() / 1000.0 - _launched_at > 4.0 and not _overlay_running():
		system_on = false
		_write_state(0)
		_sys_btn.set_pressed_no_signal(false)
		system_changed.emit(false)
		set_mode(mode)
		return
	if not FileAccess.file_exists(_state_path()):
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(_state_path()))
	if typeof(d) != TYPE_DICTIONARY:
		return
	var m := int(d.get("mode", mode))
	if m >= NAMES.size():
		m = Mode.HIGH_PASS   # a mode this version no longer has
	var lod := float(d.get("lod", cutoff_lod))
	if m == 0:
		system_on = false
		_sys_btn.set_pressed_no_signal(false)
		system_changed.emit(false)
		set_mode(Mode.OFF)
	elif m != mode or not is_equal_approx(lod, cutoff_lod):
		mode = m
		params[_lod_key()] = lod
		_apply_params()
		params_changed.emit()
		for i in _buttons.size():
			_buttons[i].set_pressed_no_signal(i == mode)
		_cutoff_box.visible = mode != Mode.OFF
		_update_labels()
		mode_changed.emit(mode)


## If the overlay is still running from an earlier session, reflect that.
func _detect_running_overlay() -> void:
	var out := []
	if OS.execute("/usr/bin/pgrep", ["-x", "EyeLabOverlay"], out) != 0:
		return
	if not FileAccess.file_exists(_state_path()):
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(_state_path()))
	if typeof(d) == TYPE_DICTIONARY and int(d.get("mode", 0)) != 0:
		system_on = true
		mode = clampi(int(d["mode"]), Mode.HIGH_PASS, Mode.LOW_PASS)
		params[_lod_key()] = float(d.get("lod", cutoff_lod))
		_sys_btn.set_pressed_no_signal(true)
		set_mode(mode)
