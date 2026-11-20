package main

import (
	"errors"
	"quickdock/internal/platform"
)

// RunSystemCommand hides the Dock first so it is not on screen when the
// session locks or wakes.
func (s *Service) RunSystemCommand(id string) error {
	run := map[string]func() error{"lock": platform.LockScreen, "sleep": platform.Sleep}[id]
	if run == nil {
		return errors.New("未知系统命令")
	}
	s.Hide()
	if err := run(); err != nil {
		return err
	}
	return s.RecordUsage(id)
}
