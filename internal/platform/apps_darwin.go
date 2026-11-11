package platform

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"os"
	"path/filepath"
	"quickdock/internal/core"
)

func applicationRoots() []string {
	home, _ := os.UserHomeDir()
	return []string{"/Applications", filepath.Join(home, "Applications"), "/System/Applications", "/System/Library/CoreServices/Finder.app"}
}
func ApplicationIndexStamp() [32]byte { return core.ApplicationIndexStamp(applicationRoots(), ".app") }
func ScanApplications() ([]core.AppEntry, error) {
	return core.Scan(applicationRoots(), func(path string) (core.AppEntry, error) {
		return application.InvokeSyncWithResultAndError(func() (core.AppEntry, error) { return Metadata(path) })
	})
}
func LaunchApplication(path string) error {
	return application.InvokeSyncWithError(func() error { return Open(path, true) })
}
