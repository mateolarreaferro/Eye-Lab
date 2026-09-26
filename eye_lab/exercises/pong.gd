extends Exercise
## Predictive pursuit: Pong against the computer. With the occluder on (O), the ball
## vanishes behind a band in the middle and you have to predict where it comes out.

const WIN_SCORE := 7

var ball := Vector2.ZERO
var vel := Vector2.ZERO
var player_y := 0.0
var ai_y := 0.0
var score := [0, 0]      # [ai, player]
var hits := 0
var misses := 0
var occluder := true
var serving := 0.0


func _setup() -> void:
	id = "pong"
	title = "Predictive pursuit"
	steps = ["Your paddle is on the right. Move it with the mouse.", "Bounce the ball back past the computer.", "The grey band hides the ball, so predict where it comes out.", "First to %d points wins." % WIN_SCORE]
	instructions = "You can switch the hiding band off with the button at the bottom."


func _begin() -> void:
	player_y = size.y / 2.0
	ai_y = size.y / 2.0
	_update_toggle()
	_serve(1)


func _update_toggle() -> void:
	set_answers([{"id": "occluder", "text": "Hiding band: " + ("on" if occluder else "off"), "icon": "hide" if occluder else "eye"}], Vector2(190, 64))


func _on_answer(_a: Variant) -> void:
	occluder = not occluder
	_update_toggle()


func _ball_r() -> float:
	return clampf(ppd() * 0.25, 7.0, 16.0)


func _paddle_h() -> float:
	return size.y * 0.14


func _serve(towards: int) -> void:
	ball = size / 2.0
	var ang := randf_range(-0.5, 0.5)
	vel = Vector2(towards * cos(ang), sin(ang)) * size.x * 0.32
	serving = 0.8


func _tick(delta: float) -> void:
	if Input.is_key_pressed(KEY_UP) or Input.is_key_pressed(KEY_W):
		player_y -= size.y * 1.2 * delta
	if Input.is_key_pressed(KEY_DOWN) or Input.is_key_pressed(KEY_S):
		player_y += size.y * 1.2 * delta
	var ph := _paddle_h()
	player_y = clampf(player_y, ph / 2.0, size.y - ph / 2.0)

	# The computer tracks the ball with a capped speed, so it can be beaten.
	var target_y := ball.y if vel.x < 0 else size.y / 2.0
	ai_y = move_toward(ai_y, target_y, size.y * 0.55 * delta)

	queue_redraw()
	if serving > 0.0:
		serving -= delta
		return
	var r := _ball_r()
	ball += vel * delta
	if ball.y < r or ball.y > size.y - r:
		vel.y = -vel.y
		ball.y = clampf(ball.y, r, size.y - r)

	var px := size.x - 40.0
	var ax := 40.0
	if vel.x > 0 and ball.x + r >= px and ball.x < px + 10 and absf(ball.y - player_y) < ph / 2.0 + r:
		hits += 1
		_bounce(player_y, -1)
	elif vel.x < 0 and ball.x - r <= ax and ball.x > ax - 10 and absf(ball.y - ai_y) < ph / 2.0 + r:
		_bounce(ai_y, 1)

	if ball.x > size.x + r:
		misses += 1
		score[0] += 1
		feedback(false)
		_after_point(-1)
	elif ball.x < -r:
		score[1] += 1
		feedback(true)
		_after_point(1)


func _bounce(paddle_y: float, dir: int) -> void:
	var off := clampf((ball.y - paddle_y) / (_paddle_h() / 2.0), -1.0, 1.0)
	var speed := vel.length() * 1.05
	vel = Vector2(dir * cos(off * 0.9), sin(off * 0.9)) * speed


func _after_point(towards: int) -> void:
	set_status("You %d  –  %d Computer  ·  %d returns" % [score[1], score[0], hits])
	if score[0] >= WIN_SCORE or score[1] >= WIN_SCORE:
		end()
	else:
		_serve(towards)


func _on_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		player_y = event.position.y
	var k := event as InputEventKey
	if k and k.pressed and not k.echo and k.keycode == KEY_O:
		_on_answer("occluder")


func _draw_scene() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.05, 0.05, 0.05))
	if not started or _ended:
		return
	for y in range(0, int(size.y), 30):
		draw_rect(Rect2(size.x / 2.0 - 2, y, 4, 16), Color(0.5, 0.5, 0.5))
	var ph := _paddle_h()
	draw_rect(Rect2(size.x - 40, player_y - ph / 2.0, 10, ph), Color.WHITE)
	draw_rect(Rect2(30, ai_y - ph / 2.0, 10, ph), Color.WHITE)
	var r := _ball_r()
	draw_rect(Rect2(ball - Vector2(r, r), Vector2(r, r) * 2), Color.WHITE)
	if occluder:
		draw_rect(Rect2(size.x * 0.4, 0, size.x * 0.2, size.y), Color(0.35, 0.35, 0.37))
	draw_string(font, Vector2(0, 130), "%d        %d" % [score[0], score[1]], HORIZONTAL_ALIGNMENT_CENTER, size.x, 48, Color(0.8, 0.8, 0.8))


func _summary() -> Dictionary:
	var total := hits + misses
	if total < 3:
		return {"text": "Too short to score."}
	var rate := 100.0 * hits / total
	return {
		"value": rate,
		"unit": "% returned",
		"text": "%s  (%d – %d)\nYou returned %d of %d balls (%.0f%%)%s.\n\nHigher is better." % [
			"You win!" if score[1] > score[0] else "Computer wins", score[1], score[0], hits, total, rate,
			" with the occluder on" if occluder else ""],
		"detail": {"occluder": occluder},
	}
