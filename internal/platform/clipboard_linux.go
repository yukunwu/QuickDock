package platform

import "github.com/wailsapp/wails/v3/pkg/application"

// ClipboardChange has no cheap counterpart on X11/Wayland; callers compare text.
func ClipboardChange() int64 { return -1 }

// ReadClipboard goes through GTK on the main thread. Wayland compositors may
// only expose the clipboard while QuickDock has focus.
func ReadClipboard() (string, bool) {
	app := application.Get()
	if app == nil {
		return "", false
	}
	text := application.InvokeSyncWithResult(func() string {
		text, _ := app.Clipboard.Text()
		return text
	})
	return text, text != ""
}
