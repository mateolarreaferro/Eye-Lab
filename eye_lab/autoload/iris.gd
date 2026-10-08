extends Node
## Iris, the Eye Lab guide, powered by Claude. The app talks to the Eye Lab server
## (iris-server/, deployed on Vercel), which holds Iris's system prompt and tool
## definitions. Requests are paid for either by the player's own Claude API key
## (Settings > Iris, kept in user://iris.cfg and sent with each request) or, when
## none is set, by the server's key through the shared access code below. Iris answers
## questions about the app and its research, and acts on the app through tools that
## run here: open games or pages, set filters, toggle the whole-screen filter and
## read the player's progress.

signal reply(text: String)            # an assistant text reply to show
signal busy_changed(busy: bool)
signal action(kind: String, data: Dictionary)   # open_game / open_page, handled by main.gd

const SERVER_URL := "https://eye-lab-iris.vercel.app/api/iris"
## Shared access code for the Eye Lab server (EYELAB_APP_KEY on Vercel). It lives in
## autoload/iris_secrets.gd, which is git-ignored; copy iris_secrets.example.gd to create it.
var APP_KEY := _load_app_key()
const MAX_TOOL_ROUNDS := 6
const KEY_PATH := "user://iris.cfg"   # kept apart from eye_lab.json so progress data never holds the key

## The player's own Claude API key ("" = use the shared access code, if this build has one).
var api_key := ""

## Games Iris can open; keys match main.gd EXERCISES.
const GAMES := {
	"acuity": "Letter E (acuity test)",
	"contrast": "Faint stripes (contrast sensitivity test)",
	"field_map": "Dot hunt (visual field map)",
	"odd_color": "Colors (odd one out: hue)",
	"odd_acuity": "Letters (odd one out: tumbling E)",
	"odd_orientation": "Stripes (odd one out: tilt)",
	"odd_depth": "3D (odd one out: stereo depth, needs red/cyan glasses)",
	"spot_count": "Count lights (number of attentional foci)",
	"location": "Did it move? (spatial localization)",
	"mot": "Follow dots (multiple object tracking)",
	"search": "Find it! (directed visual search)",
	"pong": "Pong (predictive pursuit)",
	"patch_room": "Magic glasses (webcam/scene/picture through a filter)",
}
const FILTER_MODES := ["off", "high_pass", "low_pass", "edges", "invert", "kaleidoscope"]

var messages: Array = []     # full conversation, assistant turns kept verbatim
var busy := false
var _http: HTTPRequest
var _rounds := 0


func _ready() -> void:
	_http = HTTPRequest.new()
	_http.timeout = 90.0
	_http.request_completed.connect(_on_response)
	add_child(_http)
	var cfg := ConfigFile.new()
	if cfg.load(KEY_PATH) == OK:
		api_key = str(cfg.get_value("iris", "api_key", ""))


func set_api_key(key: String) -> void:
	api_key = key.strip_edges()
	var cfg := ConfigFile.new()
	cfg.set_value("iris", "api_key", api_key)
	cfg.save(KEY_PATH)


## "own" (player's key), "shared" (this build's access code) or "none".
func key_source() -> String:
	if api_key != "":
		return "own"
	return "shared" if APP_KEY != "" else "none"


static func _load_app_key() -> String:
	const PATH := "res://autoload/iris_secrets.gd"
	if ResourceLoader.exists(PATH):
		return str(load(PATH).APP_KEY)
	push_warning("Iris: autoload/iris_secrets.gd is missing, so chat can't reach the server.")
	return ""


func reset() -> void:
	messages.clear()


func ask(text: String) -> void:
	if busy or text.strip_edges() == "":
		return
	if key_source() == "none":
		reply.emit("To chat with me, add a Claude API key in Settings, under Iris.")
		return
	messages.append({"role": "user", "content": text.strip_edges()})
	_rounds = 0
	_send()


func _send() -> void:
	_set_busy(true)
	var headers := PackedStringArray(["content-type: application/json"])
	if api_key != "":
		headers.append("x-anthropic-key: " + api_key)
	else:
		headers.append("x-eyelab-key: " + APP_KEY)
	var err := _http.request(SERVER_URL, headers, HTTPClient.METHOD_POST, JSON.stringify({"messages": messages}))
	if err != OK:
		_fail("I couldn't reach the internet. Check your connection and try again.")


func _on_response(result: int, code: int, _headers: PackedStringArray, raw: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS:
		_fail("I couldn't reach Claude. Check your internet connection and try again.")
		return
	var data = JSON.parse_string(raw.get_string_from_utf8())
	if code != 200 or typeof(data) != TYPE_DICTIONARY:
		var msg := ""
		if typeof(data) == TYPE_DICTIONARY and data.has("error"):
			msg = str(data["error"].get("message", ""))
		match code:
			401, 403:
				if api_key != "":
					_fail("Your Claude API key wasn't accepted. Check it in Settings, under Iris.")
				else:
					_fail("This copy of Eye Lab can't reach Iris's server. Add your own Claude API key in Settings, under Iris.")
			413:
				reset()
				_fail("Our chat got really long, so I've started a fresh one. What would you like to know?")
			429, 502, 503, 529:
				_fail("I'm a bit busy right now. Try again in a moment.")
			_:
				_fail("Something went wrong (%d). %s" % [code, msg])
		return

	var content: Array = data.get("content", [])
	messages.append({"role": "assistant", "content": content})   # keep verbatim (thinking, tool_use…)
	var stop: String = str(data.get("stop_reason", ""))

	if stop == "refusal":
		_finish("Let's stick to Eye Lab: the games, the filters, or the science behind them. What would you like to know?")
		return

	var text := ""
	for block in content:
		if block.get("type", "") == "text":
			text += str(block.get("text", ""))
	if text.strip_edges() != "":
		reply.emit(text.strip_edges())

	if stop == "tool_use":
		_rounds += 1
		var results := []
		for block in content:
			if block.get("type", "") == "tool_use":
				results.append(_run_tool(block))
		messages.append({"role": "user", "content": results})
		if _rounds >= MAX_TOOL_ROUNDS:
			_finish("")
			return
		_send()
		return
	_finish("")


func _finish(text: String) -> void:
	if text != "":
		reply.emit(text)
	_set_busy(false)


func _fail(text: String) -> void:
	# Drop the unanswered user turn so the next question starts cleanly.
	while not messages.is_empty() and messages[-1]["role"] == "user":
		messages.pop_back()
	_finish(text)


func _set_busy(b: bool) -> void:
	busy = b
	busy_changed.emit(b)


# --- tools (defined on the server; run here) -------------------------------------

func _run_tool(block: Dictionary) -> Dictionary:
	var input: Dictionary = block.get("input", {}) if typeof(block.get("input")) == TYPE_DICTIONARY else {}
	var out := ""
	var is_error := false
	match str(block.get("name", "")):
		"open_game":
			var g := str(input.get("game", ""))
			if GAMES.has(g):
				action.emit("open_game", {"game": g})
				out = "Opened %s. The player now sees its how-to-play card." % GAMES[g]
			else:
				out = "Unknown game '%s'." % g
				is_error = true
		"open_page":
			action.emit("open_page", {"page": str(input.get("page", "home"))})
			out = "Opened the %s page." % str(input.get("page", "home"))
		"set_filter":
			var m := FILTER_MODES.find(str(input.get("mode", "")))
			if m < 0:
				out = "Unknown filter."
				is_error = true
			else:
				var d = input.get("detail")
				if typeof(d) in [TYPE_FLOAT, TYPE_INT]:
					Filter.set_cutoff(lerpf(7.0, 0.5, clampf(float(d), 0.0, 1.0)))
				Filter.set_mode(m)
				out = "Filter set to %s%s." % [FILTER_MODES[m], " (whole screen)" if Filter.system_on else " (inside Eye Lab)"]
		"set_whole_screen":
			var on := bool(input.get("on", false))
			Filter.set_system(on)
			out = "Whole-screen filter %s. If it's the first time, macOS will ask to allow \"Eye Lab Overlay\" under Screen Recording." % ("turned on" if on else "turned off")
		"get_progress":
			out = JSON.stringify(Lab.progress_summary())
		_:
			out = "Unknown tool."
			is_error = true
	var r := {"type": "tool_result", "tool_use_id": block.get("id", ""), "content": out}
	if is_error:
		r["is_error"] = true
	return r
