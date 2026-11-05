package main

import (
	"errors"
	"os"
	"path/filepath"
	"quickdock/internal/core"
	"testing"
)

type fakeShortcuts struct {
	registered map[string]bool
	blocked    string
}

func (f *fakeShortcuts) Register(key string, _ func()) error {
	if key == f.blocked {
		return errors.New("shortcut already in use")
	}
	if f.registered[key] {
		return errors.New("duplicate")
	}
	f.registered[key] = true
	return nil
}
func (f *fakeShortcuts) Unregister(key string) error  { delete(f.registered, key); return nil }
func (f *fakeShortcuts) IsRegistered(key string) bool { return f.registered[key] }
func TestShortcutConflictPreservesPreviousAndRecovery(t *testing.T) {
	s := newService(t.TempDir())
	registry := &fakeShortcuts{registered: map[string]bool{core.Defaults().Settings.Shortcut: true}, blocked: "Cmd+Option+K"}
	s.shortcuts = registry
	next := s.Snapshot().Settings
	next.Shortcut = registry.blocked
	if _, err := s.SaveSettings(next); err == nil {
		t.Fatal("conflict ignored")
	}
	if s.Snapshot().Settings.Shortcut != core.Defaults().Settings.Shortcut || !registry.registered[core.Defaults().Settings.Shortcut] || s.Snapshot().ShortcutError == "" {
		t.Fatal("old shortcut lost or missing feedback")
	}
	next.Shortcut = "Cmd+Option+J"
	if _, err := s.SaveSettings(next); err != nil {
		t.Fatal(err)
	}
	if registry.registered[core.Defaults().Settings.Shortcut] || !registry.registered[next.Shortcut] || s.Snapshot().ShortcutError != "" {
		t.Fatal("recovery failed")
	}
	reloaded := newService(s.dir)
	if reloaded.Snapshot().Settings.Shortcut != next.Shortcut {
		t.Fatal("not persisted")
	}
}
func TestFailedWriteRollsBackNewShortcut(t *testing.T) {
	dir := t.TempDir()
	s := newService(dir)
	registry := &fakeShortcuts{registered: map[string]bool{core.Defaults().Settings.Shortcut: true}}
	s.shortcuts = registry
	if err := os.Mkdir(filepath.Join(dir, "settings.json"), 0700); err != nil {
		t.Fatal(err)
	}
	next := s.Snapshot().Settings
	next.Shortcut = "Cmd+Option+J"
	if _, err := s.SaveSettings(next); err == nil {
		t.Fatal("expected write failure")
	}
	if registry.registered[next.Shortcut] || !registry.registered[core.Defaults().Settings.Shortcut] || s.Snapshot().Settings.Shortcut != core.Defaults().Settings.Shortcut {
		t.Fatal("rollback failed")
	}
}
func TestSnapshotDetachedAndUsagePersists(t *testing.T) {
	s := newService(t.TempDir())
	s.state.Settings.Bookmarks = []core.Bookmark{{ID: "site", Name: "Docs", URL: "https://example.com"}}
	snapshot := s.Snapshot()
	snapshot.Settings.Bookmarks[0].Name = "changed"
	snapshot.Usage["bad"] = core.Usage{Count: 99}
	if s.Snapshot().Settings.Bookmarks[0].Name != "Docs" || s.Snapshot().Usage["bad"].Count != 0 {
		t.Fatal("snapshot aliases mutable state")
	}
	if err := s.RecordUsage("json"); err != nil {
		t.Fatal(err)
	}
	if newService(s.dir).Snapshot().Usage["json"].Count != 1 {
		t.Fatal("usage not persisted")
	}
	if s.Launch("missing") == nil {
		t.Fatal("missing app accepted")
	}
}
