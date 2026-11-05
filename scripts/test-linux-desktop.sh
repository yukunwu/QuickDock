#!/bin/bash
set -euo pipefail
quickdock_test_binary=$(realpath "$1")
quickdock_test_dir=$(mktemp -d /tmp/quickdock-desktop.XXXXXX)
trap 'rm -rf "$quickdock_test_dir"' EXIT
export QUICKDOCK_TEST_BINARY="$quickdock_test_binary" QUICKDOCK_TEST_DIR="$quickdock_test_dir"
# Xvfb is an isolated X11 desktop; no keys go to the user's desktop.
xvfb-run -a dbus-run-session -- bash -euo pipefail <<'TEST'
export XDG_CONFIG_HOME="$QUICKDOCK_TEST_DIR/config" XDG_CACHE_HOME="$QUICKDOCK_TEST_DIR/cache" XDG_SESSION_TYPE=x11
unset WAYLAND_DISPLAY
if [[ "${QUICKDOCK_TEST_UNSANDBOXED:-0}" == 1 ]]; then
 export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 # root container only
fi
openbox >"$QUICKDOCK_TEST_DIR/wm.log" 2>&1 &
"$QUICKDOCK_TEST_BINARY" >"$QUICKDOCK_TEST_DIR/app.log" 2>&1 &
quickdock_pid=$!
trap 'kill "$quickdock_pid" 2>/dev/null || true' EXIT
window=''
for i in {1..100}; do
 window=$(xdotool search --onlyvisible --name '^QuickDock$' 2>/dev/null | head -1 || true)
 [[ -n "$window" ]] && break
 if ! kill -0 "$quickdock_pid" 2>/dev/null; then cat "$QUICKDOCK_TEST_DIR/app.log"; exit 1; fi
 sleep .1
done
if [[ -z "$window" ]]; then cat "$QUICKDOCK_TEST_DIR/app.log"; exit 1; fi
# Native window mapping precedes the WebKit runtime handshake on slower hosts.
for i in {1..200}; do
 if grep -q 'window runtime ready' "$QUICKDOCK_TEST_DIR/app.log"; then break; fi
 sleep .1
done
grep -q 'window runtime ready' "$QUICKDOCK_TEST_DIR/app.log"
xdotool windowactivate --sync "$window"
xdotool key --clearmodifiers ctrl+alt+space
sleep .5
if xdotool search --onlyvisible --name '^QuickDock$' >/dev/null 2>&1; then echo 'FAIL shortcut did not hide'; cat "$QUICKDOCK_TEST_DIR/app.log"; exit 1; fi
xdotool key --clearmodifiers ctrl+alt+space
sleep .5
xdotool search --onlyvisible --name '^QuickDock$' >/dev/null
"$QUICKDOCK_TEST_BINARY" --toggle >"$QUICKDOCK_TEST_DIR/second.log" 2>&1
sleep .5
if xdotool search --onlyvisible --name '^QuickDock$' >/dev/null 2>&1; then echo 'FAIL second-instance toggle did not hide'; exit 1; fi
"$QUICKDOCK_TEST_BINARY" --toggle >>"$QUICKDOCK_TEST_DIR/second.log" 2>&1
sleep .5
xdotool search --onlyvisible --name '^QuickDock$' >/dev/null
test -f "$XDG_CONFIG_HOME/QuickDock/apps.json"
python3 - "$XDG_CONFIG_HOME/QuickDock/apps.json" <<'PY'
import json,sys
state=json.load(open(sys.argv[1]));rows=state.get('apps',state.get('Apps',[]))
assert rows,'No desktop applications indexed'
print('PASS Linux indexed',len(rows),'desktop applications')
PY
echo 'PASS Linux GTK/WebKit window visible and Ctrl+Alt+Space show/hide'
echo 'PASS second-instance --toggle hides/shows original window'
TEST
