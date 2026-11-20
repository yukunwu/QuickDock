#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
quickdock_probe_dir=$(mktemp -d /tmp/quickdock-essentials.XXXXXX)
# The probe copies to the real pasteboard. Snapshot every item and type
# (rich text, images) and restore them exactly afterwards.
cat > "$quickdock_probe_dir/save.js" <<'JS'
ObjC.import('AppKit');
const items = $.NSPasteboard.generalPasteboard.pasteboardItems, out = [];
for (let i = 0; i < items.count; i++) {
  const item = items.objectAtIndex(i), types = item.types, row = {};
  for (let j = 0; j < types.count; j++) {
    const type = types.objectAtIndex(j).js, data = item.dataForType(type);
    if (!data.isNil()) row[type] = data.base64EncodedStringWithOptions(0).js;
  }
  out.push(row);
}
JSON.stringify(out);
JS
cat > "$quickdock_probe_dir/restore.js" <<'JS'
ObjC.import('AppKit');
function run(argv) {
  const saved = JSON.parse($.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null).js);
  const board = $.NSPasteboard.generalPasteboard, items = $.NSMutableArray.array;
  board.clearContents;
  for (const row of saved) {
    const item = $.NSPasteboardItem.alloc.init;
    for (const type in row) item.setDataForType($.NSData.alloc.initWithBase64EncodedStringOptions(row[type], 0), type);
    items.addObject(item);
  }
  if (saved.length) board.writeObjects(items);
}
JS
osascript -l JavaScript "$quickdock_probe_dir/save.js" > "$quickdock_probe_dir/clipboard.json"
trap 'osascript -l JavaScript "$quickdock_probe_dir/restore.js" "$quickdock_probe_dir/clipboard.json"; rm -rf "$quickdock_probe_dir"' EXIT
python3 - "$PWD" "$quickdock_probe_dir" <<'PY'
import json,sys
from pathlib import Path
root,tmp=map(Path,sys.argv[1:])
(tmp/'overlay.json').write_text(json.dumps({'Replace':{str(root/'main.go'):str(root/'scripts/native-launcher-essentials.go.txt')}}))
PY
MACOSX_DEPLOYMENT_TARGET=13.0 CGO_CFLAGS='-mmacosx-version-min=13.0' CGO_LDFLAGS='-mmacosx-version-min=13.0 -Wl,-no_warn_duplicate_libraries' go build -overlay "$quickdock_probe_dir/overlay.json" -tags production -o "$quickdock_probe_dir/probe" .
QUICKDOCK_PROBE_DIR="$quickdock_probe_dir/data" "$quickdock_probe_dir/probe"
