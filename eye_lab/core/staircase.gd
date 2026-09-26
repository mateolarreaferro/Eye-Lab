class_name Staircase
extends RefCounted
## Adaptive N-down-1-up staircase with multiplicative steps.
## 2-down converges on ~71% correct, 3-down on ~79%.

var value: float
var min_value: float
var max_value: float
var step: float
var larger_is_easier: bool
var down: int
var reversals: Array[float] = []
var trials := 0
var correct := 0

var _run := 0
var _last_dir := 0


func _init(start: float, lo: float, hi: float, step_factor := 1.4, larger_easier := true, n_down := 2) -> void:
	value = start
	min_value = lo
	max_value = hi
	step = step_factor
	larger_is_easier = larger_easier
	down = n_down


func record(was_correct: bool) -> void:
	trials += 1
	if was_correct:
		correct += 1
		_run += 1
		if _run >= down:
			_run = 0
			_move(-1)
	else:
		_run = 0
		_move(1)


## dir -1 = make it harder, +1 = make it easier.
func _move(dir: int) -> void:
	if _last_dir != 0 and dir != _last_dir:
		reversals.append(value)
	_last_dir = dir
	# Big steps until the first two reversals, then finer ones.
	var f := step if reversals.size() < 2 else sqrt(step)
	var grow := (dir == 1) == larger_is_easier
	value = clampf(value * f if grow else value / f, min_value, max_value)


## Geometric mean of the last (up to) six reversals; current value if too few.
func threshold() -> float:
	if reversals.size() < 2:
		return value
	var last := reversals.slice(maxi(0, reversals.size() - 6))
	var s := 0.0
	for v in last:
		s += log(v)
	return exp(s / last.size())


func accuracy() -> float:
	return float(correct) / maxi(trials, 1)
