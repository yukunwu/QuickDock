package platform

/*
#cgo LDFLAGS: -framework Cocoa -framework WebKit
void qd_material(void *window);
*/
import "C"
import "unsafe"

// ConfigureMaterial runs on the AppKit thread once the WebView is ready.
func ConfigureMaterial(window unsafe.Pointer) { C.qd_material(window) }
