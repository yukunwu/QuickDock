package platform

import (
	"encoding/json"
	"errors"
	"github.com/ebitengine/purego"
	"strings"
	"sync"
	"unsafe"
)

type gtkGoogleAPI struct {
	managerNew      func() uintptr
	registerMessage func(uintptr, string) int32
	webviewNew      func(uintptr) uintptr
	scriptNew       func(string, int32, int32, uintptr, uintptr) uintptr
	addScript       func(uintptr, uintptr)
	unrefScript     func(uintptr)
	load            func(uintptr, string)
	reload          func(uintptr)
	getURI          func(uintptr) string
	jsValue         func(uintptr) uintptr
	jsString        func(uintptr) uintptr
	free            func(uintptr)
	connect         func(uintptr, string, uintptr, uintptr, uintptr, int32) uint64
	disconnect      func(uintptr, uint64)
	children        func(uintptr) uintptr
	remove          func(uintptr, uintptr)
	add             func(uintptr, uintptr)
	overlayNew      func() uintptr
	overlayAdd      func(uintptr, uintptr)
	marginStart     func(uintptr, int32)
	marginTop       func(uintptr, int32)
	alignH          func(uintptr, int32)
	alignV          func(uintptr, int32)
	size            func(uintptr, int32, int32)
	show            func(uintptr)
	destroy         func(uintptr)
	ref             func(uintptr) uintptr
	unref           func(uintptr)
	setPass         func(uintptr, uintptr, int32)
}

var gtkGoogle gtkGoogleAPI
var gtkGoogleOnce sync.Once
var gtkGoogleErr error

func loadGtkGoogle() error {
	gtkGoogleOnce.Do(func() {
		lib, err := purego.Dlopen("libwebkit2gtk-4.1.so.0", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			gtkGoogleErr = err
			return
		}
		bind := func(ptr any, name string) { purego.RegisterLibFunc(ptr, lib, name) }
		bind(&gtkGoogle.managerNew, "webkit_user_content_manager_new")
		bind(&gtkGoogle.registerMessage, "webkit_user_content_manager_register_script_message_handler")
		bind(&gtkGoogle.webviewNew, "webkit_web_view_new_with_user_content_manager")
		bind(&gtkGoogle.scriptNew, "webkit_user_script_new")
		bind(&gtkGoogle.addScript, "webkit_user_content_manager_add_script")
		bind(&gtkGoogle.unrefScript, "webkit_user_script_unref")
		bind(&gtkGoogle.load, "webkit_web_view_load_uri")
		bind(&gtkGoogle.reload, "webkit_web_view_reload")
		bind(&gtkGoogle.getURI, "webkit_web_view_get_uri")
		bind(&gtkGoogle.jsValue, "webkit_javascript_result_get_js_value")
		bind(&gtkGoogle.jsString, "jsc_value_to_string")
		bind(&gtkGoogle.free, "g_free")
		bind(&gtkGoogle.connect, "g_signal_connect_data")
		bind(&gtkGoogle.disconnect, "g_signal_handler_disconnect")
		bind(&gtkGoogle.children, "gtk_bin_get_child")
		bind(&gtkGoogle.remove, "gtk_container_remove")
		bind(&gtkGoogle.add, "gtk_container_add")
		bind(&gtkGoogle.overlayNew, "gtk_overlay_new")
		bind(&gtkGoogle.overlayAdd, "gtk_overlay_add_overlay")
		bind(&gtkGoogle.marginStart, "gtk_widget_set_margin_start")
		bind(&gtkGoogle.marginTop, "gtk_widget_set_margin_top")
		bind(&gtkGoogle.alignH, "gtk_widget_set_halign")
		bind(&gtkGoogle.alignV, "gtk_widget_set_valign")
		bind(&gtkGoogle.size, "gtk_widget_set_size_request")
		bind(&gtkGoogle.show, "gtk_widget_show_all")
		bind(&gtkGoogle.destroy, "gtk_widget_destroy")
		bind(&gtkGoogle.ref, "g_object_ref")
		bind(&gtkGoogle.unref, "g_object_unref")
		bind(&gtkGoogle.setPass, "gtk_overlay_set_overlay_pass_through")
	})
	return gtkGoogleErr
}

type linuxGoogle struct {
	view, overlay, container, manager uintptr
	signal                            uint64
	path                              string
	state                             googleState
	escape                            func()
}

var linuxGooglePages = map[uintptr]*linuxGoogle{}

func cString(ptr uintptr) string {
	if ptr == 0 {
		return ""
	}
	bytes := []byte{}
	for i := uintptr(0); i < 1024*1024; i++ {
		b := *(*byte)(unsafe.Pointer(ptr + i))
		if b == 0 {
			break
		}
		bytes = append(bytes, b)
	}
	return string(bytes)
}

var gtkGoogleCallback = purego.NewCallback(func(manager, result, data uintptr) {
	page := linuxGooglePages[data]
	if page == nil {
		return
	}
	if !strings.HasPrefix(gtkGoogle.getURI(page.view), "https://translate.google.com/") {
		return
	}
	raw := gtkGoogle.jsString(gtkGoogle.jsValue(result))
	if raw == 0 {
		return
	}
	defer gtkGoogle.free(raw)
	text := cString(raw)
	var action struct {
		Action string `json:"action"`
	}
	if len(text) < 100*1024 && json.Unmarshal([]byte(text), &action) == nil && action.Action == "escape" {
		if page.escape != nil {
			page.escape()
		}
		return
	}
	var state googleState
	if len(text) < 100*1024 && json.Unmarshal([]byte(text), &state) == nil && validGoogleState(state) {
		page.state = state
		_ = saveGoogleState(page.path, state)
	}
})

func AttachGooglePage(window unsafe.Pointer, path, raw string, onEscape func()) error {
	if err := loadGtkGoogle(); err != nil {
		return errors.New("Google网页需要WebKitGTK 4.1：" + err.Error())
	}
	var options googleOptions
	if err := json.Unmarshal([]byte(raw), &options); err != nil {
		return err
	}
	parent := uintptr(window)
	page := linuxGooglePages[parent]
	if page == nil {
		manager := gtkGoogle.managerNew()
		view := gtkGoogle.webviewNew(manager)
		container := gtkGoogle.children(parent)
		if container == 0 {
			gtkGoogle.destroy(view)
			gtkGoogle.unref(manager)
			return errors.New("未找到工具窗口容器")
		}
		overlay := gtkGoogle.overlayNew()
		gtkGoogle.ref(container)
		gtkGoogle.remove(parent, container)
		gtkGoogle.add(overlay, container)
		gtkGoogle.add(parent, overlay)
		gtkGoogle.unref(container)
		// Only the webpage rectangle receives input. A full-size GtkFixed overlay
		// would also cover the local toolbar and intercept its return/close clicks.
		gtkGoogle.overlayAdd(overlay, view)
		gtkGoogle.setPass(overlay, view, 0)
		gtkGoogle.alignH(view, 1)
		gtkGoogle.alignV(view, 1)
		page = &linuxGoogle{view: view, overlay: overlay, container: container, manager: manager, path: path, state: loadGoogleState(path, options), escape: onEscape}
		linuxGooglePages[parent] = page
		gtkGoogle.registerMessage(manager, "quickdockGoogleDraft")
		page.signal = gtkGoogle.connect(manager, "script-message-received::quickdockGoogleDraft", gtkGoogleCallback, parent, 0, 0)
		script := gtkGoogle.scriptNew(strings.ReplaceAll(googleDraftScript, "QD_SEND", "window.webkit.messageHandlers.quickdockGoogleDraft.postMessage"), 1, 1, 0, 0)
		gtkGoogle.addScript(manager, script)
		gtkGoogle.unrefScript(script)
		gtkGoogle.load(view, googleURL(page.state))
		gtkGoogle.show(overlay)
	}
	if options.Browser {
		return Open(googleURL(page.state), false)
	}
	if r := options.Rect; len(r) > 0 {
		gtkGoogle.marginStart(page.view, int32(r["x"]))
		gtkGoogle.marginTop(page.view, int32(r["y"]))
		gtkGoogle.size(page.view, int32(r["width"]), int32(r["height"]))
	}
	if options.Submit {
		page.state = options.googleState
		if err := saveGoogleState(path, page.state); err != nil {
			return err
		}
		gtkGoogle.load(page.view, googleURL(page.state))
	}
	if options.Reload {
		gtkGoogle.reload(page.view)
	}
	return nil
}
func DetachGooglePage(window unsafe.Pointer) {
	parent := uintptr(window)
	page := linuxGooglePages[parent]
	if page == nil {
		return
	}
	_ = saveGoogleState(page.path, page.state)
	gtkGoogle.disconnect(page.manager, page.signal)
	gtkGoogle.ref(page.container)
	gtkGoogle.remove(page.overlay, page.container)
	gtkGoogle.destroy(page.overlay)
	gtkGoogle.add(parent, page.container)
	gtkGoogle.unref(page.container)
	gtkGoogle.unref(page.manager)
	delete(linuxGooglePages, parent)
}
func FlushGooglePage(window unsafe.Pointer) {
	if p := linuxGooglePages[uintptr(window)]; p != nil {
		_ = saveGoogleState(p.path, p.state)
	}
}
