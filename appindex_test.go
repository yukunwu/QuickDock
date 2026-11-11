package main

import (
	"os"
	"path/filepath"
	"quickdock/internal/core"
	"sync/atomic"
	"testing"
	"time"
)

func waitForIndex(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("index condition timed out")
}
func TestIndexMonitorDetectsInstallRemoveAndWakeWithoutRescanningIdle(t *testing.T) {
	dir := t.TempDir()
	var scans atomic.Int32
	m := newAppIndexMonitor(func() [32]byte { return core.ApplicationIndexStamp([]string{dir}, ".app") }, func() { scans.Add(1) }, 10*time.Millisecond, time.Hour)
	m.start()
	defer func() { m.close(); <-m.done }()
	waitForIndex(t, func() bool { return scans.Load() == 1 })
	time.Sleep(40 * time.Millisecond)
	if scans.Load() != 1 {
		t.Fatal("unchanged directory rescanned")
	}
	app := filepath.Join(dir, "New.app")
	if err := os.Mkdir(app, 0700); err != nil {
		t.Fatal(err)
	}
	waitForIndex(t, func() bool { return scans.Load() >= 2 })
	if err := os.Remove(app); err != nil {
		t.Fatal(err)
	}
	waitForIndex(t, func() bool { return scans.Load() >= 3 })
	// Wake requests coalesce and don't trigger a scan if nothing changed.
	stable := scans.Load()
	for i := 0; i < 10; i++ {
		m.checkSoon()
	}
	time.Sleep(40 * time.Millisecond)
	if scans.Load() != stable {
		t.Fatal("wake rescanned unchanged directory")
	}
}
func TestIndexMonitorWakeChecksImmediatelyAndFallbackRefreshes(t *testing.T) {
	var revision atomic.Uint32
	var scans atomic.Int32
	m := newAppIndexMonitor(func() [32]byte { return [32]byte{byte(revision.Load())} }, func() { scans.Add(1) }, time.Hour, time.Hour)
	m.start()
	waitForIndex(t, func() bool { return scans.Load() == 1 })
	revision.Add(1)
	m.checkSoon()
	waitForIndex(t, func() bool { return scans.Load() == 2 })
	m.close()
	<-m.done
	m = newAppIndexMonitor(func() [32]byte { return [32]byte{} }, func() { scans.Add(1) }, 10*time.Millisecond, 30*time.Millisecond)
	m.start()
	defer func() { m.close(); <-m.done }()
	waitForIndex(t, func() bool { return scans.Load() >= 4 })
}
func TestIndexRefreshDuringScanQueuesNextPassAndPersistsLatest(t *testing.T) {
	s := newService(t.TempDir())
	started, release := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	s.scanApps = func() ([]core.AppEntry, error) {
		n := calls.Add(1)
		if n == 1 {
			close(started)
			<-release
			return []core.AppEntry{}, nil
		}
		return []core.AppEntry{{ID: "app-new", Name: "New App", Path: "/Applications/New.app"}}, nil
	}
	s.RefreshApps()
	<-started
	s.RefreshApps()
	s.RefreshApps()
	close(release)
	waitForIndex(t, func() bool { snap := s.Snapshot(); return !snap.Indexing && len(snap.Apps) == 1 })
	if calls.Load() != 2 {
		t.Fatal("refresh was dropped or scans overlapped", calls.Load())
	}
	restored := newService(s.dir).Snapshot()
	if len(restored.Apps) != 1 || restored.Apps[0].ID != "app-new" {
		t.Fatal("cache not updated", restored.Apps)
	}
}
