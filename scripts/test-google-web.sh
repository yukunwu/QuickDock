#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
google_probe_tmp=$(mktemp -d /tmp/quickdock-google-probe.XXXXXX)
trap 'rm -rf "$google_probe_tmp"' EXIT
clang -fblocks -Wno-incompatible-pointer-types -framework Cocoa -framework WebKit scripts/google-web-probe.m -o "$google_probe_tmp/probe"
"$google_probe_tmp/probe" "$google_probe_tmp/state.json"
