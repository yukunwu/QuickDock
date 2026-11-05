#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
"${WAILS3_BIN:-$(go env GOPATH)/bin/wails3}" generate bindings -ts -i -b
pnpm --dir frontend build
mkdir -p bin/cross
quickdock_version=$(cat VERSION)
for target_arch in amd64 arm64; do
 target_label=x64; [[ "$target_arch" == arm64 ]] && target_label=arm64
 GOOS=windows GOARCH="$target_arch" CGO_ENABLED=0 go build -trimpath -tags production -ldflags="-s -w -H windowsgui -X quickdock/internal/core.Version=$quickdock_version" -o "bin/cross/QuickDock-windows-$target_label.exe" .
 GOOS=linux GOARCH="$target_arch" CGO_ENABLED=0 go build -trimpath -tags 'production,purego,gtk3' -ldflags="-s -w -X quickdock/internal/core.Version=$quickdock_version" -o "bin/cross/quickdock-linux-$target_label" .
 if [[ "$(uname -s)" == Darwin ]]; then
  clang_arch=x86_64; [[ "$target_arch" == arm64 ]] && clang_arch=arm64
  GOOS=darwin GOARCH="$target_arch" CGO_ENABLED=1 CC="clang -arch $clang_arch" MACOSX_DEPLOYMENT_TARGET=13.0 CGO_CFLAGS="-arch $clang_arch -mmacosx-version-min=13.0" CGO_LDFLAGS="-arch $clang_arch -mmacosx-version-min=13.0 -Wl,-no_warn_duplicate_libraries" go build -trimpath -tags production -ldflags="-s -w -X quickdock/internal/core.Version=$quickdock_version" -o "bin/cross/QuickDock-macos-$target_label" .
 fi
done
