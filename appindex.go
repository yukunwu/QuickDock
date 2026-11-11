package main

import (
	"quickdock/internal/platform"
	"sync"
	"time"
)

// The monitor uses cheap metadata checks, not recurring icon extraction. The
// buffered wake channel also checks immediately when the launcher is summoned.
type appIndexMonitor struct {
	stamp              func() [32]byte
	refresh            func()
	interval, fallback time.Duration
	wake               chan struct{}
	stop               chan struct{}
	done               chan struct{}
	once, closeOnce    sync.Once
}

func newAppIndexMonitor(stamp func() [32]byte, refresh func(), interval, fallback time.Duration) *appIndexMonitor {
	return &appIndexMonitor{stamp: stamp, refresh: refresh, interval: interval, fallback: fallback, wake: make(chan struct{}, 1), stop: make(chan struct{}), done: make(chan struct{})}
}
func (m *appIndexMonitor) start() { m.once.Do(func() { go m.run() }) }
func (m *appIndexMonitor) checkSoon() {
	select {
	case m.wake <- struct{}{}:
	default:
	}
}
func (m *appIndexMonitor) close() { m.closeOnce.Do(func() { close(m.stop) }) }
func (m *appIndexMonitor) run() {
	defer close(m.done)
	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()
	previous := m.stamp()
	m.refresh()
	lastRefresh := time.Now()
	for {
		select {
		case <-m.stop:
			return
		case <-m.wake:
		case <-ticker.C:
		}
		select {
		case <-m.stop:
			return
		default:
		}
		next := m.stamp()
		if next != previous || time.Since(lastRefresh) >= m.fallback {
			previous, lastRefresh = next, time.Now()
			m.refresh()
		}
	}
}
func (s *Service) startAppIndexMonitor() { s.indexMonitor.start() }
func (s *Service) stopAppIndexMonitor()  { s.indexMonitor.close() }
func (s *Service) notifyAppsChanged() {
	if s.window != nil {
		s.window.ExecJS(`window.dispatchEvent(new Event("quickdock-apps-changed"))`)
	}
}
func (s *Service) initAppIndexMonitor() {
	s.scanApps = platform.ScanApplications
	s.indexMonitor = newAppIndexMonitor(platform.ApplicationIndexStamp, func() { s.RefreshApps() }, 3*time.Second, 5*time.Minute)
}
