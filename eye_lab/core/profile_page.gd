extends Control
## My profile: name and avatar, headline stats, this week's filter time, test
## history and badges. Drawn on the same sunset background as home.

signal back
signal play(key: String)

const INK := UI.LABEL
const INK_MUTED := UI.LABEL_2
const ACCENT := UI.ACCENT
const AVATAR_COLORS := [UI.ACCENT, UI.CORAL, UI.ROSE, UI.PLUM, UI.INDIGO, UI.GOLD]

const TESTS := [
	{"id": "acuity", "name": "Letter E", "icon": "letter_e", "what": "Acuity", "better": "lower", "color": UI.CORAL},
	{"id": "contrast", "name": "Faint stripes", "icon": "contrast", "what": "Contrast sensitivity", "better": "higher", "color": UI.CORAL},
	{"id": "field_map", "name": "Dot hunt", "icon": "target", "what": "Field of view", "better": "higher", "color": UI.CORAL},
]

## Badge: [icon, title, how to earn, earned?]
func _badges() -> Array:
	var plays := Lab.plays_by_game()
	var tests_done := 0
	for t in TESTS:
		if not Lab.results_for(t["id"]).is_empty():
			tests_done += 1
	var best_day := Lab.best_filter_day()
	var longest := Lab.longest_streak()
	return [
		["play", "First steps", "Play your first game", Lab.sessions.size() >= 1],
		["flame", "On a roll", "Play 3 days in a row", longest >= 3],
		["flame", "Week warrior", "Play 7 days in a row", longest >= 7],
		["kaleido", "Magic eyes", "30 minutes of filter time in a day", best_day >= 30],
		["sun", "Full dose", "Reach your daily filter goal", best_day >= float(Lab.settings["daily_filter_goal_min"])],
		["gamepad", "Explorer", "Try 8 different games", plays.size() >= 8],
		["chart", "Scientist", "Finish all 3 eye check-up tests", tests_done >= 3],
		["trophy", "Trophy hunter", "Win 50 trophies", Lab.stars >= 50],
	]


func _ready() -> void:
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	_build()


func _build() -> void:
	var bg := Control.new()
	bg.set_script(preload("res://core/mesh_background.gd"))
	bg.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	add_child(bg)

	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 48)
	margin.add_theme_constant_override("margin_right", 48)
	margin.add_theme_constant_override("margin_top", 88)
	margin.add_theme_constant_override("margin_bottom", 24)
	add_child(margin)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	margin.add_child(scroll)
	var page := VBoxContainer.new()
	page.size_flags_horizontal = SIZE_EXPAND_FILL
	page.add_theme_constant_override("separation", 18)
	scroll.add_child(page)

	# Top row: back + hero.
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 18)
	var back_btn := _pill_button("Home", "arrow_left")
	back_btn.size_flags_vertical = SIZE_SHRINK_BEGIN
	back_btn.pressed.connect(func(): back.emit())
	top.add_child(back_btn)
	top.add_child(_hero())
	page.add_child(top)

	# Stat cards.
	var stats := HBoxContainer.new()
	stats.add_theme_constant_override("separation", 16)
	var week := 0.0
	for i in 7:
		week += Lab.filter_minutes_on(Lab.date_ago(i))
	stats.add_child(_stat("trophy", UI.GOLD, str(Lab.stars), "trophies"))
	stats.add_child(_stat("flame", UI.ACCENT, str(Lab.streak()), "day streak"))
	stats.add_child(_stat("gamepad", UI.PLUM, str(Lab.sessions.size()), "games played"))
	stats.add_child(_stat("clock", UI.INDIGO, "%d" % int(week), "filter minutes this week"))
	page.add_child(stats)

	# Filter week chart + tests.
	var mid := HBoxContainer.new()
	mid.add_theme_constant_override("separation", 16)
	mid.add_child(_week_card())
	mid.add_child(_tests_card())
	page.add_child(mid)

	page.add_child(_badges_card())


# --- sections ------------------------------------------------------------------

func _hero() -> Control:
	var card := _card()
	card.size_flags_horizontal = SIZE_EXPAND_FILL
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 18)
	card.add_child(h)

	var avatar := Button.new()
	avatar.focus_mode = FOCUS_NONE
	avatar.custom_minimum_size = Vector2(84, 84)
	avatar.mouse_default_cursor_shape = CURSOR_POINTING_HAND
	avatar.tooltip_text = "Change colour"
	var col: Color = AVATAR_COLORS[int(Lab.settings.get("avatar_color", 0)) % AVATAR_COLORS.size()]
	for st in ["normal", "hover", "pressed", "hover_pressed"]:
		avatar.add_theme_stylebox_override(st, UI.box(col if st == "normal" else col.lightened(0.1), 42, 0))
	var initial := str(Lab.settings["name"]).strip_edges()
	avatar.text = initial.substr(0, 1).to_upper() if initial != "" else ""
	avatar.icon = null if initial != "" else Icons.tex("user", 40, Color.WHITE)
	avatar.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	avatar.add_theme_font_size_override("font_size", 38)
	avatar.add_theme_font_override("font", UI.font(600))
	avatar.pressed.connect(func():
		Lab.settings["avatar_color"] = (int(Lab.settings.get("avatar_color", 0)) + 1) % AVATAR_COLORS.size()
		Lab.save_data()
		_reload())
	h.add_child(avatar)

	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.size_flags_horizontal = SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 4)
	v.add_child(UI.label("MY PROFILE", 12, INK_MUTED, 600))
	var name_edit := LineEdit.new()
	name_edit.placeholder_text = "What's your name?"
	name_edit.text = str(Lab.settings["name"])
	name_edit.max_length = 24
	name_edit.add_theme_font_size_override("font_size", 30)
	name_edit.add_theme_font_override("font", UI.font(700))
	name_edit.add_theme_color_override("font_color", INK)
	name_edit.add_theme_color_override("font_placeholder_color", UI.LABEL_3)
	name_edit.add_theme_color_override("caret_color", ACCENT)
	name_edit.add_theme_stylebox_override("normal", StyleBoxEmpty.new())
	var focus := UI.box(Color(1, 1, 1, 0.7), 10, 6)
	name_edit.add_theme_stylebox_override("focus", focus)
	name_edit.custom_minimum_size = Vector2(360, 0)
	name_edit.text_submitted.connect(func(_t): name_edit.release_focus())
	name_edit.focus_exited.connect(func():
		if str(Lab.settings["name"]) != name_edit.text.strip_edges():
			Lab.settings["name"] = name_edit.text.strip_edges()
			Lab.save_data()
			_reload())
	v.add_child(name_edit)
	var since := "Welcome to Eye Lab!" if Lab.sessions.is_empty() else "Playing since %s" % _pretty_date(Lab.sessions[0]["date"])
	v.add_child(UI.label(since, 15, INK_MUTED, 500))
	h.add_child(v)
	return card


func _stat(icon: String, color: Color, value: String, caption: String) -> Control:
	var card := _card()
	card.size_flags_horizontal = SIZE_EXPAND_FILL
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 14)
	h.add_child(UI.icon_tile(icon, color, 44.0))
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", -2)
	v.add_child(UI.label(value, 26, INK, 700))
	v.add_child(UI.label(caption, 13, INK_MUTED, 400))
	h.add_child(v)
	card.add_child(h)
	return card


func _week_card() -> Control:
	var card := _card()
	card.size_flags_horizontal = SIZE_EXPAND_FILL
	card.size_flags_stretch_ratio = 1.0
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	card.add_child(v)
	v.add_child(_title("Magic glasses time", "Minutes with a filter on, last 7 days"))
	var goal := float(Lab.settings["daily_filter_goal_min"])
	var days := []
	for i in range(6, -1, -1):
		days.append([Lab.date_ago(i), Lab.filter_minutes_on(Lab.date_ago(i))])
	var chart := Control.new()
	chart.custom_minimum_size = Vector2(0, 220)
	chart.draw.connect(func():
		var r := Rect2(Vector2(0, 10), chart.size - Vector2(0, 40))
		var top_v := maxf(goal, 1.0)
		for d in days:
			top_v = maxf(top_v, d[1])
		var bw := r.size.x / 7.0
		var gy := r.end.y - goal / top_v * r.size.y
		for i in 7:
			var mins: float = days[i][1]
			var h := maxf(4.0, mins / top_v * r.size.y)
			var x := r.position.x + i * bw + bw * 0.2
			var col := UI.INDIGO if mins >= goal else Color(UI.INDIGO, 0.55)
			chart.draw_style_box(UI.box(Color(0.47, 0.47, 0.5, 0.1), 8, 0), Rect2(x, r.position.y, bw * 0.6, r.size.y))
			chart.draw_style_box(UI.box(col, 8, 0), Rect2(x, r.end.y - h, bw * 0.6, h))
			var day_name := _weekday(days[i][0])
			chart.draw_string(UI.font(700), Vector2(x - 10, r.end.y + 24), day_name, HORIZONTAL_ALIGNMENT_CENTER, bw * 0.6 + 20, 13, INK_MUTED)
			if mins >= 1.0:
				chart.draw_string(UI.font(700), Vector2(x - 10, r.end.y - h - 6), "%d" % int(mins), HORIZONTAL_ALIGNMENT_CENTER, bw * 0.6 + 20, 12, INK)
		# Goal line.
		var x0 := r.position.x
		while x0 < r.end.x:
			chart.draw_line(Vector2(x0, gy), Vector2(minf(x0 + 8, r.end.x), gy), UI.LABEL_3, 2.0)
			x0 += 14
		chart.draw_string(UI.font(700), Vector2(r.end.x - 120, gy - 6), "goal %d min" % int(goal), HORIZONTAL_ALIGNMENT_RIGHT, 120, 12, UI.LABEL_3))
	v.add_child(chart)
	return card


func _tests_card() -> Control:
	var card := _card()
	card.size_flags_horizontal = SIZE_EXPAND_FILL
	card.size_flags_stretch_ratio = 1.2
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	card.add_child(v)
	v.add_child(_title("Eye check-up history", "Repeat the tests every week or two to see changes"))
	for t in TESTS:
		var rows: Array = Lab.results_for(t["id"])
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 12)
		var tile := UI.icon_tile(t["icon"], t["color"], 40.0)
		tile.size_flags_vertical = SIZE_SHRINK_CENTER
		h.add_child(tile)
		var tv := VBoxContainer.new()
		tv.add_theme_constant_override("separation", -2)
		tv.alignment = BoxContainer.ALIGNMENT_CENTER
		tv.custom_minimum_size = Vector2(170, 0)
		tv.add_child(UI.label(t["name"], 17, INK, 700))
		if rows.is_empty():
			tv.add_child(UI.label("No results yet", 13, INK_MUTED, 500))
		else:
			var last: Dictionary = rows[-1]
			tv.add_child(UI.label("Latest: %.2f %s" % [last["value"], last["unit"]], 13, INK_MUTED, 600))
		h.add_child(tv)
		var spark := Control.new()
		spark.custom_minimum_size = Vector2(0, 48)
		spark.size_flags_horizontal = SIZE_EXPAND_FILL
		var vals: Array = rows.slice(maxi(0, rows.size() - 12)).map(func(x): return float(x["value"]))
		var col: Color = t["color"]
		spark.draw.connect(func():
			if vals.size() < 2:
				spark.draw_string(UI.font(500), Vector2(0, 30), "Play it twice to see a trend" if vals.size() == 1 else "", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, INK_MUTED)
				return
			var lo: float = vals.min()
			var hi: float = vals.max()
			if hi - lo < 1e-6:
				hi += 1.0
			var pts := PackedVector2Array()
			for i in vals.size():
				pts.append(Vector2(spark.size.x * i / (vals.size() - 1.0), 6 + (1.0 - (vals[i] - lo) / (hi - lo)) * (spark.size.y - 12)))
			spark.draw_polyline(pts, col, 3.0, true)
			spark.draw_circle(pts[-1], 5, col))
		h.add_child(spark)
		var go := _pill_button("Play", "play", true)
		go.size_flags_vertical = SIZE_SHRINK_CENTER
		go.pressed.connect(func(): play.emit(t["id"]))
		h.add_child(go)
		v.add_child(h)
	var note := UI.label("Letter E: lower is better.  Faint stripes and Dot hunt: higher is better.", 12, INK_MUTED, 500)
	v.add_child(note)
	return card


func _badges_card() -> Control:
	var card := _card()
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	card.add_child(v)
	var badges := _badges()
	var earned := badges.filter(func(b): return b[3]).size()
	v.add_child(_title("Badges", "%d of %d earned" % [earned, badges.size()]))
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 12)
	flow.add_theme_constant_override("v_separation", 12)
	for b in badges:
		var tile := PanelContainer.new()
		tile.add_theme_stylebox_override("panel", UI.box(Color(1, 1, 1, 0.8) if b[3] else Color(0.47, 0.47, 0.5, 0.08), 16, 12))
		tile.custom_minimum_size = Vector2(250, 0)
		tile.tooltip_text = b[2]
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 12)
		h.add_child(UI.icon_tile(b[0] if b[3] else "lock", UI.GOLD if b[3] else Color("c9c3cc"), 40.0))
		var tv := VBoxContainer.new()
		tv.alignment = BoxContainer.ALIGNMENT_CENTER
		tv.add_theme_constant_override("separation", -2)
		tv.add_child(UI.label(b[1], 15, INK if b[3] else INK_MUTED, 600))
		tv.add_child(UI.label(b[2], 12, INK_MUTED, 500))
		h.add_child(tv)
		tile.add_child(h)
		flow.add_child(tile)
	v.add_child(flow)
	return card


# --- helpers -------------------------------------------------------------------

## Rebuild in place after an edit (name, avatar colour).
func _reload() -> void:
	for c in get_children():
		c.queue_free()
	_build.call_deferred()


func _card() -> PanelContainer:
	return UI.glass_panel(22.0, 20, Color(1, 1, 1, 0.94))


func _title(t: String, sub: String) -> Control:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	v.add_child(UI.label(t, 18, INK, 600))
	v.add_child(UI.label(sub, 13, INK_MUTED, 400))
	return v


func _pill_button(text: String, icon: String, accent := false) -> Button:
	var b := UI.apple_button(text, icon, "filled" if accent else "gray", ACCENT, 15, 38.0)
	if not accent:
		b.icon = Icons.tex(icon, 17, Color.WHITE)
		for key in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
			b.add_theme_color_override(key, INK)
		for st in ["normal", "hover", "pressed", "hover_pressed"]:
			b.add_theme_stylebox_override(st, UI.box(Color(1, 1, 1, 0.7 if st == "normal" else 0.9), 19, 0))
			(b.get_theme_stylebox(st) as StyleBoxFlat).content_margin_left = 16
			(b.get_theme_stylebox(st) as StyleBoxFlat).content_margin_right = 18
	UI.add_press_feel(b)
	return b


func _weekday(date: String) -> String:
	var d := Time.get_datetime_dict_from_datetime_string(date + "T12:00:00", false)
	var unix := Time.get_unix_time_from_datetime_dict(d)
	return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Time.get_datetime_dict_from_unix_time(unix)["weekday"]]


func _pretty_date(date: String) -> String:
	var parts := date.split("-")
	if parts.size() != 3:
		return date
	var months := ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
	return "%s %d, %s" % [months[int(parts[1]) - 1], int(parts[2]), parts[0]]
