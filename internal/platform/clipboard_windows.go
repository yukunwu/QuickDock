package platform

import (
	"github.com/wailsapp/wails/v3/pkg/w32"
	"golang.org/x/sys/windows"
	"unsafe"
)

var (
	clipboardSequence       = user32.NewProc("GetClipboardSequenceNumber")
	registerClipboardFormat = user32.NewProc("RegisterClipboardFormatW")
	clipboardFormatPresent  = user32.NewProc("IsClipboardFormatAvailable")
)

func ClipboardChange() int64 {
	n, _, _ := clipboardSequence.Call()
	return int64(n)
}

// Formats that password managers and other sources set to opt out of
// clipboard history and monitors.
var excludedClipboardFormats = []string{"ExcludeClipboardContentFromMonitorProcessing", "CanIncludeInClipboardHistory", "Clipboard Viewer Ignore"}

func ReadClipboard() (string, bool) {
	for _, name := range excludedClipboardFormats {
		p, _ := windows.UTF16PtrFromString(name)
		if format, _, _ := registerClipboardFormat.Call(uintptr(unsafe.Pointer(p))); format != 0 {
			if present, _, _ := clipboardFormatPresent.Call(format); present != 0 {
				return "", false
			}
		}
	}
	text, err := w32.GetClipboardText()
	return text, err == nil && text != ""
}
