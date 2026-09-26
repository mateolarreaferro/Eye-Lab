#!/bin/bash
# Builds everything into build/: Eye Lab.app with Eye Lab Overlay.app bundled inside.
set -euo pipefail
cd "$(dirname "$0")"
GODOT="${GODOT:-$HOME/Desktop/Godot.app/Contents/MacOS/Godot}"

./overlay/build.sh
"$GODOT" --headless --path eye_lab --export-release "macOS" "../build/Eye Lab.app"

APP="build/Eye Lab.app"
# Ship the overlay helper inside Eye Lab's Resources. Eye Lab installs it to
# ~/Applications on first use and runs it from there (see helper_path() in
# filter_layer.gd), so its screen-recording permission survives Eye Lab updates.
rm -rf "$APP/Contents/Resources/Eye Lab Overlay.app"
ditto "build/Eye Lab Overlay.app" "$APP/Contents/Resources/Eye Lab Overlay.app"
# Re-sign the outer app (keeping Godot's camera entitlement) now that it contains the helper.
codesign -d --entitlements - --xml "$APP" > /tmp/eyelab-entitlements.plist 2>/dev/null
codesign --force --sign - --options runtime --entitlements /tmp/eyelab-entitlements.plist "$APP"
codesign --verify --deep --strict "$APP" && echo "Built and verified $APP"
