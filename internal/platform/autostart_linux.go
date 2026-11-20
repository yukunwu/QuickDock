package platform

import (
	"os"
	"path/filepath"
	"quickdock/internal/core"
)

func WatchLoginLaunch()                  {}
func LaunchedAtLogin(args []string) bool { return core.LaunchedByAutostart(args) }
func OpenLoginItemSettings()             {}
func autostartPath() (string, error) {
	dir, err := os.UserConfigDir()
	return filepath.Join(dir, "autostart", "quickdock.desktop"), err
}
func autostartEntry() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return core.AutostartDesktopEntry(exe), nil
}
func LoginItemStatus() core.LoginItem {
	path, err := autostartPath()
	if err != nil {
		return core.LoginItem{}
	}
	raw, err := os.ReadFile(path)
	want, _ := autostartEntry()
	return core.LoginItem{Supported: true, Enabled: err == nil && string(raw) == want}
}
func SetLoginItem(enabled bool) error {
	path, err := autostartPath()
	if err != nil {
		return err
	}
	if !enabled {
		if err = os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	entry, err := autostartEntry()
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(entry), 0600)
}
