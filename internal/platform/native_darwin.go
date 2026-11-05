package platform

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework CFNetwork -framework WebKit
#include <stdlib.h>
void qd_google_attach(void* window,const char* path,const char* json);
void qd_google_detach(void* window);
void qd_google_flush(void* window);
char* qd_proxy(const char* raw);
char* qd_metadata(const char* path);
void qd_place(void* window, int followMouse);
char* qd_open(const char* target, int isApp);
*/
import "C"
import (
	"encoding/json"
	"errors"
	"quickdock/internal/core"
	"unsafe"
)

func Metadata(path string) (core.AppEntry, error) {
	p := C.CString(path)
	defer C.free(unsafe.Pointer(p))
	raw := C.qd_metadata(p)
	if raw == nil {
		return core.AppEntry{}, errors.New("无法读取应用包")
	}
	defer C.free(unsafe.Pointer(raw))
	var entry core.AppEntry
	err := json.Unmarshal([]byte(C.GoString(raw)), &entry)
	return entry, err
}
func Open(target string, isApp bool) error {
	p := C.CString(target)
	defer C.free(unsafe.Pointer(p))
	flag := C.int(0)
	if isApp {
		flag = 1
	}
	err := C.qd_open(p, flag)
	if err != nil {
		defer C.free(unsafe.Pointer(err))
		return errors.New(C.GoString(err))
	}
	return nil
}

// PlaceWindow must run on the AppKit main thread. Cocoa points handle mixed-DPI displays.
func PlaceWindow(window unsafe.Pointer, followMouse bool) {
	if window == nil {
		return
	}
	flag := C.int(0)
	if followMouse {
		flag = 1
	}
	C.qd_place(window, flag)
}

func SystemProxy(target string) (string, error) {
	p := C.CString(target)
	defer C.free(unsafe.Pointer(p))
	raw := C.qd_proxy(p)
	if raw == nil {
		return "", nil
	}
	defer C.free(unsafe.Pointer(raw))
	value := C.GoString(raw)
	if value == "PAC" {
		return "", errors.New("翻译暂不支持系统PAC代理，请使用系统HTTP代理")
	}
	return value, nil
}

func AttachGooglePage(window unsafe.Pointer, path, options string, onEscape func()) error {
	setGoogleEscape(window, onEscape)
	p := C.CString(path)
	o := C.CString(options)
	defer C.free(unsafe.Pointer(p))
	defer C.free(unsafe.Pointer(o))
	C.qd_google_attach(window, p, o)
	return nil
}
func DetachGooglePage(window unsafe.Pointer) {
	C.qd_google_detach(window)
	setGoogleEscape(window, nil)
}
func FlushGooglePage(window unsafe.Pointer) { C.qd_google_flush(window) }
