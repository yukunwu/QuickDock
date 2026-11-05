#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
probe_tmp=$(mktemp -d /tmp/quickdock-window-probe.XXXXXX)
trap 'rm -rf "$probe_tmp"' EXIT
python3 - "$PWD" "$probe_tmp" <<'PY'
import json,sys
from pathlib import Path
root,tmp=map(Path,sys.argv[1:])
(tmp/'overlay.json').write_text(json.dumps({'Replace':{str(root/'main.go'):str(root/'scripts/native-tool-windows.go.txt')}}))
PY
MACOSX_DEPLOYMENT_TARGET=13.0 CGO_CFLAGS='-mmacosx-version-min=13.0' CGO_LDFLAGS='-mmacosx-version-min=13.0 -Wl,-no_warn_duplicate_libraries' go build -overlay "$probe_tmp/overlay.json" -tags production -o "$probe_tmp/probe" .
QUICKDOCK_PROBE_DIR="$probe_tmp/data" "$probe_tmp/probe"
python3 - "$probe_tmp/data/tool-windows/text.json" <<'PY'
import json,sys
state=json.load(open(sys.argv[1]))
assert state['open'] and json.loads(state['session'])['draft']['input']=='quit-flush-draft',state
print('PASS AppKit quit flushes last input and preserves open state')
PY
QUICKDOCK_PROBE_DIR="$probe_tmp/data" QUICKDOCK_PROBE_RESTORE=1 "$probe_tmp/probe"
