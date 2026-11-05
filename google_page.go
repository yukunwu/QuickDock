package main

import (
	"encoding/json"
	"errors"
	"github.com/wailsapp/wails/v3/pkg/application"
	"os"
	"path/filepath"
	"quickdock/internal/core"
	"quickdock/internal/platform"
)

func (s *Service) GoogleTranslationPage(windowID, text, source, target, action string, rect map[string]float64) error {
	if _, err := core.TranslationPageURL("x", source, target); err != nil {
		return err
	}
	if text != "" {
		if _, err := core.TranslationPageURL(text, source, target); err != nil {
			return err
		}
	}
	var w *application.WebviewWindow
	if windowID == "launcher" {
		w = s.window
	} else if windowID == "translate" {
		s.toolMu.Lock()
		if t := s.toolWindows["translate"]; t != nil {
			w = t.window
		}
		s.toolMu.Unlock()
	}
	if w == nil {
		return errors.New("翻译窗口尚未准备好")
	}
	path := ""
	if windowID == "translate" {
		dir := filepath.Join(s.dir, "tool-windows")
		if err := os.MkdirAll(dir, 0700); err != nil {
			return err
		}
		path = filepath.Join(dir, "google-page.json")
	}
	if action == "detach" {
		application.InvokeSync(func() { platform.DetachGooglePage(w.NativeWindow()) })
		return nil
	}
	if action == "flush" {
		application.InvokeSync(func() { platform.FlushGooglePage(w.NativeWindow()) })
		return nil
	}
	if action != "attach" && action != "submit" && action != "reload" && action != "layout" && action != "browser" {
		return errors.New("未知翻译页面操作")
	}
	options, _ := json.Marshal(map[string]any{"text": text, "source": source, "target": target, "submit": action == "submit", "reload": action == "reload", "rect": rect, "browser": action == "browser"})
	return application.InvokeSyncWithError(func() error {
		return platform.AttachGooglePage(w.NativeWindow(), path, string(options), func() {
			w.ExecJS(`window.dispatchEvent(new Event("quickdock-escape"))`)
		})
	})
}
