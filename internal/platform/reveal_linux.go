package platform

import (
	"errors"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// RevealPath asks the desktop's file manager to select the entry, falling
// back to opening its folder when no FileManager1 service is available.
func RevealPath(path string) error {
	if _, err := os.Stat(path); err != nil {
		return errors.New("文件已移动或删除")
	}
	// GVariant text syntax: a quote in the URI would end the string literal.
	uri := strings.ReplaceAll((&url.URL{Scheme: "file", Path: path}).String(), "'", "%27")
	if exec.Command("gdbus", "call", "--session", "--dest", "org.freedesktop.FileManager1", "--object-path", "/org/freedesktop/FileManager1", "--method", "org.freedesktop.FileManager1.ShowItems", "['"+uri+"']", "").Run() == nil {
		return nil
	}
	if err := spawn("xdg-open", filepath.Dir(path)); err != nil {
		return errors.New("无法在文件管理器中显示")
	}
	return nil
}
