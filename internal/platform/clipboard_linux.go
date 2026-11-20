package platform

import (
	"errors"
	"os"
	"os/exec"
	"strings"
)

// ClipboardChange has no cheap counterpart on X11/Wayland; callers compare text.
func ClipboardChange() int64 { return -1 }

var errClipboardTool = errors.New("记录剪贴板需要安装 wl-clipboard（Wayland）或 xclip（X11），用来识别密码管理器的隐藏标记")

// clipboardTool returns commands listing the clipboard's types and reading its
// text. GTK through Wails exposes neither the types nor, on Wayland, an
// unfocused clipboard.
func clipboardTool() (types, text []string, err error) {
	if os.Getenv("WAYLAND_DISPLAY") != "" {
		if bin, err := exec.LookPath("wl-paste"); err == nil {
			return []string{bin, "--list-types"}, []string{bin, "--no-newline", "--type", "text"}, nil
		}
	}
	if os.Getenv("DISPLAY") != "" {
		if bin, err := exec.LookPath("xclip"); err == nil {
			return []string{bin, "-selection", "clipboard", "-o", "-t", "TARGETS"}, []string{bin, "-selection", "clipboard", "-o", "-t", "UTF8_STRING"}, nil
		}
	}
	return nil, nil, errClipboardTool
}
func ClipboardReady() error {
	_, _, err := clipboardTool()
	return err
}

// ReadClipboard skips content KeePassXC and other KDE-aware password managers
// mark with x-kde-passwordManagerHint, and refuses to read without a tool
// that can see that mark.
func ReadClipboard() (string, bool) {
	types, text, err := clipboardTool()
	if err != nil {
		return "", false
	}
	listed, err := exec.Command(types[0], types[1:]...).Output()
	if err != nil || strings.Contains(string(listed), "x-kde-passwordManagerHint") {
		return "", false
	}
	out, err := exec.Command(text[0], text[1:]...).Output()
	return string(out), err == nil && len(out) > 0
}
