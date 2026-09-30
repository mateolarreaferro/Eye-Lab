class_name SatieWorld
extends Node
## Main-thread host adapter. Source identity and mappings come from a hash-checked
## manifest. The native core alone chooses takes, schedules and renders audio.

var stream_resource: SatieAudioStream
var player: AudioStreamPlayer
var playback: SatiePlayback
var manifest: Dictionary
var sources: Dictionary = {}
var hosts: Dictionary = {}
var listener: Node3D
var last_frame: int = 0
var occurrence: int = 0
var rejected_commands: int = 0

func load_scene(bundle_path: String, manifest_path: String) -> bool:
	if player != null:
		return false
	var decoded = JSON.parse_string(FileAccess.get_file_as_string(manifest_path))
	if not decoded is Dictionary or decoded.get("profile") != "satie.portable.stereo/1" or decoded.get("schema") != "satie.portable.bundle/1" or decoded.get("abi") != 1:
		return false
	manifest = decoded
	var stream := SatieAudioStream.new()
	if not stream.load_bundle(bundle_path, manifest.get("bundleSha256", "")):
		return false
	if not manifest.get("sources") is Array or manifest.sources.size() != stream.source_count():
		return false
	for i in manifest.sources.size():
		var source = manifest.sources[i]
		if not source is Dictionary or not source.get("id") is String or sources.has(source.id):
			sources.clear()
			return false
		if not source.get("bindings") is Array or source.bindings.size() != 2:
			sources.clear()
			return false
		if not source.has("host") or not (source.host == null or source.host is String):
			sources.clear()
			return false
		for binding in source.bindings:
			if binding != null and (not binding is Dictionary or not binding.get("signal") is String):
				sources.clear()
				return false
		sources[source.id] = i
	player = AudioStreamPlayer.new()
	stream_resource = stream
	# A non-positional player: SATIE has already spatialized the stereo output.
	add_child(player)
	return true

func bind_host(id: String, node: Node3D) -> void:
	hosts[id] = node

func start() -> bool:
	if player == null or playback != null:
		return false
	if is_instance_valid(listener):
		if not stream_resource.prepare_pose(0, listener.global_position, listener.global_basis.orthonormalized().x, true):
			return false
	for i in manifest.sources.size():
		var host_id = manifest.sources[i].host
		if hosts.has(host_id) and is_instance_valid(hosts[host_id]):
			if not stream_resource.prepare_pose(i, hosts[host_id].global_position, Vector3.ZERO, false):
				return false
	player.stream = stream_resource
	player.play()
	playback = player.get_stream_playback() as SatiePlayback
	return playback != null

func _frame() -> int:
	# Next published block boundary. Commands arriving after that boundary are
	# applied immediately and counted late; the adapter does not hide latency.
	last_frame = maxi(last_frame, playback.audio_frame())
	return last_frame

func _send(kind: int, source: int, values: PackedFloat32Array, slot: int = 0, sequence: int = 0) -> bool:
	if playback == null:
		return false
	var result := playback.command(_frame(), kind, source, slot, sequence, values)
	if result != 0:
		rejected_commands += 1
	return result == 0

func contact(source_id: String, position_metres: Vector3) -> bool:
	if not sources.has(source_id) or occurrence == 4294967295:
		return false
	occurrence += 1
	return _send(1, sources[source_id], PackedFloat32Array([position_metres.x, position_metres.y, position_metres.z]), 0, occurrence)

func control(source_id: String, signal_name: String, measurement: float) -> bool:
	if not sources.has(source_id):
		return false
	var index: int = sources[source_id]
	var matched := false
	for slot in 2:
		var binding = manifest.sources[index].bindings[slot]
		if binding != null and binding.signal == signal_name:
			matched = true
			if not _send(4, index, PackedFloat32Array([measurement]), slot):
				return false
	return matched

func unbind_host(id: String) -> void:
	if playback != null:
		for i in manifest.sources.size():
			if manifest.sources[i].host == id:
				_send(5, i, PackedFloat32Array())
	hosts.erase(id)

func _physics_process(_delta: float) -> void:
	if playback == null:
		return
	if is_instance_valid(listener):
		var p := listener.global_position
		var right := listener.global_basis.orthonormalized().x
		_send(3, 0, PackedFloat32Array([p.x, p.y, p.z, right.x, right.y, right.z]))
	for id in hosts.keys():
		var node = hosts[id]
		if not is_instance_valid(node):
			unbind_host(id)
			continue
		var p: Vector3 = node.global_position
		for i in manifest.sources.size():
			if manifest.sources[i].host == id:
				_send(2, i, PackedFloat32Array([p.x, p.y, p.z]))

func shutdown() -> void:
	if player != null:
		player.stop()
		player.queue_free()
		player = null
	playback = null
	stream_resource = null
	hosts.clear()
	sources.clear()
	last_frame = 0
	occurrence = 0

func _exit_tree() -> void:
	shutdown()
