#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
quickdock_probe_dir=$(mktemp -d /tmp/quickdock-app-search.XXXXXX)
trap 'rm -rf "$quickdock_probe_dir"' EXIT
python3 - "$PWD" "$quickdock_probe_dir" <<'PY'
import json,sys
from pathlib import Path
root,tmp=map(Path,sys.argv[1:])
(tmp/'overlay.json').write_text(json.dumps({'Replace':{str(root/'main.go'):str(root/'scripts/native-app-search.go.txt')}}))
PY
# Uses isolated settings and the real local application index. Queries are
# validated in WebKit without launching any of the matched user applications.
MACOSX_DEPLOYMENT_TARGET=13.0 CGO_CFLAGS='-mmacosx-version-min=13.0' CGO_LDFLAGS='-mmacosx-version-min=13.0 -Wl,-no_warn_duplicate_libraries' go build -overlay "$quickdock_probe_dir/overlay.json" -tags production -o "$quickdock_probe_dir/probe" .
QUICKDOCK_PROBE_DIR="$quickdock_probe_dir/data" "$quickdock_probe_dir/probe"
