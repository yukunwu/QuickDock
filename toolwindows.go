package main

import (
	"errors"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"path/filepath"
	"quickdock/internal/core"
	"quickdock/internal/platform"
	"time"
)

type toolWindow struct {
	window        *application.WebviewWindow
	closing       bool
	geometryTimer *time.Timer
}

func (s *Service) toolPath(id string) string { return filepath.Join(s.dir, "tool-windows", id+".json") }
func (s *Service) ToolWindowState(id string) (core.ToolWindowState, error) {
	s.toolMu.Lock()
	defer s.toolMu.Unlock()
	return core.LoadToolWindow(s.toolPath(id), id)
}
func (s *Service) SaveToolWindow(id, session string) error {
	if err := core.ValidateToolSession(id, session); err != nil {
		return err
	}
	s.toolMu.Lock()
	t := s.toolWindows[id]
	s.toolMu.Unlock()
	var x, y, width, height int
	if t != nil {
		x, y = t.window.Position()
		width, height = t.window.Size()
	}
	s.toolMu.Lock()
	defer s.toolMu.Unlock()
	state, err := core.LoadToolWindow(s.toolPath(id), id)
	if err != nil {
		return err
	}
	if t != nil {
		state.X = x
		state.Y = y
		state.Width = width
		state.Height = height
		state.Positioned = true
	}
	state.Session = session
	return core.AtomicJSON(s.toolPath(id), state)
}
func (s *Service) OpenToolWindow(id, session string) error {
	if core.ToolTitles[id] == "" {
		return errors.New("未知工具")
	}
	s.toolMu.Lock()
	if t := s.toolWindows[id]; t != nil {
		s.toolMu.Unlock()
		t.window.Show()
		t.window.Focus()
		return nil
	}
	state, err := core.LoadToolWindow(s.toolPath(id), id)
	if err != nil {
		s.toolMu.Unlock()
		return err
	}
	if session != "" {
		if err = core.ValidateToolSession(id, session); err != nil {
			s.toolMu.Unlock()
			return err
		}
		state.Session = session
	}
	state.Open = true
	if err = core.AtomicJSON(s.toolPath(id), state); err != nil {
		s.toolMu.Unlock()
		return err
	}
	options := application.WebviewWindowOptions{Title: s.toolTitle(id) + " · QuickDock", Name: "tool-" + id, URL: "/?tool=" + id, Width: state.Width, Height: state.Height, MinWidth: 760, MinHeight: 520, InitialPosition: application.WindowCentered}
	if id == "translate" {
		options.KeyBindings = map[string]func(application.Window){"CmdOrCtrl+W": func(window application.Window) { window.Close() }}
	}
	w := s.app.Window.NewWithOptions(options)
	t := &toolWindow{window: w}
	s.toolWindows[id] = t
	s.toolMu.Unlock()
	// Independent windows retain focus behavior; Escape uses the same save/close flow.
	w.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		s.toolMu.Lock()
		closing := t.closing
		s.toolMu.Unlock()
		if !closing {
			e.Cancel()
			w.ExecJS(`window.dispatchEvent(new Event('quickdock-tool-close'))`)
		}
	})
	w.OnWindowEvent(events.Common.WindowRuntimeReady, func(_ *application.WindowEvent) {
		if state.Positioned {
			screen := s.app.Screen.GetPrimary()
			for _, candidate := range s.app.Screen.GetAll() {
				b := candidate.WorkArea
				if state.X >= b.X && state.X < b.X+b.Width && state.Y >= b.Y && state.Y < b.Y+b.Height {
					screen = candidate
					break
				}
			}
			if screen != nil {
				b := screen.WorkArea
				w.SetSize(min(state.Width, b.Width), min(state.Height, b.Height))
				w.SetPosition(max(b.X, min(state.X, b.X+b.Width-state.Width)), max(b.Y, min(state.Y, b.Y+b.Height-state.Height)))
			}
		}
	})
	for _, event := range []events.WindowEventType{events.Common.WindowDidMove, events.Common.WindowDidResize} {
		w.OnWindowEvent(event, func(_ *application.WindowEvent) { s.saveToolGeometry(id, w) })
	}
	return nil
}
func (s *Service) saveToolGeometry(id string, w *application.WebviewWindow) {
	x, y := w.Position()
	width, height := w.Size()
	s.toolMu.Lock()
	defer s.toolMu.Unlock()
	t := s.toolWindows[id]
	if t == nil {
		return
	}
	if t.geometryTimer != nil {
		t.geometryTimer.Stop()
	}
	t.geometryTimer = time.AfterFunc(300*time.Millisecond, func() {
		s.toolMu.Lock()
		if s.toolWindows[id] != t {
			s.toolMu.Unlock()
			return
		}
		state, err := core.LoadToolWindow(s.toolPath(id), id)
		if err == nil {
			state.X = x
			state.Y = y
			state.Width = width
			state.Height = height
			state.Positioned = true
			err = core.AtomicJSON(s.toolPath(id), state)
		}
		s.toolMu.Unlock()
		if err != nil {
			w.ExecJS(`window.dispatchEvent(new Event('quickdock-tool-save-error'))`)
		}
	})
}
func (s *Service) CloseToolWindow(id string) error {
	s.toolMu.Lock()
	state, err := core.LoadToolWindow(s.toolPath(id), id)
	if err != nil {
		s.toolMu.Unlock()
		return err
	}
	state.Open = false
	if err = core.AtomicJSON(s.toolPath(id), state); err != nil {
		s.toolMu.Unlock()
		return err
	}
	t := s.toolWindows[id]
	if t != nil {
		t.closing = true
		if t.geometryTimer != nil {
			t.geometryTimer.Stop()
		}
		delete(s.toolWindows, id)
	}
	s.toolMu.Unlock()
	if t != nil {
		if id == "translate" {
			application.InvokeSync(func() { platform.DetachGooglePage(t.window.NativeWindow()) })
		}
		t.window.Close()
	}
	return nil
}
func (s *Service) restoreToolWindows() {
	for id := range core.ToolTitles {
		state, err := s.ToolWindowState(id)
		if err != nil {
			s.mu.Lock()
			s.warning += " 独立窗口恢复失败：" + err.Error()
			s.mu.Unlock()
			continue
		}
		if state.Open {
			if err = s.OpenToolWindow(id, ""); err != nil {
				s.mu.Lock()
				s.warning += " 独立窗口恢复失败：" + err.Error()
				s.mu.Unlock()
			}
		}
	}
}

// Wait for each tool page to flush its latest draft before normal application exit.
func (s *Service) prepareToolQuit() bool {
	s.toolMu.Lock()
	if s.toolQuitAllowed || len(s.toolWindows) == 0 {
		s.toolMu.Unlock()
		return true
	}
	s.toolQuitPending = map[string]bool{}
	windows := []*application.WebviewWindow{}
	for id, t := range s.toolWindows {
		s.toolQuitPending[id] = true
		windows = append(windows, t.window)
	}
	s.toolMu.Unlock()
	for _, w := range windows {
		w.ExecJS(`window.dispatchEvent(new Event('quickdock-tool-quit'))`)
	}
	return false
}
func (s *Service) ToolQuitReady(id string) {
	s.toolMu.Lock()
	if !s.toolQuitPending[id] {
		s.toolMu.Unlock()
		return
	}
	delete(s.toolQuitPending, id)
	done := len(s.toolQuitPending) == 0
	if done {
		s.toolQuitAllowed = true
	}
	s.toolMu.Unlock()
	if done {
		go s.app.Quit()
	}
}
