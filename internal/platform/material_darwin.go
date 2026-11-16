package platform

/*
#cgo LDFLAGS: -framework Cocoa -framework WebKit
#include <stdlib.h>
void qd_material(void *window, const char *theme);
void qd_material_theme(void *window, const char *theme);
*/
import "C"
import "unsafe"

// ConfigureMaterial runs on the AppKit thread once the WebView is ready.
func ConfigureMaterial(window unsafe.Pointer, theme string) {
	raw := C.CString(theme)
	defer C.free(unsafe.Pointer(raw))
	C.qd_material(window, raw)
}

// SetMaterialTheme keeps the blur appearance in step with the app theme.
// It must run on the AppKit thread.
func SetMaterialTheme(window unsafe.Pointer, theme string) {
	raw := C.CString(theme)
	defer C.free(unsafe.Pointer(raw))
	C.qd_material_theme(window, raw)
}
