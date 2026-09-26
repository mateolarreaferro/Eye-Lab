extends Node
## Subtle interface sounds, synthesised at startup (no audio files): very short,
## high, quiet sine ticks, all from the same family as the hover tick. A faint tick
## on hover, a slightly fuller tick on click, a double tick for a correct answer, a
## single lower tick for a miss, and three rising ticks on finishing.
## Every Button in the app gets hover/click sounds automatically.

const RATE := 44100
const HOVER_GAP := 0.05       # seconds; stops a sweep across tiles from rattling

var enabled := true
var _sounds := {}
var _players: Array[AudioStreamPlayer] = []
var _next := 0
var _last_hover := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	enabled = bool(Lab.settings.get("sound", true))
	_sounds = {
		"hover": _make(0.03, _hover),
		"click": _make(0.04, _click),
		"success": _make(0.12, _success),
		"fail": _make(0.07, _fail),
		"complete": _make(0.22, _complete),
	}
	for i in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)
	get_tree().node_added.connect(_on_node_added)


func play(name: String, volume_db := 0.0) -> void:
	if not enabled or not _sounds.has(name):
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = _sounds[name]
	p.volume_db = volume_db
	p.pitch_scale = randf_range(0.98, 1.02)   # tiny variation so repeats don't feel mechanical
	p.play()


func hover() -> void:
	var now := Time.get_ticks_msec() / 1000.0
	if now - _last_hover >= HOVER_GAP:
		_last_hover = now
		play("hover", -8.0)


func set_enabled(on: bool) -> void:
	enabled = on
	Lab.settings["sound"] = on
	Lab.save_data()


func _on_node_added(n: Node) -> void:
	if n is BaseButton and not n.has_meta("no_sfx"):
		n.mouse_entered.connect(func():
			if not n.disabled:
				hover())
		n.button_down.connect(func(): play("click"))


# --- synthesis -----------------------------------------------------------------
# No noise anywhere: every sound is a short sine "tap" whose pitch drops quickly,
# with a rounded envelope. Too brief to read as a note; heard as a soft click,
# like iOS keyboard taps. Generators return a sample in -1..1 for time t (seconds).

func _make(duration: float, gen: Callable) -> AudioStreamWAV:
	var n := int(duration * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in n:
		var t := float(i) / RATE
		var v: float = gen.call(t)
		v *= minf(1.0, (duration - t) / 0.006)   # fade the tail so nothing clicks
		data.encode_s16(i * 2, int(clampf(v, -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	return w


## A soft tap starting at `start`: sine whose pitch glides from f0 down to f1,
## with a ~1 ms rounded attack and exponential decay.
static func _tap(t: float, start: float, f0: float, f1: float, glide: float, decay: float, amp: float) -> float:
	var u := t - start
	if u < 0.0:
		return 0.0
	# Integrated phase of an exponential glide f(u) = f1 + (f0 - f1) e^(-u/glide).
	var phase := TAU * (f1 * u + (f0 - f1) * glide * (1.0 - exp(-u / glide)))
	var attack := 0.5 - 0.5 * cos(PI * minf(1.0, u / 0.0012))
	return sin(phase) * attack * exp(-u / decay) * amp


func _hover(t: float) -> float:
	return _tap(t, 0.0, 2400.0, 1500.0, 0.004, 0.004, 0.05)


func _click(t: float) -> float:
	# Same family as the hover tick, just a touch fuller and longer.
	return _tap(t, 0.0, 2200.0, 1700.0, 0.003, 0.007, 0.09)


func _success(t: float) -> float:
	# Two quick soft ticks, the second slightly brighter.
	return _tap(t, 0.0, 2000.0, 1600.0, 0.003, 0.008, 0.08) + _tap(t, 0.06, 2600.0, 2100.0, 0.003, 0.01, 0.08)


func _fail(t: float) -> float:
	# One single, lower, softer tick.
	return _tap(t, 0.0, 1300.0, 1100.0, 0.003, 0.012, 0.08)


func _complete(t: float) -> float:
	# Three soft ticks stepping upward.
	return (_tap(t, 0.0, 1800.0, 1450.0, 0.003, 0.01, 0.07)
		+ _tap(t, 0.07, 2200.0, 1800.0, 0.003, 0.01, 0.07)
		+ _tap(t, 0.14, 2700.0, 2200.0, 0.003, 0.014, 0.07))
