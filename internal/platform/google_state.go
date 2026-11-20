package platform

import (
	"encoding/json"
	"os"
	"quickdock/internal/core"
	"sync"
	"unsafe"
)

type googleState struct {
	Text   string `json:"text"`
	Source string `json:"source"`
	Target string `json:"target"`
}
type googleOptions struct {
	googleState
	Submit  bool               `json:"submit"`
	Reload  bool               `json:"reload"`
	Browser bool               `json:"browser"`
	Rect    map[string]float64 `json:"rect"`
}

func loadGoogleState(path string, options googleOptions) googleState {
	state := options.googleState
	if !options.Submit && path != "" {
		raw, err := os.ReadFile(path)
		var previous googleState
		if err == nil && len(raw) < 100*1024 && json.Unmarshal(raw, &previous) == nil && validGoogleState(previous) {
			state = previous
		}
	}
	return state
}
func validGoogleState(state googleState) bool {
	_, err := core.TranslationPageURL(state.Text, state.Source, state.Target)
	return err == nil
}
func saveGoogleState(path string, state googleState) error {
	if path == "" {
		return nil
	}
	return core.AtomicJSON(path, state)
}
func googleURL(state googleState) string {
	url, _ := core.TranslationPageURL(state.Text, state.Source, state.Target)
	return url
}

const googleDraftScript = `(()=>{if(location.hostname!=='translate.google.com')return;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing&&e.keyCode!==229&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();QD_SEND(JSON.stringify({action:'escape'}));}},true);const send=()=>{const p=new URL(location.href).searchParams,input=document.querySelector('textarea');const state={text:input?input.value:(p.get('text')||''),source:p.get('sl')||'auto',target:p.get('tl')||'zh-CN'};QD_SEND(JSON.stringify(state));};let timer;document.addEventListener('input',e=>{if(e.target instanceof HTMLTextAreaElement){clearTimeout(timer);timer=setTimeout(send,150);}},true);document.addEventListener('click',()=>setTimeout(send,300),true);window.addEventListener('popstate',send);window.addEventListener('pagehide',send);})();`

// googleHistoryScript reports the settled source text and, when present, the
// translated text after the user pauses. Page loads report initial=true so
// reopening a saved page does not reorder history.
const googleHistoryScript = `(()=>{if(location.hostname!=='translate.google.com')return;let timer,tries=0,stale='',seen=null,pending=false;const params=()=>new URL(location.href).searchParams;const current=()=>{const out=document.querySelector('span[jsname="jqKxS"]')||document.querySelector('span[lang="'+(params().get('tl')||'zh-CN')+'"]');return out?out.innerText.trim():'';};const report=(initial)=>{const p=params(),input=document.querySelector('textarea'),text=(input?input.value:(p.get('text')||'')).trim();if(!text){pending=false;return;}let result=current();if((!result||result===stale||result!==seen)&&tries++<12){seen=result;timer=setTimeout(()=>report(initial),600);return;}if(result===stale)result='';pending=false;QD_SEND(JSON.stringify({action:'history',text,source:p.get('sl')||'auto',target:p.get('tl')||'zh-CN',result,initial}));};const soon=(initial,delay)=>{clearTimeout(timer);tries=0;seen=null;timer=setTimeout(()=>report(initial),delay);};document.addEventListener('input',e=>{if(e.target instanceof HTMLTextAreaElement){if(!pending){stale=current();pending=true;}soon(false,1200);}},true);window.addEventListener('popstate',()=>soon(false,1200));soon(true,800);})();`

var googleHistoryHandlers sync.Map

// setGoogleHistory registers where a window's history reports go.
func setGoogleHistory(window unsafe.Pointer, handler func(string)) {
	if handler == nil {
		googleHistoryHandlers.Delete(uintptr(window))
	} else {
		googleHistoryHandlers.Store(uintptr(window), handler)
	}
}
func googleHistory(window uintptr, raw string) {
	if handler, ok := googleHistoryHandlers.Load(window); ok && len(raw) < 200*1024 {
		handler.(func(string))(raw)
	}
}
