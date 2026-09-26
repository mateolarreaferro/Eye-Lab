extends Node
## Settings, result history and daily filter dose, persisted to user://eye_lab.json.

const SAVE_PATH := "user://eye_lab.json"

var settings := {
	"distance_cm": 57.0,          # at 57 cm, 1 cm on screen ≈ 1° of visual angle
	"px_per_cm": 0.0,             # 0 = not calibrated yet, estimated from screen DPI
	"daily_filter_goal_min": 120.0,
	"eye": "Both",
	"name": "",
	"avatar_color": 0,
}
var results: Array = []           # [{time, date, id, title, value, unit, eye, detail}]
var filter_seconds := {}          # "YYYY-MM-DD" -> seconds spent with a filter on
var stars := 0                    # trophies earned across all sessions
var sessions: Array = []          # [{date, id, title, trophies}] every finished game

var _dirty := false
var _save_timer := 0.0


func _ready() -> void:
	load_data()
	# Work in logical points on HiDPI screens so text and stimuli aren't tiny.
	# All visual-angle maths below is in these units, and calibration measures them too.
	get_window().content_scale_factor = ui_scale()
	ThemeDB.fallback_font = UI.font(400)
	get_window().theme = UI.theme()


func ui_scale() -> float:
	return maxf(1.0, DisplayServer.screen_get_scale())


func _process(delta: float) -> void:
	_save_timer += delta
	if _dirty and _save_timer > 30.0:
		save_data()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_PREDELETE:
		if _dirty:
			save_data()


func is_calibrated() -> bool:
	return float(settings["px_per_cm"]) > 0.0


func px_per_cm() -> float:
	if is_calibrated():
		return float(settings["px_per_cm"])
	var dpi := DisplayServer.screen_get_dpi()
	if dpi <= 0:
		dpi = 110
	return dpi / 2.54 / ui_scale()


## Screen pixels per degree of visual angle at the configured viewing distance.
func px_per_deg() -> float:
	return px_per_cm() * float(settings["distance_cm"]) * tan(deg_to_rad(1.0))


func today() -> String:
	return Time.get_date_string_from_system()


func add_filter_time(dt: float) -> void:
	var d := today()
	filter_seconds[d] = float(filter_seconds.get(d, 0.0)) + dt
	_dirty = true


var _overlay_days := {}
var _overlay_read_at := -100.0


## Minutes today with a filter on, in the lab plus the whole-screen overlay
## (which logs its own time to overlay_time.json).
func filter_minutes_today() -> float:
	return filter_minutes_on(today())


func filter_minutes_on(date: String) -> float:
	var now := Time.get_ticks_msec() / 1000.0
	if now - _overlay_read_at > 5.0:
		_overlay_read_at = now
		_overlay_days = {}
		var path := "user://overlay_time.json"
		if FileAccess.file_exists(path):
			var d = JSON.parse_string(FileAccess.get_file_as_string(path))
			if typeof(d) == TYPE_DICTIONARY:
				_overlay_days = d
	return (float(filter_seconds.get(date, 0.0)) + float(_overlay_days.get(date, 0.0))) / 60.0


## "YYYY-MM-DD" for `days_ago` days before today.
func date_ago(days_ago: int) -> String:
	var local := int(Time.get_unix_time_from_system()) + int(Time.get_time_zone_from_system()["bias"]) * 60
	return Time.get_date_string_from_unix_time(local - days_ago * 86400)


## Longest run of consecutive active days ever (for badges).
func longest_streak() -> int:
	var best := 0
	var run := 0
	for i in range(365, -1, -1):
		if active_on(date_ago(i)):
			run += 1
			best = maxi(best, run)
		else:
			run = 0
	return best


## Most filter minutes in a single day, over the past year.
func best_filter_day() -> float:
	var best := 0.0
	for i in 366:
		best = maxf(best, filter_minutes_on(date_ago(i)))
	return best


func record_session(id: String, title: String, trophies: int) -> void:
	sessions.append({"date": today(), "id": id, "title": title, "trophies": trophies})
	stars += trophies
	save_data()


func active_on(date: String) -> bool:
	for s in sessions:
		if s["date"] == date:
			return true
	return filter_minutes_on(date) >= 1.0


## Days in a row with a game played or a minute of filter time, ending today
## (or yesterday, so the streak isn't lost before today's first game).
func streak() -> int:
	var start := 0 if active_on(today()) else 1
	var n := 0
	while active_on(date_ago(start + n)):
		n += 1
	return n


func plays_by_game() -> Dictionary:
	var d := {}
	for s in sessions:
		d[s["id"]] = int(d.get(s["id"], 0)) + 1
	return d


## Snapshot for the profile page and for Iris's get_progress tool.
func progress_summary() -> Dictionary:
	var week := []
	for i in range(6, -1, -1):
		week.append({"date": date_ago(i), "filter_minutes": snappedf(filter_minutes_on(date_ago(i)), 0.1)})
	var latest := {}
	for r in results:
		latest[r["id"]] = {"title": r["title"], "value": snappedf(float(r["value"]), 0.01), "unit": r["unit"],
			"date": r["date"], "sessions_logged": results_for(r["id"]).size()}
	return {
		"name": settings["name"],
		"trophies_total": stars,
		"day_streak": streak(),
		"games_played_total": sessions.size(),
		"plays_by_game": plays_by_game(),
		"filter_minutes_today": snappedf(filter_minutes_today(), 0.1),
		"daily_filter_goal_minutes": settings["daily_filter_goal_min"],
		"filter_minutes_last_7_days": week,
		"latest_results": latest,
		"better_direction": {"acuity": "lower", "contrast": "higher", "field_map": "higher", "mot": "higher", "pong": "higher",
			"search": "lower", "spot_count": "lower", "location": "lower", "odd_color": "lower", "odd_acuity": "lower",
			"odd_orientation": "lower", "odd_depth": "lower"},
		"screen_calibrated": is_calibrated(),
	}


func log_result(id: String, title: String, value: float, unit: String, detail: Dictionary = {}) -> void:
	results.append({
		"time": Time.get_unix_time_from_system(),
		"date": today(),
		"id": id,
		"title": title,
		"value": value,
		"unit": unit,
		"eye": settings["eye"],
		"detail": detail,
	})
	save_data()


func results_for(id: String) -> Array:
	return results.filter(func(r): return r["id"] == id)


func save_data() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f == null:
		push_warning("Eye Lab: could not save to %s" % SAVE_PATH)
		return
	f.store_string(JSON.stringify({
		"settings": settings,
		"results": results,
		"filter_seconds": filter_seconds,
		"stars": stars,
		"sessions": sessions,
	}, "\t"))
	_dirty = false
	_save_timer = 0.0


func load_data() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var data = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if typeof(data) != TYPE_DICTIONARY:
		return
	if data.has("settings"):
		settings.merge(data["settings"], true)
	results = data.get("results", [])
	filter_seconds = data.get("filter_seconds", {})
	stars = int(data.get("stars", 0))
	sessions = data.get("sessions", [])
