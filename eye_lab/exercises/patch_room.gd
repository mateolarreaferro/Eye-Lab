extends Exercise
## Frequency patching room: look at your webcam feed, a built-in "cabinet of curiosities",
## or any image, through the high-pass filter. Time here counts toward the daily dose
## (the slides' protocol: a few hours a day for ~4 weeks).

enum Source { CAMERA, CABINET, IMAGE }

var source := Source.CABINET
var prev_filter := 0
var _cam_rect: ColorRect
var _cam_mat: ShaderMaterial
var _y_tex: CameraTexture
var _feed: CameraFeed
var _img_rect: TextureRect
var _dialog: FileDialog
var _items: Array = []
var _cam_wait := 0.0


func _setup() -> void:
	id = "patch_room"
	title = "Frequency patching room"
	steps = ["Pick what to look at: your webcam, a scene or a picture.", "The filter removes big blurry shapes and keeps the fine detail.", "Try other filters in the bar at the top, and slide Coarse ↔ Fine.", "Every minute here counts toward today's goal."]
	instructions = ""

	_cam_mat = ShaderMaterial.new()
	_cam_mat.shader = preload("res://shaders/camera.gdshader")
	_cam_rect = ColorRect.new()
	_cam_rect.material = _cam_mat
	_cam_rect.mouse_filter = MOUSE_FILTER_IGNORE
	_cam_rect.hide()
	add_child(_cam_rect)

	_img_rect = TextureRect.new()
	_img_rect.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	_img_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_img_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_img_rect.mouse_filter = MOUSE_FILTER_IGNORE
	_img_rect.hide()
	add_child(_img_rect)

	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	for i in 40:
		_items.append({"kind": rng.randi() % 6, "u": rng.randf(), "shelf": rng.randi() % 4,
			"s": rng.randf_range(0.6, 1.2), "hue": rng.randf(), "seed": rng.randi()})


func _begin() -> void:
	prev_filter = Filter.mode
	if Filter.mode == Filter.Mode.OFF:
		Filter.set_mode(Filter.Mode.HIGH_PASS)
	set_answers([
		{"id": "camera", "text": "Webcam", "icon": "camera"},
		{"id": "scene", "text": "Scene", "icon": "shelf"},
		{"id": "image", "text": "Picture…", "icon": "image"},
	], Vector2(120, 96))
	_use_camera()


func _on_answer(a: Variant) -> void:
	match a:
		"camera":
			_use_camera()
		"scene":
			source = Source.CABINET
			_cam_rect.hide()
			_img_rect.hide()
			set_status("Built-in scene")
			queue_redraw()
		"image":
			_open_dialog()


func _close(again := false) -> void:
	if _feed:
		_feed.feed_is_active = false
	if started:
		Filter.set_mode(prev_filter)
	super(again)


func _use_camera() -> void:
	CameraServer.monitoring_feeds = true
	source = Source.CAMERA
	_cam_wait = 3.0
	set_status("Looking for a camera…")
	_try_start_feed()


func _try_start_feed() -> bool:
	if CameraServer.get_feed_count() == 0:
		return false
	_feed = CameraServer.get_feed(0)
	if _feed.formats.size() > 0:
		_feed.set_format(0, {})
	_feed.feed_is_active = true
	_y_tex = CameraTexture.new()
	_y_tex.camera_feed_id = _feed.get_id()
	_y_tex.which_feed = CameraServer.FEED_Y_IMAGE
	var cbcr := CameraTexture.new()
	cbcr.camera_feed_id = _feed.get_id()
	cbcr.which_feed = CameraServer.FEED_CBCR_IMAGE
	_cam_mat.set_shader_parameter("y_tex", _y_tex)
	_cam_mat.set_shader_parameter("cbcr_tex", cbcr)
	_cam_rect.show()
	_img_rect.hide()
	_cam_wait = 0.0
	set_status("Webcam: %s" % _feed.get_name())
	return true


func _tick(delta: float) -> void:
	queue_redraw()
	if source == Source.CAMERA:
		if _feed == null:
			_cam_wait -= delta
			if not _try_start_feed() and _cam_wait <= 0.0:
				set_status("No camera found. Allow camera access in System Settings › Privacy › Camera. Showing the built-in scene.")
				source = Source.CABINET
				queue_redraw()
		else:
			_cam_mat.set_shader_parameter("is_ycbcr", _feed.get_datatype() == CameraFeed.FEED_YCBCR_SEP)
			var ts := _y_tex.get_size()
			if ts.x > 0:
				var s := maxf(size.x / ts.x, size.y / ts.y)
				_cam_rect.size = ts * s
				_cam_rect.position = (size - _cam_rect.size) / 2.0


func _on_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo:
		return
	match k.keycode:
		KEY_C: _on_answer("camera")
		KEY_V: _on_answer("scene")
		KEY_O: _on_answer("image")


func _open_dialog() -> void:
	if _dialog == null:
		_dialog = FileDialog.new()
		_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
		_dialog.access = FileDialog.ACCESS_FILESYSTEM
		_dialog.use_native_dialog = true
		_dialog.filters = PackedStringArray(["*.png, *.jpg, *.jpeg, *.webp ; Images"])
		_dialog.file_selected.connect(_load_image)
		add_child(_dialog)
	_dialog.popup_centered_ratio(0.6)


func _load_image(path: String) -> void:
	var img := Image.load_from_file(path)
	if img == null:
		set_status("Could not open %s" % path)
		return
	_img_rect.texture = ImageTexture.create_from_image(img)
	_img_rect.show()
	_cam_rect.hide()
	source = Source.IMAGE
	set_status(path.get_file())
	grab_focus()


## A shelf of objects with very different spatial-frequency content (gratings,
## checkerboards, text, smooth gradients, dots), after the paper's curated displays.
func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.55, 0.5, 0.46))
	if not started or source != Source.CABINET:
		return
	var w := size.x
	var h := size.y
	# Floor checkerboard.
	var tile := 48.0
	for y in range(int(h * 0.82), int(h), int(tile)):
		for x in range(0, int(w), int(tile)):
			if (x / int(tile) + y / int(tile)) % 2 == 0:
				draw_rect(Rect2(x, y, tile, tile), Color(0.25, 0.22, 0.2))
	var shelf_y := [h * 0.22, h * 0.42, h * 0.62, h * 0.8]
	for sy in shelf_y:
		draw_rect(Rect2(w * 0.05, sy, w * 0.9, 10), Color(0.3, 0.2, 0.12))
	for it in _items:
		var s: float = it["s"] * clampf(h * 0.07, 30, 80)
		var base := Vector2(w * 0.08 + it["u"] * w * 0.84, shelf_y[it["shelf"]])
		var col := Color.from_hsv(it["hue"], 0.6, 0.8)
		match it["kind"]:
			0:  # sphere with a smooth gradient
				for i in 12:
					draw_circle(base + Vector2(-i * s * 0.02, -s - i * s * 0.03), s * (1.0 - i / 13.0), col.lightened(i / 14.0))
			1:  # striped box
				var r := Rect2(base - Vector2(s * 0.8, s * 1.6), Vector2(s * 1.6, s * 1.6))
				draw_rect(r, col)
				for i in 8:
					draw_rect(Rect2(r.position + Vector2(i * r.size.x / 8.0, 0), Vector2(r.size.x / 16.0, r.size.y)), col.darkened(0.6))
			2:  # checkerboard cube
				var n := 6
				var c := s * 1.4 / n
				for i in n:
					for j in n:
						if (i + j) % 2 == 0:
							draw_rect(Rect2(base + Vector2(-s * 0.7 + i * c, -s * 1.4 + j * c), Vector2(c, c)), Color(0.95, 0.95, 0.95))
						else:
							draw_rect(Rect2(base + Vector2(-s * 0.7 + i * c, -s * 1.4 + j * c), Vector2(c, c)), Color(0.1, 0.1, 0.1))
			3:  # book with text
				draw_rect(Rect2(base - Vector2(s * 0.6, s * 1.8), Vector2(s * 1.2, s * 1.8)), Color(0.95, 0.93, 0.85))
				for i in 6:
					draw_string(font, base + Vector2(-s * 0.55, -s * 1.6 + i * s * 0.28), "the quick fox", HORIZONTAL_ALIGNMENT_LEFT, s * 1.1, int(maxf(6, s * 0.2)), Color(0.15, 0.15, 0.15))
			4:  # speckled stone
				var rng := RandomNumberGenerator.new()
				rng.seed = it["seed"]
				draw_circle(base + Vector2(0, -s * 0.6), s * 0.7, col.darkened(0.3))
				for i in 60:
					var p := Vector2.from_angle(rng.randf() * TAU) * rng.randf() * s * 0.65
					draw_circle(base + Vector2(0, -s * 0.6) + p, maxf(1.0, s * 0.03), Color(0.95, 0.95, 0.9))
			5:  # vase outline
				var pts := PackedVector2Array()
				for i in 20:
					var t := i / 19.0
					pts.append(base + Vector2(s * (0.3 + 0.35 * sin(t * PI * 1.3)), -t * s * 2.0))
				for i in range(19, -1, -1):
					var t := i / 19.0
					pts.append(base + Vector2(-s * (0.3 + 0.35 * sin(t * PI * 1.3)), -t * s * 2.0))
				draw_colored_polygon(pts, col)


func _summary() -> Dictionary:
	return {"text": "Filter time today: %d min of your %d min goal." % [int(Lab.filter_minutes_today()), int(Lab.settings["daily_filter_goal_min"])]}
