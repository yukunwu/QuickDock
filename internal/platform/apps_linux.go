package platform

import (
	"encoding/base64"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"quickdock/internal/core"
	"strings"
)

func ScanApplications() ([]core.AppEntry, error) {
	home, _ := os.UserHomeDir()
	data := os.Getenv("XDG_DATA_HOME")
	if data == "" {
		data = filepath.Join(home, ".local", "share")
	}
	dirs := os.Getenv("XDG_DATA_DIRS")
	if dirs == "" {
		dirs = "/usr/local/share:/usr/share"
	}
	roots := []string{filepath.Join(data, "applications")}
	for _, dir := range filepath.SplitList(dirs) {
		roots = append(roots, filepath.Join(dir, "applications"))
	}
	roots = append(roots, "/var/lib/flatpak/exports/share/applications", filepath.Join(home, ".local/share/flatpak/exports/share/applications"), "/var/lib/snapd/desktop/applications")
	locale := os.Getenv("LC_ALL")
	if locale == "" {
		locale = os.Getenv("LC_MESSAGES")
	}
	if locale == "" {
		locale = os.Getenv("LANG")
	}
	return core.ScanDesktopFiles(roots, locale, os.Getenv("XDG_CURRENT_DESKTOP"), func(name string) bool { _, err := exec.LookPath(name); return err == nil }, linuxIcon)
}
func linuxIcon(name string) string {
	if name == "" {
		return ""
	}
	paths := []string{name}
	home, _ := os.UserHomeDir()
	if !filepath.IsAbs(name) {
		for _, root := range []string{filepath.Join(home, ".local/share/icons"), "/usr/share/icons/hicolor", "/usr/share/icons/Adwaita", "/usr/share/icons/breeze", "/usr/share/pixmaps"} {
			for _, size := range []string{"96x96/apps", "64x64/apps", "48x48/apps", "128x128/apps", "256x256/apps", "scalable/apps", ""} {
				for _, ext := range []string{".png", ".svg", ""} {
					paths = append(paths, filepath.Join(root, size, name+ext))
				}
			}
		}
	}
	for _, p := range paths {
		ext := strings.ToLower(filepath.Ext(p))
		if ext != ".png" && ext != ".svg" {
			continue
		}
		info, err := os.Stat(p)
		if err != nil || info.Size() > 256*1024 {
			continue
		}
		data, err := os.ReadFile(p)
		if err == nil {
			mime := "image/png"
			if ext == ".svg" {
				mime = "image/svg+xml"
			}
			return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
		}
	}
	return ""
}
func spawn(command string, args ...string) error {
	cmd := exec.Command(command, args...)
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}
func LaunchApplication(path string) error {
	if filepath.Ext(path) != ".desktop" {
		return errors.New("不是有效的桌面应用入口")
	}
	if _, err := os.Stat(path); err != nil {
		return errors.New("应用入口已移动或删除，请刷新索引")
	}
	// GIO parses desktop Exec field codes and never invokes a shell here.
	return exec.Command("gio", "launch", path).Run()
}
func Open(target string, isApp bool) error {
	if isApp {
		return LaunchApplication(target)
	}
	if err := core.ValidateURL(target); err != nil {
		return err
	}
	return spawn("xdg-open", target)
}
func SystemProxy(target string) (string, error) { return "", nil } // WebKitGTK follows desktop proxy settings itself.
