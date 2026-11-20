package platform

import (
	"github.com/wailsapp/wails/v3/pkg/w32"
	"golang.org/x/sys/windows"
	"runtime"
	"time"
	"unsafe"
)

var (
	kernel32                = windows.NewLazySystemDLL("kernel32.dll")
	clipboardSequence       = user32.NewProc("GetClipboardSequenceNumber")
	registerClipboardFormat = user32.NewProc("RegisterClipboardFormatW")
	clipboardFormatPresent  = user32.NewProc("IsClipboardFormatAvailable")
	openClipboard           = user32.NewProc("OpenClipboard")
	closeClipboard          = user32.NewProc("CloseClipboard")
	getClipboardData        = user32.NewProc("GetClipboardData")
	globalLock              = kernel32.NewProc("GlobalLock")
	globalUnlock            = kernel32.NewProc("GlobalUnlock")
	globalSize              = kernel32.NewProc("GlobalSize")
)

func ClipboardChange() int64 {
	n, _, _ := clipboardSequence.Call()
	return int64(n)
}
func clipboardFormat(name string) uintptr {
	p, _ := windows.UTF16PtrFromString(name)
	format, _, _ := registerClipboardFormat.Call(uintptr(unsafe.Pointer(p)))
	return format
}
func clipboardHas(format uintptr) bool {
	present, _, _ := clipboardFormatPresent.Call(format)
	return format != 0 && present != 0
}

// clipboardFlag reads a DWORD-valued clipboard format. Open and close must
// happen on one OS thread; another app may hold the clipboard briefly.
func clipboardFlag(format uintptr) (uint32, bool) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	opened := false
	for i := 0; i < 20 && !opened; i++ {
		if r, _, _ := openClipboard.Call(0); r != 0 {
			opened = true
		} else {
			time.Sleep(5 * time.Millisecond)
		}
	}
	if !opened {
		return 0, false
	}
	defer closeClipboard.Call()
	h, _, _ := getClipboardData.Call(format)
	if h == 0 {
		return 0, false
	}
	if size, _, _ := globalSize.Call(h); size < 4 {
		return 0, false
	}
	p, _, _ := globalLock.Call(h)
	if p == 0 {
		return 0, false
	}
	defer globalUnlock.Call(h)
	return *(*uint32)(unsafe.Pointer(p)), true
}

// ReadClipboard skips copies that opt out of monitors (password managers set
// ExcludeClipboardContentFromMonitorProcessing) or of clipboard history
// (CanIncludeInClipboardHistory = 0). An unreadable flag counts as opting out.
func ReadClipboard() (string, bool) {
	for _, name := range []string{"ExcludeClipboardContentFromMonitorProcessing", "Clipboard Viewer Ignore"} {
		if clipboardHas(clipboardFormat(name)) {
			return "", false
		}
	}
	if format := clipboardFormat("CanIncludeInClipboardHistory"); clipboardHas(format) {
		if allowed, ok := clipboardFlag(format); !ok || allowed == 0 {
			return "", false
		}
	}
	text, err := w32.GetClipboardText()
	return text, err == nil && text != ""
}

// ClipboardReady reports whether copies can be recorded safely here.
func ClipboardReady() error { return nil }
