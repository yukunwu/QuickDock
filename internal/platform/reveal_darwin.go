package platform

/*
#cgo LDFLAGS: -framework Cocoa
#include <stdlib.h>
int qd_reveal(const char* path);
*/
import "C"
import (
	"errors"
	"github.com/wailsapp/wails/v3/pkg/application"
	"os"
	"unsafe"
)

// RevealPath selects the item in Finder.
func RevealPath(path string) error {
	if _, err := os.Stat(path); err != nil {
		return errors.New("文件已移动或删除")
	}
	return application.InvokeSyncWithError(func() error {
		p := C.CString(path)
		defer C.free(unsafe.Pointer(p))
		if C.qd_reveal(p) == 0 {
			return errors.New("无法在文件管理器中显示")
		}
		return nil
	})
}
