package platform

import (
	"errors"
	"golang.org/x/sys/windows/registry"
	"os"
	"quickdock/internal/core"
	"strings"
)

const runKey = `Software\Microsoft\Windows\CurrentVersion\Run`

func WatchLoginLaunch()                  {}
func LaunchedAtLogin(args []string) bool { return core.LaunchedByAutostart(args) }
func OpenLoginItemSettings()             {}
func autostartCommand() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return `"` + exe + `" ` + core.AutostartFlag, nil
}
func LoginItemStatus() core.LoginItem {
	key, err := registry.OpenKey(registry.CURRENT_USER, runKey, registry.QUERY_VALUE)
	if err != nil {
		return core.LoginItem{Supported: true}
	}
	defer key.Close()
	value, _, err := key.GetStringValue("QuickDock")
	want, _ := autostartCommand()
	// An entry left by an old install location is stale, not enabled.
	return core.LoginItem{Supported: true, Enabled: err == nil && strings.EqualFold(value, want)}
}
func SetLoginItem(enabled bool) error {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, runKey, registry.SET_VALUE)
	if err != nil {
		return errors.New("无法写入Windows启动项")
	}
	defer key.Close()
	if !enabled {
		if err = key.DeleteValue("QuickDock"); err != nil && !errors.Is(err, registry.ErrNotExist) {
			return err
		}
		return nil
	}
	command, err := autostartCommand()
	if err != nil {
		return err
	}
	return key.SetStringValue("QuickDock", command)
}
