package platform

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"strings"
)

// SearchFiles uses the locate database (plocate or mlocate), which may lag
// behind recent changes until updatedb runs; hits outside home are dropped.
func SearchFiles(ctx context.Context, query string) ([]string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	for _, name := range []string{"plocate", "locate"} {
		bin, err := exec.LookPath(name)
		if err != nil {
			continue
		}
		lines, err := firstLines(ctx, exec.CommandContext(ctx, bin, "-i", "-b", "-l", "2000", "--", query))
		if err != nil {
			return nil, err
		}
		inside := lines[:0]
		for _, line := range lines {
			if strings.HasPrefix(line, home+"/") {
				inside = append(inside, line)
			}
		}
		return inside, nil
	}
	return nil, errors.New("未找到 plocate 或 locate，请先安装后再搜索文件")
}
func OpenPath(path string) error {
	if _, err := os.Stat(path); err != nil {
		return errors.New("文件已移动或删除")
	}
	return spawn("xdg-open", path)
}
