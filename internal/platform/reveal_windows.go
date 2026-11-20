package platform

import (
	"errors"
	"golang.org/x/sys/windows"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// RevealPath selects the shortcut in Explorer. Store apps have no file to show.
func RevealPath(path string) error {
	if strings.HasPrefix(path, `shell:AppsFolder\`) {
		return errors.New("该应用没有可显示的文件位置")
	}
	if _, err := os.Stat(path); err != nil {
		return errors.New("文件已移动或删除")
	}
	cmd := exec.Command(filepath.Join(os.Getenv("SystemRoot"), "explorer.exe"))
	// Explorer parses its own command line; /select needs the path quoted as one token.
	cmd.SysProcAttr = &windows.SysProcAttr{CmdLine: `explorer.exe /select,"` + path + `"`}
	if err := cmd.Start(); err != nil {
		return errors.New("无法在文件管理器中显示")
	}
	go cmd.Wait()
	return nil
}
