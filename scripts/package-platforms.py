#!/usr/bin/env python3
"""Package verified binaries; nfpm writes DEB/RPM without a host package manager."""
import argparse,hashlib,json,os,plistlib,shutil,subprocess,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--version',default=(root/'VERSION').read_text().strip());p.add_argument('--nfpm',default=os.environ.get('NFPM_BIN','nfpm'));p.add_argument('--platform',choices=['all','linux','windows','darwin'],default='all');a=p.parse_args()
out=root/'bin/releases';out.mkdir(parents=True,exist_ok=True)
icon=root/'build/tray.png'
for arch,label in [('amd64','x64'),('arm64','arm64')]:
 if a.platform in ('all','linux'):
  binary=root/f'bin/cross/quickdock-linux-{label}'
  if not binary.is_file():raise SystemExit(f'Missing {binary}')
  (out/'quickdock.desktop').write_text('[Desktop Entry]\nType=Application\nName=QuickDock\nName[zh_CN]=QuickDock 快捷工具\nComment=Application launcher and everyday tools\nExec=quickdock\nIcon=quickdock\nTerminal=false\nCategories=Utility;\nStartupWMClass=com.quickdock.desktop\n')
  for fmt in ('deb','rpm'):
   config={'name':'quickdock','arch':arch,'platform':'linux','version':a.version,'section':'utils','priority':'optional','maintainer':'QuickDock contributors','description':'QuickDock application launcher and everyday tools','license':'Proprietary','contents':[{'src':str(binary),'dst':'/usr/bin/quickdock','file_info':{'mode':493}},{'src':str(out/'quickdock.desktop'),'dst':'/usr/share/applications/quickdock.desktop'},{'src':str(icon),'dst':'/usr/share/icons/hicolor/64x64/apps/quickdock.png'}],'depends':(['libgtk-3-0','libwebkit2gtk-4.1-0','libglib2.0-bin','xdg-utils','dbus-x11','libx11-6'] if fmt=='deb' else ['gtk3','webkit2gtk4.1','glib2','xdg-utils','dbus-x11','libX11'])}
   cfg=out/f'nfpm-{arch}-{fmt}.json';cfg.write_text(json.dumps(config))
   target=out/f'QuickDock-{a.version}-linux-{label}.{fmt}'
   subprocess.run([a.nfpm,'package','--config',str(cfg),'--packager',fmt,'--target',str(target)],check=True)
   cfg.unlink()
 if a.platform in ('all','windows'):
  binary=root/f'bin/cross/QuickDock-windows-{label}.exe'
  if not binary.is_file():raise SystemExit(f'Missing {binary}')
  with zipfile.ZipFile(out/f'QuickDock-{a.version}-windows-{label}.zip','w',zipfile.ZIP_DEFLATED) as z:
   z.write(binary,'QuickDock.exe')
 if a.platform in ('all','darwin'):
  binary=root/f'bin/cross/QuickDock-macos-{label}';app=out/f'macos-{label}/QuickDock.app'
  (app/'Contents/MacOS').mkdir(parents=True,exist_ok=True);(app/'Contents/Resources').mkdir(parents=True,exist_ok=True)
  shutil.copy2(binary,app/'Contents/MacOS/QuickDock');os.chmod(app/'Contents/MacOS/QuickDock',0o755)
  plist=plistlib.loads((root/'build/Info.plist').read_bytes());plist['CFBundleShortVersionString']=a.version;(app/'Contents/Info.plist').write_bytes(plistlib.dumps(plist));shutil.copy2(root/'bin/QuickDock.app/Contents/Resources/QuickDock.icns',app/'Contents/Resources/QuickDock.icns')
  subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True);subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
  with zipfile.ZipFile(out/f'QuickDock-{a.version}-macos-{label}.zip','w',zipfile.ZIP_DEFLATED) as z:
   for f in sorted(app.rglob('*')):
    if f.is_file():z.write(f,str(f.relative_to(app.parent)))
  subprocess.run(['python3',str(root/'scripts/package-macos-dmg.py'),str(app),str(out/f'QuickDock-{a.version}-macos-{label}.dmg'),'--version',a.version],check=True)
files=sorted([f for f in out.iterdir() if f.suffix in ('.deb','.rpm','.zip','.dmg') and f.name.startswith(f'QuickDock-{a.version}-')]);(out/'SHA256SUMS.txt').write_text(''.join(f'{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.name}\n' for f in files))
print(f'Packaged {len(files)} archives under {out}')
