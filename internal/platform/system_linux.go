package platform

import (
	"errors"
	"os/exec"
)

// LockScreen asks logind to lock this session, then falls back to the
// desktop's screensaver for sessions logind does not manage.
func LockScreen() error {
	if exec.Command("loginctl", "lock-session").Run() == nil {
		return nil
	}
	if exec.Command("xdg-screensaver", "lock").Run() == nil {
		return nil
	}
	return errors.New("无法锁定屏幕：桌面环境不支持 loginctl 或 xdg-screensaver")
}
func Sleep() error {
	if err := exec.Command("systemctl", "suspend").Run(); err != nil {
		return errors.New("系统拒绝进入睡眠")
	}
	return nil
}
