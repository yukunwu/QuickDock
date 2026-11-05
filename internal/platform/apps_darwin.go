package platform

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"os"
	"path/filepath"
	"quickdock/internal/core"
)

func ScanApplications() ([]core.AppEntry, error) {
	home, _ := os.UserHomeDir()
	return core.Scan([]string{"/Applications", filepath.Join(home, "Applications"), "/System/Applications", "/System/Library/CoreServices/Finder.app"}, func(path string) (core.AppEntry, error) {
		return application.InvokeSyncWithResultAndError(func() (core.AppEntry, error) { return Metadata(path) })
	})
}
func LaunchApplication(path string) error {
	return application.InvokeSyncWithError(func() error { return Open(path, true) })
}
