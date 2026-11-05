#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
probe_dir=$(mktemp -d /tmp/quickdock-linux-google.XXXXXX)
trap 'rm -rf "$probe_dir"' EXIT
python3 - "$PWD" "$probe_dir" <<'PY'
from pathlib import Path
import json,sys
root,tmp=map(Path,sys.argv[1:])
source=(root/'internal/platform/google_linux.go').read_text()+'''
// Test-only native observation, excluded from distribution.
func GoogleProbeStatus(window unsafe.Pointer) string {
 p:=linuxGooglePages[uintptr(window)];if p==nil{return "detached"};return gtkGoogle.getURI(p.view)
}
func GoogleProbeLoad(window unsafe.Pointer, url string) {
 p:=linuxGooglePages[uintptr(window)];if p!=nil{gtkGoogle.load(p.view,url)}
}
'''
(tmp/'google_linux.go').write_text(source)
(tmp/'overlay.json').write_text(json.dumps({'Replace':{str(root/'main.go'):str(root/'scripts/linux-google-probe.go.txt'),str(root/'internal/platform/google_linux.go'):str(tmp/'google_linux.go')}}))
PY
GOOS=linux CGO_ENABLED=0 go build -overlay "$probe_dir/overlay.json" -tags 'production,purego,gtk3' -o "$probe_dir/probe" .
xvfb-run -a dbus-run-session -- env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 QUICKDOCK_PROBE_DIR="$probe_dir/data" "$probe_dir/probe"
