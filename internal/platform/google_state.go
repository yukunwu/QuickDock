package platform

import (
	"encoding/json"
	"os"
	"quickdock/internal/core"
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
