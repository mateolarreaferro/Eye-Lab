#!/bin/bash
# Compile the SATIE audio world: scene.satie + inputs.json + assets/ -> city.satp + manifest.
# Needs a SATIE checkout (portable core compiler); set SATIE_REPO if it isn't the default.
set -euo pipefail
cd "$(dirname "$0")"
SATIE_REPO="${SATIE_REPO:-$HOME/attractor-labs/apps/satie}"
OUT="$(mktemp -d)"
(cd "$SATIE_REPO" && node --import tsx packages/satie-core/compiler/cli.ts "$OLDPWD/scene.satie" "$OLDPWD/inputs.json" "$OUT")
mv "$OUT/scene.satp" city.satp
mv "$OUT/scene.manifest.json" city.manifest.json
rmdir "$OUT"
