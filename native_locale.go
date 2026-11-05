package main

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"os"
	"quickdock/internal/core"
	"quickdock/internal/i18n"
)

func (s *Service) locale() string {
	s.mu.Lock()
	language := s.state.Settings.Language
	resolved := s.uiLanguage
	s.mu.Unlock()
	if language != "" && language != "system" {
		return language
	}
	if resolved != "" {
		return resolved
	}
	for _, key := range []string{"LC_ALL", "LC_MESSAGES", "LANG"} {
		if value := os.Getenv(key); value != "" {
			return i18n.Resolve(value)
		}
	}
	return "en"
}
func (s *Service) toolTitle(id string) string { return i18n.T(s.locale(), core.ToolTitles[id]) }

// The WebView supplies its OS-resolved locale when following system settings.
// It cannot change a saved explicit language through this presentation method.
func (s *Service) SyncUILanguage(language string) {
	if !i18n.Valid(language) || language == "system" || language == "" {
		return
	}
	s.mu.Lock()
	saved := s.state.Settings.Language
	s.uiLanguage = language
	s.mu.Unlock()
	if saved != "" && saved != "system" {
		language = saved
	}
	if s.app == nil {
		return
	}
	// Copy window handles before entering the UI thread: window creation can
	// hold toolMu while waiting for AppKit.
	s.toolMu.Lock()
	windows := make(map[string]*application.WebviewWindow, len(s.toolWindows))
	for id, w := range s.toolWindows {
		windows[id] = w.window
	}
	s.toolMu.Unlock()
	application.InvokeSync(func() {
		for key, item := range s.localizedMenu {
			item.SetLabel(i18n.T(language, key))
		}
		for id, w := range windows {
			w.SetTitle(i18n.T(language, core.ToolTitles[id]) + " · QuickDock")
			w.ExecJS(`window.dispatchEvent(new Event("quickdock-settings-changed"))`)
		}
	})
}
