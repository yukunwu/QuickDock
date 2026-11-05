(async () => {
  const report = (s) => window.webkit.messageHandlers.probe.postMessage(s);
  const pause = (ms) => new Promise(r=>setTimeout(r,ms));
  const wait = async (fn) => { const until=Date.now()+30000; while(!fn()) {if(Date.now()>until) throw Error('timeout: '+document.body.innerText.slice(-1000)); await pause(50);} };
  const input = () => document.querySelector('[aria-label="工具输入"]');
  const output = () => document.querySelector('[aria-label="工具结果"]');
  const fill = (el,text) => { Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,text); el.dispatchEvent(new Event('input',{bubbles:true})); };
  try {
    const phase=Number(sessionStorage.getItem('probe-phase') || '0');
    if (phase > 0) {
      await wait(()=>document.querySelector('.main'));
      if(input()) throw Error('reloaded hidden workspace must stay unmounted');
      report('STAGE reclaimed-'+phase);await pause(5000);
      report('STAGE reclaimed-'+phase+'-idle-5s');await pause(1500);
      window.dispatchEvent(new CustomEvent('quickdock-visibility',{detail:true}));
      await wait(()=>input());
      if(phase<=4) {
        if(input().value.length < 5*1048576) throw Error('lost large draft');
        await wait(()=>output()?.textContent.includes('"cycle": 5'));
        report('STAGE restored-large-draft-'+phase);await pause(1500);
        if(phase===4) {fill(input(),'');await wait(()=>output()?.textContent==='');}
        sessionStorage.setItem('probe-phase',String(phase+1));
        window.dispatchEvent(new CustomEvent('quickdock-visibility',{detail:false}));
        await wait(()=>!input());
        window.dispatchEvent(new Event('quickdock-idle'));
      } else {
        if(input().value!=='') throw Error('cleared draft was resurrected');
        report('DONE system WKWebView custom-scheme 5x5MiB, idle reclamation and lossless draft restoration');
      }
      return;
    }
    await wait(()=>document.querySelector('[aria-label="搜索应用和工具"]'));
    report('STAGE baseline'); await pause(1500);
    const search=document.querySelector('[aria-label="搜索应用和工具"]');fill(search,'json');
    await wait(()=>document.querySelector('[role="option"]'));
    document.querySelector('[role="option"]').click();await wait(()=>input());
    for(let cycle=1;cycle<=5;cycle++) {
      const row=JSON.stringify({id:12345,name:'memory-test',value:'x'.repeat(120)});
      const payload='{"cycle":'+cycle+',"items":['+Array(Math.ceil(5*1048576/(row.length+1))).fill(row).join(',')+']}';
      const start=performance.now();fill(input(),payload);
      await wait(()=>output()?.textContent.includes('"cycle": '+cycle));
      if(output().textContent.length>65536) throw Error('unbounded preview');
      report('STAGE loaded-'+cycle+' elapsedMs='+Math.round(performance.now()-start));await pause(1500);
      window.dispatchEvent(new CustomEvent('quickdock-visibility',{detail:false}));
      await wait(()=>!input());report('STAGE hidden-'+cycle);await pause(1500);
      window.dispatchEvent(new CustomEvent('quickdock-visibility',{detail:true}));
      await wait(()=>input()?.value===payload);
      await wait(()=>output()?.textContent.includes('"cycle": '+cycle));
      if(cycle<5) {fill(input(),'');await wait(()=>output()?.textContent==='');}
    }
    sessionStorage.setItem('probe-phase','1');
    window.dispatchEvent(new CustomEvent('quickdock-visibility',{detail:false}));
    await wait(()=>!input());
    report('STAGE before-idle-reclaim');await pause(1500);
    window.dispatchEvent(new Event('quickdock-idle'));
  } catch(e) {report('FAIL '+e.message)}
})(); void 0;
