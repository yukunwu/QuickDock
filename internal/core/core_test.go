package core

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStore(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	state, warning, err := Load(path)
	if err != nil || warning != "" || state.Settings.Shortcut != Defaults().Settings.Shortcut {
		t.Fatal(state, warning, err)
	}
	state.Settings.Theme = "light"
	if err := AtomicJSON(path, state); err != nil {
		t.Fatal(err)
	}
	loaded, _, err := Load(path)
	if err != nil || loaded.Settings.Theme != "light" {
		t.Fatal(loaded, err)
	}
	_ = os.WriteFile(path, []byte("broken"), 0600)
	loaded, warning, err = Load(path)
	if err != nil || warning == "" || loaded.Settings.Theme != "system" {
		t.Fatal(loaded, warning, err)
	}
	backups, _ := filepath.Glob(path + ".corrupt-*")
	if len(backups) != 1 {
		t.Fatal(backups)
	}
	data, _ := os.ReadFile(backups[0])
	if string(data) != "broken" {
		t.Fatal("backup mismatch")
	}
}
func TestFutureVersionPreserved(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	state := Defaults()
	state.Version = 2
	_ = AtomicJSON(path, state)
	_, _, err := Load(path)
	if err == nil {
		t.Fatal("future version accepted")
	}
	data, _ := os.ReadFile(path)
	var actual State
	_ = json.Unmarshal(data, &actual)
	if actual.Version != 2 {
		t.Fatal("future data lost")
	}
}
func TestValidation(t *testing.T) {
	for _, raw := range []string{"javascript:alert(1)", "file:///tmp/a", "https://", "https://name:password@example.com"} {
		if ValidateURL(raw) == nil {
			t.Fatal(raw)
		}
	}
	s := Defaults().Settings
	s.Bookmarks = []Bookmark{{ID: "1", Name: "Docs", URL: "https://example.com"}}
	if err := Validate(s); err != nil {
		t.Fatal(err)
	}
	s.Bookmarks = append(s.Bookmarks, s.Bookmarks[0])
	if Validate(s) == nil {
		t.Fatal("duplicate accepted")
	}
}
func TestScanAppLeavesAndDedup(t *testing.T) {
	root := t.TempDir()
	for _, path := range []string{"A.app/Contents/Helper.app", "Utilities/B.app", ".hidden/C.app"} {
		if err := os.MkdirAll(filepath.Join(root, path), 0700); err != nil {
			t.Fatal(err)
		}
	}
	_ = os.Symlink(filepath.Join(root, "A.app"), filepath.Join(root, "Alias.app"))
	apps, err := Scan([]string{root, filepath.Join(root, "missing")}, func(path string) (AppEntry, error) {
		return AppEntry{Name: strings.TrimSuffix(filepath.Base(path), ".app")}, nil
	})
	if err != nil || len(apps) != 2 {
		t.Fatal(apps, err)
	}
	if apps[0].Name != "A" || apps[1].Name != "B" || apps[0].ID == apps[1].ID {
		t.Fatal(apps)
	}
}

func TestScanSkipsUnreadableBundleWithoutWarning(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"Editor.app", "Qt Maintenance Tool.app/Contents/Helper.app"} {
		if err := os.MkdirAll(filepath.Join(root, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	var visited []string
	apps, err := Scan([]string{root}, func(path string) (AppEntry, error) {
		name := filepath.Base(path)
		visited = append(visited, name)
		if name == "Qt Maintenance Tool.app" {
			return AppEntry{}, errors.New("无法读取应用包")
		}
		return AppEntry{Name: "Editor"}, nil
	})
	if err != nil || len(apps) != 1 || apps[0].Name != "Editor" || len(visited) != 2 {
		t.Fatalf("apps=%+v visited=%v err=%v", apps, visited, err)
	}
}

func TestDesktopEntriesRespectLocaleAndUserOverrides(t *testing.T) {
	user := t.TempDir()
	system := t.TempDir()
	files := map[string]string{
		filepath.Join(user, "masked.desktop"):    "[Desktop Entry]\nType=Application\nName=Hidden\nExec=bad\nHidden=true\n",
		filepath.Join(system, "masked.desktop"):  "[Desktop Entry]\nType=Application\nName=Must not appear\nExec=bad\n",
		filepath.Join(system, "good.desktop"):    "[Desktop Entry]\nType=Application\nName=Editor\nName[zh_CN]=编辑器\nExec=editor %U\nTryExec=editor\nIcon=editor\n",
		filepath.Join(system, "missing.desktop"): "[Desktop Entry]\nType=Application\nName=Missing\nExec=missing\nTryExec=missing\n",
		filepath.Join(system, "kde.desktop"):     "[Desktop Entry]\nType=Application\nName=KDE only\nExec=editor\nOnlyShowIn=KDE;\n",
	}
	for path, raw := range files {
		if err := os.WriteFile(path, []byte(raw), 0600); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := ScanDesktopFiles([]string{user, system}, "zh_CN.UTF-8", "GNOME", func(s string) bool { return s == "editor" }, func(s string) string { return "icon:" + s })
	if err != nil || len(rows) != 1 || rows[0].Name != "编辑器" || rows[0].Icon != "icon:editor" {
		t.Fatal(rows, err)
	}
	for _, raw := range []string{"[Desktop Entry]\nType=Link\nName=Link\nURL=https://example.org", "[Desktop Entry]\nType=Application\nName=No exec"} {
		entry, err := ParseDesktopEntry(raw, "en", "GNOME")
		if err != nil || !entry.Hidden {
			t.Fatal(entry, err)
		}
	}
}

func TestSettingsLanguagesAreBackwardCompatible(t *testing.T) {
	for _, language := range []string{"", "system", "zh-CN", "ja", "en", "zh-TW", "es"} {
		state := Defaults()
		state.Settings.Language = language
		path := filepath.Join(t.TempDir(), "settings.json")
		if err := Validate(state.Settings); err != nil {
			t.Fatal(language, err)
		}
		if err := AtomicJSON(path, state); err != nil {
			t.Fatal(err)
		}
		restored, _, err := Load(path)
		if err != nil || restored.Settings.Language != language {
			t.Fatal(language, restored, err)
		}
	}
	state := Defaults()
	state.Settings.Language = "fr"
	if Validate(state.Settings) == nil {
		t.Fatal("unsupported locale accepted")
	}
}
