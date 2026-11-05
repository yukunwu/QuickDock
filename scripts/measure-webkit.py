#!/usr/bin/env python3
"""Measure only the probe and its owned WebKit helpers; no desktop automation."""
import json, re, subprocess, sys, threading, time
from pathlib import Path
root = Path(__file__).resolve().parent.parent
probe = subprocess.Popen(['/tmp/quickdock-webkit-probe', str(root/'frontend/dist'), str(root/'scripts/webkit-resource.js')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
records, cpu_samples, messages = [], [], []
pids = [probe.pid]
def refresh_pids():
    domain = subprocess.run(['launchctl','print',f'pid/{probe.pid}'],capture_output=True,text=True).stdout
    return [probe.pid]+[int(m.group(1)) for m in re.finditer(r'^\s*([1-9]\d*)\s+\S+\s+com\.apple\.WebKit\.',domain,re.M)]
def sample_cpu():
    while probe.poll() is None:
        text = subprocess.run(['ps','-p',','.join(map(str,pids)),'-o','pid=,rss=,pcpu=,time='],capture_output=True,text=True).stdout
        cpu_samples.append({'elapsed':round(time.monotonic()-started,3),'ps':text.strip()})
        time.sleep(.25)
started=time.monotonic()
thread=threading.Thread(target=sample_cpu,daemon=True);thread.start()
for line in probe.stdout:
    line=line.strip();messages.append(line);print(line,flush=True)
    if line.startswith('STAGE'):
        pids=refresh_pids()
        cmd=['footprint']
        for pid in pids:cmd+=['-p',str(pid)]
        cmd+=['--noCategories','--swapped']
        text=subprocess.run(cmd,capture_output=True,text=True).stdout
        match=re.search(r'Summary Footprint: (.+)',text)
        records.append({'stage':line,'elapsed':round(time.monotonic()-started,3),'pids':pids,'footprint':text})
        print('FOOTPRINT',match.group(1) if match else 'unavailable',flush=True)
code=probe.wait();thread.join(timeout=1)
target=Path(sys.argv[1]) if len(sys.argv)>1 else root/'docs/validation/webkit-resources.json'
target.write_text(json.dumps({'scope':'System WKWebView offscreen, production frontend, disposable preview bridge; not full QuickDock app','forcedGC':False,'exitCode':code,'messages':messages,'stages':records,'cpuSamples':cpu_samples},indent=2)+'\n')
sys.exit(code)
