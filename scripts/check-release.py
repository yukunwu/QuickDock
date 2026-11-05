#!/usr/bin/env python3
"""Updater swaps one executable/app: reject ZIPs with extra top-level entries."""
import hashlib,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
version=(root/'VERSION').read_text().strip()
out=root/'bin/releases'
rows=(out/'SHA256SUMS.txt').read_text().splitlines()
assert len(rows)==8, f'Expected eight release assets, got {len(rows)}'
for row in rows:
    digest,name=row.split('  ',1)
    assert name.startswith(f'QuickDock-{version}-'), name
    assert hashlib.sha256((out/name).read_bytes()).hexdigest()==digest, name
    if name.endswith('.zip'):
        with zipfile.ZipFile(out/name) as z:
            assert z.testzip() is None, name
            top={i.filename.split('/')[0] for i in z.infolist()}
            assert top==({'QuickDock.app'} if '-macos-' in name else {'QuickDock.exe'}), (name,top)
    print('PASS',name)
