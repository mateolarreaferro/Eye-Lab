#!/bin/bash
# Builds "Eye Lab Overlay.app" (the whole-screen filter helper) into ../build/.
set -euo pipefail
cd "$(dirname "$0")"
APP="../build/Eye Lab Overlay.app"
BIN="$APP/Contents/MacOS/EyeLabOverlay"
# Skip when up to date: re-signing makes macOS ask for screen-recording permission again.
if [ -f "$BIN" ] && [ "$BIN" -nt main.swift ] && [ "$BIN" -nt Info.plist ] && [ "${1:-}" != "--force" ]; then
	echo "Overlay up to date: $APP"
	exit 0
fi
mkdir -p "$APP/Contents/MacOS"
cp Info.plist "$APP/Contents/Info.plist"
xcrun swiftc -O -target arm64-apple-macos14.0 main.swift -o /tmp/EyeLabOverlay-arm64 \
	-framework AppKit -framework ScreenCaptureKit -framework Metal \
	-framework MetalPerformanceShaders -framework CoreMedia -framework CoreVideo -framework QuartzCore -framework Network
xcrun swiftc -O -target x86_64-apple-macos14.0 main.swift -o /tmp/EyeLabOverlay-x86_64 \
	-framework AppKit -framework ScreenCaptureKit -framework Metal \
	-framework MetalPerformanceShaders -framework CoreMedia -framework CoreVideo -framework QuartzCore -framework Network
lipo -create /tmp/EyeLabOverlay-arm64 /tmp/EyeLabOverlay-x86_64 -output "$APP/Contents/MacOS/EyeLabOverlay"
codesign --force --sign - --identifier com.mateolarrea.eyelab.overlay "$APP"
echo "Built $APP"
