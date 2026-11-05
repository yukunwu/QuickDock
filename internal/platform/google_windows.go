package platform

import (
	"encoding/json"
	"errors"
	"github.com/wailsapp/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

type windowsGoogle struct {
	browser *edge.Chromium
	child   uintptr
	path    string
	state   googleState
}

var windowsGooglePages = map[uintptr]*windowsGoogle{}

func AttachGooglePage(window unsafe.Pointer, path, raw string) error {
	var options googleOptions
	if err := json.Unmarshal([]byte(raw), &options); err != nil {
		return err
	}
	parent := uintptr(window)
	page := windowsGooglePages[parent]
	if page == nil {
		instance, _, _ := windows.NewLazySystemDLL("kernel32.dll").NewProc("GetModuleHandleW").Call(0)
		class, _ := windows.UTF16PtrFromString("STATIC")
		child, _, _ := user32.NewProc("CreateWindowExW").Call(0, uintptr(unsafe.Pointer(class)), 0, 0x40000000|0x10000000|0x04000000, 0, 0, 100, 100, parent, 0, instance, 0)
		if child == 0 {
			return errors.New("无法创建Google网页容器")
		}
		browser := edge.NewChromium()
		data, _ := os.UserCacheDir()
		browser.DataPath = filepath.Join(data, "QuickDock", "GoogleWebView2")
		page = &windowsGoogle{browser: browser, child: child, path: path, state: loadGoogleState(path, options)}
		if !browser.Embed(child) {
			user32.NewProc("DestroyWindow").Call(child)
			return errors.New("Google网页无法启动，请安装Microsoft Edge WebView2 Runtime")
		}
		windowsGooglePages[parent] = page
		script := strings.ReplaceAll(googleDraftScript, "QD_SEND", "window.chrome.webview.postMessage")
		browser.MessageCallback = func(raw string, _ *edge.ICoreWebView2, args *edge.ICoreWebView2WebMessageReceivedEventArgs) {
			source, err := args.GetSource()
			if err != nil || !strings.HasPrefix(source, "https://translate.google.com/") {
				return
			}
			var state googleState
			if len(raw) < 100*1024 && json.Unmarshal([]byte(raw), &state) == nil && validGoogleState(state) {
				page.state = state
				_ = saveGoogleState(page.path, state)
			}
		}
		browser.Init(script)
		browser.Navigate(googleURL(page.state))
	}
	r := options.Rect
	if len(r) > 0 {
		dpi, _, _ := user32.NewProc("GetDpiForWindow").Call(parent)
		scale := float64(dpi) / 96
		if scale == 0 {
			scale = 1
		}
		user32.NewProc("SetWindowPos").Call(page.child, 0, uintptr(r["x"]*scale), uintptr(r["y"]*scale), uintptr(r["width"]*scale), uintptr(r["height"]*scale), 0x4|0x10)
		page.browser.Resize()
	}
	if options.Browser {
		return Open(googleURL(page.state), false)
	}
	if options.Submit {
		page.state = options.googleState
		if err := saveGoogleState(path, page.state); err != nil {
			return err
		}
		page.browser.Navigate(googleURL(page.state))
	}
	if options.Reload {
		page.browser.Navigate(googleURL(page.state))
	}
	return nil
}
func DetachGooglePage(window unsafe.Pointer) {
	page := windowsGooglePages[uintptr(window)]
	if page == nil {
		return
	}
	_ = saveGoogleState(page.path, page.state)
	controller := page.browser.GetController()
	if controller != nil {
		page.browser.ShuttingDown()
		view, _ := controller.GetCoreWebView2()
		vtable := *(*uintptr)(unsafe.Pointer(controller))
		closeProc := *(*uintptr)(unsafe.Pointer(vtable + 24*unsafe.Sizeof(uintptr(0))))
		syscall.SyscallN(closeProc, uintptr(unsafe.Pointer(controller)))
		if view != nil {
			// GetCoreWebView2 above owns one reference; Chromium stores the
			// original GetCoreWebView2 reference plus an explicit AddRef.
			view.Release()
			view.Release()
			view.Release()
		}
		controller.Release()
		env := page.browser.Environment()
		if env != nil {
			table := *(*uintptr)(unsafe.Pointer(env))
			release := *(*uintptr)(unsafe.Pointer(table + 2*unsafe.Sizeof(uintptr(0))))
			syscall.SyscallN(release, uintptr(unsafe.Pointer(env)))
		}
	}
	user32.NewProc("DestroyWindow").Call(page.child)
	delete(windowsGooglePages, uintptr(window))
}
func FlushGooglePage(window unsafe.Pointer) {
	if p := windowsGooglePages[uintptr(window)]; p != nil {
		_ = saveGoogleState(p.path, p.state)
	}
}
