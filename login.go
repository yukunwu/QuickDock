package main

import (
	"errors"
	"quickdock/internal/core"
	"quickdock/internal/platform"
)

func (s *Service) LoginItem() core.LoginItem { return platform.LoginItemStatus() }

// SetLaunchAtLogin returns the state the OS reports afterwards; macOS may
// keep a registration pending until the user approves it in System Settings.
func (s *Service) SetLaunchAtLogin(enabled bool) (core.LoginItem, error) {
	if !platform.LoginItemStatus().Supported {
		return core.LoginItem{}, errors.New("当前安装方式不支持开机启动，请先将 QuickDock 移到应用程序文件夹")
	}
	if err := platform.SetLoginItem(enabled); err != nil {
		return platform.LoginItemStatus(), err
	}
	return platform.LoginItemStatus(), nil
}
func (s *Service) OpenLoginItemSettings() { platform.OpenLoginItemSettings() }
