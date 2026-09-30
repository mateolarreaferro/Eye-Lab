#!/bin/bash
# Play the VR scene on a flat screen (mouse + keyboard). See scripts/desktop_player.gd.
cd "$(dirname "$0")"
GODOT="${GODOT:-$HOME/Desktop/Godot.app/Contents/MacOS/Godot}"
exec "$GODOT" --path . --xr-mode off res://desktop.tscn "$@"
