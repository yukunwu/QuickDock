package platform

import (
	"context"
	"errors"
	"os"
	"os/exec"
)

// SearchFiles uses the locate database (plocate or mlocate), which may lag
// behind recent changes until updatedb runs.
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
		// No -l: the limit applies to kept hits, after dropping other users'
		// files and caches, so a common name still reaches home files.
		return firstLines(ctx, exec.CommandContext(ctx, bin, "-i", "-b", "--", query), homeFiles(home))
	}
	return nil, errors.New("未找到 plocate 或 locate，请先安装后再搜索文件")
}
func OpenPath(path string) error {
	if _, err := os.Stat(path); err != nil {
		return errors.New("文件已移动或删除")
	}
	return spawn("xdg-open", path)
}
