package platform

import (
	"errors"
	"golang.org/x/sys/windows"
)

var powrprof = windows.NewLazySystemDLL("powrprof.dll")

func LockScreen() error {
	if ok, _, err := user32.NewProc("LockWorkStation").Call(); ok == 0 {
		return err
	}
	return nil
}

// Sleep suspends rather than hibernates; wake events stay enabled.
func Sleep() error {
	if ok, _, _ := powrprof.NewProc("SetSuspendState").Call(0, 0, 0); ok == 0 {
		return errors.New("系统拒绝进入睡眠")
	}
	return nil
}
