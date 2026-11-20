package platform

/*
#cgo LDFLAGS: -framework Cocoa -framework ServiceManagement
#include <stdlib.h>
int qd_login_status(void);
char* qd_login_set(int enabled);
void qd_login_settings(void);
void qd_watch_login_launch(void);
int qd_launched_at_login(void);
*/
import "C"
import (
	"errors"
	"quickdock/internal/core"
	"unsafe"
)

// WatchLoginLaunch must run before the AppKit run loop starts: the launch
// Apple event is only inspectable while the app finishes launching.
func WatchLoginLaunch() { C.qd_watch_login_launch() }
func LaunchedAtLogin(args []string) bool {
	return core.LaunchedByAutostart(args) || C.qd_launched_at_login() != 0
}

// SMAppService status: 0 not registered, 1 enabled, 2 requires approval, 3 not found.
func LoginItemStatus() core.LoginItem {
	status := C.qd_login_status()
	return core.LoginItem{Supported: status >= 0 && status != 3, Enabled: status == 1, NeedsApproval: status == 2}
}
func SetLoginItem(enabled bool) error {
	flag := C.int(0)
	if enabled {
		flag = 1
	}
	if raw := C.qd_login_set(flag); raw != nil {
		defer C.free(unsafe.Pointer(raw))
		return errors.New(C.GoString(raw))
	}
	return nil
}
func OpenLoginItemSettings() { C.qd_login_settings() }
