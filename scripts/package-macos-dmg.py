#!/usr/bin/env python3
"""Build and verify a read-only drag-to-Applications disk image."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile


def make_dmg(app: Path, target: Path, version: str) -> None:
    app = app.resolve()
    target = target.resolve()
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    with tempfile.TemporaryDirectory(prefix='quickdock-dmg-') as tmp:
        stage = Path(tmp) / 'contents'
        stage.mkdir()
        subprocess.run(['ditto', str(app), str(stage / 'QuickDock.app')], check=True)
        os.symlink('/Applications', stage / 'Applications')
        (stage / '安装说明.txt').write_text(
            '将 QuickDock.app 拖入 Applications 后，从“应用程序”中打开。\n'
            '请先推出此磁盘映像，再使用应用内更新。\n', encoding='utf-8')
        subprocess.run([
            'hdiutil', 'create', '-ov', '-format', 'UDZO', '-fs', 'HFS+',
            '-volname', f'QuickDock {version}', '-srcfolder', str(stage), str(target)
        ], check=True)
        subprocess.run(['hdiutil', 'verify', str(target)], check=True)
        mount = Path(tmp) / 'mounted'
        mount.mkdir()
        subprocess.run(['hdiutil', 'attach', '-readonly', '-nobrowse', '-mountpoint', str(mount), str(target)], check=True)
        try:
            assert (mount / 'Applications').is_symlink()
            assert os.readlink(mount / 'Applications') == '/Applications'
            subprocess.run(['codesign', '--verify', '--deep', '--strict', str(mount / 'QuickDock.app')], check=True)
            original = app / 'Contents/MacOS/QuickDock'
            installed = mount / 'QuickDock.app/Contents/MacOS/QuickDock'
            import hashlib
            assert hashlib.sha256(original.read_bytes()).digest() == hashlib.sha256(installed.read_bytes()).digest()
        finally:
            subprocess.run(['hdiutil', 'detach', str(mount)], check=True)
    print(f'PASS verified DMG: {target.name}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('app', type=Path)
    parser.add_argument('target', type=Path)
    parser.add_argument('--version', required=True)
    args = parser.parse_args()
    make_dmg(args.app, args.target, args.version)
