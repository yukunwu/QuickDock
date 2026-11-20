package platform

/*
#cgo LDFLAGS: -framework Cocoa
#include <stdlib.h>
long qd_clipboard_change(void);
char* qd_clipboard_text(void);
*/
import "C"
import "unsafe"

// ClipboardChange returns NSPasteboard's change count, so polling never reads
// the pasteboard unless something was copied.
func ClipboardChange() int64 { return int64(C.qd_clipboard_change()) }

// ReadClipboard returns copied text, or false for content its source marks
// as concealed or transient (password managers) or that has no text.
func ReadClipboard() (string, bool) {
	raw := C.qd_clipboard_text()
	if raw == nil {
		return "", false
	}
	defer C.free(unsafe.Pointer(raw))
	return C.GoString(raw), true
}
