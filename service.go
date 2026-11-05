package main

import (
	"encoding/json"
	"errors"
	"github.com/wailsapp/wails/v3/pkg/application"
	"log"
	"os"
	"path/filepath"
	"quickdock/internal/core"
	"quickdock/internal/platform"
	"sync"
	"time"
)

type Snapshot struct {
	Apps          []core.AppEntry       `json:"apps"`
	Settings      core.Settings         `json:"settings"`
	Usage         map[string]core.Usage `json:"usage"`
	Indexing      bool                  `json:"indexing"`
	Error         string                `json:"error"`
	ShortcutError string                `json:"shortcutError"`
}
type shortcutRegistry interface {
	Register(string, func()) error
	Unregister(string) error
	IsRegistered(string) bool
}
type Service struct {
	localizedMenu   map[string]*application.MenuItem
	uiLanguage      string
	updates         updateState
	shortcuts       shortcutRegistry
	mu              sync.Mutex
	saveMu          sync.Mutex
	historyMu       sync.Mutex
	toolMu          sync.Mutex
	toolWindows     map[string]*toolWindow
	toolQuitPending map[string]bool
	toolQuitAllowed bool
	state           core.State
	apps            []core.AppEntry
	dir             string
	indexing        bool
	indexError      string
	warning         string
	shortcutError   string
	loadError       error
	editing         bool
	app             *application.App
	window          *application.WebviewWindow
	idleRelease     *time.Timer
}

func newService(dir string) *Service {
	state, warning, err := core.Load(filepath.Join(dir, "settings.json"))
	s := &Service{toolWindows: map[string]*toolWindow{}, state: state, dir: dir, warning: warning, loadError: err, apps: []core.AppEntry{}}
	if err != nil {
		s.warning = err.Error()
	}
	data, e := os.ReadFile(filepath.Join(dir, "apps.json"))
	if e == nil {
		var cache struct {
			Version int             `json:"version"`
			Apps    []core.AppEntry `json:"apps"`
		}
		if json.Unmarshal(data, &cache) == nil && cache.Version == 1 && cache.Apps != nil {
			s.apps = cache.Apps
		}
	}
	return s
}
func (s *Service) Snapshot() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	usage := map[string]core.Usage{}
	for k, v := range s.state.Usage {
		usage[k] = v
	}
	settings := s.state.Settings
	settings.Bookmarks = append([]core.Bookmark{}, settings.Bookmarks...)
	settings.DisabledTools = append([]string{}, settings.DisabledTools...)
	return Snapshot{append([]core.AppEntry{}, s.apps...), settings, usage, s.indexing, s.warning + s.indexError, s.shortcutError}
}
func (s *Service) SaveSettings(next core.Settings) (core.Settings, error) {
	s.saveMu.Lock()
	defer s.saveMu.Unlock()
	if err := core.Validate(next); err != nil {
		return core.Settings{}, err
	}
	if s.loadError != nil {
		return core.Settings{}, s.loadError
	}
	s.mu.Lock()
	old := s.state.Settings
	s.mu.Unlock()
	changed := next.Shortcut != old.Shortcut || !s.shortcuts.IsRegistered(old.Shortcut)
	if changed {
		if err := s.shortcuts.Register(next.Shortcut, s.toggle); err != nil {
			s.mu.Lock()
			s.shortcutError = err.Error()
			s.mu.Unlock()
			return old, err
		}
	}
	s.mu.Lock()
	candidate := s.state
	candidate.Settings = next
	err := core.AtomicJSON(filepath.Join(s.dir, "settings.json"), candidate)
	if err == nil {
		s.state.Settings = next
		s.shortcutError = ""
	}
	s.mu.Unlock()
	if err != nil {
		if changed {
			_ = s.shortcuts.Unregister(next.Shortcut)
		}
		return old, err
	}
	if changed && old.Shortcut != next.Shortcut && s.shortcuts.IsRegistered(old.Shortcut) {
		if err := s.shortcuts.Unregister(old.Shortcut); err != nil {
			s.mu.Lock()
			s.shortcutError = "旧快捷键释放失败：" + err.Error()
			s.mu.Unlock()
		}
	}
	if s.app != nil {
		s.SyncUILanguage(s.locale())
	}
	return next, nil
}
func (s *Service) RefreshApps() Snapshot {
	s.mu.Lock()
	if s.indexing {
		s.mu.Unlock()
		return s.Snapshot()
	}
	s.indexing = true
	s.mu.Unlock()
	go func() {
		apps, err := platform.ScanApplications()
		s.mu.Lock()
		defer s.mu.Unlock()
		s.apps = apps
		s.indexing = false
		s.indexError = ""
		if err != nil {
			s.indexError = err.Error()
		}
		if err := core.AtomicJSON(filepath.Join(s.dir, "apps.json"), struct {
			Version int             `json:"version"`
			Apps    []core.AppEntry `json:"apps"`
		}{1, apps}); err != nil {
			s.indexError += " 索引缓存写入失败：" + err.Error()
		}
	}()
	return s.Snapshot()
}
func (s *Service) RecordUsage(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.loadError != nil {
		return s.loadError
	}
	u := s.state.Usage[id]
	u.Count++
	u.LastUsed = time.Now().UnixMilli()
	s.state.Usage[id] = u
	return core.AtomicJSON(filepath.Join(s.dir, "settings.json"), s.state)
}
func (s *Service) Launch(id string) error {
	s.mu.Lock()
	var path string
	for _, a := range s.apps {
		if a.ID == id {
			path = a.Path
			break
		}
	}
	s.mu.Unlock()
	if path == "" {
		return errors.New("未找到应用，请刷新索引")
	}
	if err := platform.LaunchApplication(path); err != nil {
		return err
	}
	s.Hide()
	return s.RecordUsage(id)
}
func (s *Service) OpenBookmark(id string) error {
	s.mu.Lock()
	var target string
	for _, b := range s.state.Settings.Bookmarks {
		if b.ID == id {
			target = b.URL
			break
		}
	}
	s.mu.Unlock()
	if err := core.ValidateURL(target); err != nil {
		return err
	}
	if err := application.InvokeSyncWithError(func() error { return platform.Open(target, false) }); err != nil {
		return err
	}
	return s.RecordUsage(id)
}
func (s *Service) Copy(text string) error {
	if !s.app.Clipboard.SetText(text) {
		return errors.New("剪贴板写入失败")
	}
	return nil
}
func (s *Service) SetEditing(editing bool) { s.mu.Lock(); s.editing = editing; s.mu.Unlock() }
func (s *Service) Hide() {
	s.window.ExecJS(`window.dispatchEvent(new CustomEvent("quickdock-visibility", {detail: false}))`)
	s.window.Hide()
	s.mu.Lock()
	if s.idleRelease != nil {
		s.idleRelease.Stop()
	}
	// A native timer still fires when WebKit suspends hidden-page JS timers.
	s.idleRelease = time.AfterFunc(30*time.Second, func() {
		application.InvokeSync(func() {
			if !s.window.IsVisible() {
				s.window.ExecJS(`window.dispatchEvent(new Event("quickdock-idle"))`)
			}
		})
	})
	s.mu.Unlock()
}
func (s *Service) IsVisible() bool {
	return application.InvokeSyncWithResult(func() bool { return s.window.IsVisible() })
}
func (s *Service) cancelIdleRelease() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.idleRelease != nil {
		s.idleRelease.Stop()
		s.idleRelease = nil
	}
}
func (s *Service) show() {
	s.cancelIdleRelease()
	application.InvokeSync(func() { platform.PlaceWindow(s.window.NativeWindow(), true) })
	s.window.Show()
	s.window.Focus()
	s.window.ExecJS(`window.dispatchEvent(new CustomEvent("quickdock-visibility", {detail: true}))`)
}
func (s *Service) toggle() {
	application.InvokeSync(func() {
		log.Printf("toggle visible=%v", s.window.IsVisible())
		if s.window.IsVisible() {
			s.Hide()
		} else {
			s.cancelIdleRelease()
			platform.PlaceWindow(s.window.NativeWindow(), true)
			s.window.Show()
			s.window.Focus()
			s.window.ExecJS(`window.dispatchEvent(new CustomEvent("quickdock-visibility", {detail: true}))`)
		}
	})
}

// SetView keeps native window geometry and blur behavior in sync with the UI.
func (s *Service) SetView(view string) error {
	width, height := 780, 340
	switch view {
	case "launcher":
	case "expanded", "translation":
		height = 520
	case "workspace":
		width, height = 960, 660
	default:
		return errors.New("未知窗口视图")
	}
	s.mu.Lock()
	s.editing = view == "workspace" || view == "translation"
	s.mu.Unlock()
	s.window.SetMinSize(700, 300)
	s.window.SetSize(width, height)
	application.InvokeSync(func() { platform.PlaceWindow(s.window.NativeWindow(), false) })
	return nil
}
