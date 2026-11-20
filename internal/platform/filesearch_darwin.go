package platform

import (
	"context"
	"errors"
	"github.com/wailsapp/wails/v3/pkg/application"
	"os"
	"os/exec"
	"unsafe"
)

/*
#include <stdlib.h>
int qd_open_path(const char* path);
*/
import "C"

// SearchFiles asks Spotlight for file names containing query in the home folder.
func SearchFiles(ctx context.Context, query string) ([]string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	return firstLines(ctx, exec.CommandContext(ctx, "/usr/bin/mdfind", "-onlyin", home, "-name", query), homeFiles(home))
}
func OpenPath(path string) error {
	if _, err := os.Stat(path); err != nil {
		return errors.New("文件已移动或删除")
	}
	return application.InvokeSyncWithError(func() error {
		p := C.CString(path)
		defer C.free(unsafe.Pointer(p))
		if C.qd_open_path(p) == 0 {
			return errors.New("没有可打开此文件的应用")
		}
		return nil
	})
}
