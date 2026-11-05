#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
WAILS_BIN="${WAILS3_BIN:-$(go env GOPATH)/bin/wails3}"
if [[ "$("$WAILS_BIN" version 2>&1)" != "v3.1.0" ]]; then echo 'Wails CLI v3.1.0 is required'; exit 1; fi
"$WAILS_BIN" generate bindings -ts -i -b
pnpm --dir frontend build
quickdock_version=$(cat VERSION)
mkdir -p bin/QuickDock.app/Contents/{MacOS,Resources}
swift scripts/icon.swift bin/QuickDock.iconset
cp bin/QuickDock.iconset/icon_32x32@2x.png build/tray.png
MACOSX_DEPLOYMENT_TARGET=13.0 CGO_CFLAGS='-mmacosx-version-min=13.0' CGO_LDFLAGS='-mmacosx-version-min=13.0 -Wl,-no_warn_duplicate_libraries' go build -tags production -trimpath -ldflags="-s -w -X quickdock/internal/core.Version=$quickdock_version" -o bin/QuickDock.app/Contents/MacOS/QuickDock .
cp build/Info.plist bin/QuickDock.app/Contents/Info.plist
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $quickdock_version" bin/QuickDock.app/Contents/Info.plist
printf APPLQQDK > bin/QuickDock.app/Contents/PkgInfo
iconutil -c icns bin/QuickDock.iconset -o bin/QuickDock.app/Contents/Resources/QuickDock.icns
codesign --force --deep --sign - bin/QuickDock.app
codesign --verify --deep --strict bin/QuickDock.app
echo "Built: $(pwd)/bin/QuickDock.app"
