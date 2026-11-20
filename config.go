package main

import (
	"errors"
	"os"
	"quickdock/internal/core"
	"time"
)

// ExportConfig writes a backup built by the frontend (which owns the world
// clock list) to a path chosen in the save dialog; cancel returns false.
func (s *Service) ExportConfig(raw string) (bool, error) {
	config, err := core.ParseConfigExport([]byte(raw))
	if err != nil {
		return false, err
	}
	path, err := s.app.Dialog.SaveFile().SetFilename("QuickDock-" + time.Now().Format("20060102") + ".json").AddFilter("JSON", "*.json").CanCreateDirectories(true).PromptForSingleSelection()
	if err != nil || path == "" {
		return false, err
	}
	if err = core.AtomicJSON(path, config); err != nil {
		return false, err
	}
	return true, nil
}

// ImportConfig reads and validates a backup; applying it is left to the
// frontend after the user confirms. A nil result means the dialog was cancelled.
func (s *Service) ImportConfig() (*core.ConfigExport, error) {
	path, err := s.app.Dialog.OpenFile().CanChooseFiles(true).AddFilter("JSON", "*.json").PromptForSingleSelection()
	if err != nil || path == "" {
		return nil, err
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.Size() > 1024*1024 {
		return nil, errors.New("不是 QuickDock 配置文件")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	config, err := core.ParseConfigExport(raw)
	if err != nil {
		return nil, err
	}
	return &config, nil
}
