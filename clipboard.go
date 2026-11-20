package main

import (
	"errors"
	"log"
	"path/filepath"
	"quickdock/internal/core"
	"quickdock/internal/platform"
	"runtime"
	"slices"
	"time"
)

const clipboardPinLimit = 50

func (s *Service) clipboardPath() string { return filepath.Join(s.dir, "clipboard.json") }
func (s *Service) clipboardEnabled() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state.Settings.ClipboardHistory && !slices.Contains(s.state.Settings.DisabledTools, "clipboard")
}

// watchClipboard polls for copies. macOS and Windows expose a change counter,
// so the pasteboard is only read after a copy; Linux compares the text.
// Whatever is on the clipboard when recording starts is not captured.
func (s *Service) watchClipboard() {
	interval := 750 * time.Millisecond
	if runtime.GOOS == "linux" {
		interval = 1500 * time.Millisecond
	}
	var lastChange int64 = -2
	lastText, baseline := "", true
	for range time.Tick(interval) {
		if !s.clipboardEnabled() {
			lastChange, lastText, baseline = -2, "", true
			continue
		}
		change := platform.ClipboardChange()
		if change >= 0 && change == lastChange {
			continue
		}
		lastChange = change
		text, ok := platform.ReadClipboard()
		if change < 0 {
			if text == lastText {
				continue
			}
			lastText = text
		}
		if baseline {
			baseline = false
			continue
		}
		if ok {
			s.recordClipboard(text)
		}
	}
}
func (s *Service) recordClipboard(text string) {
	s.historyMu.Lock()
	state, err := core.LoadClipboard(s.clipboardPath())
	changed := false
	if err == nil {
		state.Records, changed, err = core.AddClipboard(state.Records, text, time.Now())
	}
	if err == nil && changed {
		err = core.AtomicJSON(s.clipboardPath(), state)
	}
	s.historyMu.Unlock()
	if err != nil {
		log.Printf("clipboard history: %v", err)
		return
	}
	if changed {
		s.notifyClipboardHistory()
	}
}
func (s *Service) notifyClipboardHistory() {
	script := `window.dispatchEvent(new Event("quickdock-clipboard-history"))`
	if s.window != nil {
		s.window.ExecJS(script)
	}
	s.toolMu.Lock()
	if t := s.toolWindows["clipboard"]; t != nil && t.window != nil {
		t.window.ExecJS(script)
	}
	s.toolMu.Unlock()
}
func (s *Service) ClipboardHistory() ([]core.ClipboardEntry, error) {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	state, err := core.LoadClipboard(s.clipboardPath())
	return state.Records, err
}

// editClipboard applies fn to the stored history and saves the result.
func (s *Service) editClipboard(fn func([]core.ClipboardEntry) ([]core.ClipboardEntry, error)) ([]core.ClipboardEntry, error) {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	state, err := core.LoadClipboard(s.clipboardPath())
	if err != nil {
		return nil, err
	}
	if state.Records, err = fn(state.Records); err != nil {
		return nil, err
	}
	if err = core.AtomicJSON(s.clipboardPath(), state); err != nil {
		return nil, err
	}
	return state.Records, nil
}
func (s *Service) DeleteClipboard(id string) ([]core.ClipboardEntry, error) {
	return s.editClipboard(func(records []core.ClipboardEntry) ([]core.ClipboardEntry, error) {
		return slices.DeleteFunc(records, func(r core.ClipboardEntry) bool { return r.ID == id }), nil
	})
}
func (s *Service) PinClipboard(id string, pinned bool) ([]core.ClipboardEntry, error) {
	return s.editClipboard(func(records []core.ClipboardEntry) ([]core.ClipboardEntry, error) {
		count := 0
		for _, r := range records {
			if r.Pinned {
				count++
			}
		}
		for i := range records {
			if records[i].ID == id {
				if pinned && !records[i].Pinned && count >= clipboardPinLimit {
					return nil, errors.New("最多固定 50 条剪贴板记录")
				}
				records[i].Pinned = pinned
			}
		}
		return records, nil
	})
}

// ClearClipboard removes everything except pinned entries.
func (s *Service) ClearClipboard() ([]core.ClipboardEntry, error) {
	return s.editClipboard(func(records []core.ClipboardEntry) ([]core.ClipboardEntry, error) {
		return slices.DeleteFunc(records, func(r core.ClipboardEntry) bool { return !r.Pinned }), nil
	})
}

// UseClipboard puts an entry back on the clipboard and hides the Dock, so the
// user can paste it into the app they came from.
func (s *Service) UseClipboard(id string) error {
	records, err := s.ClipboardHistory()
	if err != nil {
		return err
	}
	for _, r := range records {
		if r.ID == id {
			if err = s.Copy(r.Text); err != nil {
				return err
			}
			s.Hide()
			return nil
		}
	}
	return errors.New("剪贴板记录已删除")
}
