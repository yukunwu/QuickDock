package platform

import (
	"bufio"
	"context"
	"os"
	"os/exec"
	"quickdock/internal/core"
	"runtime"
	"strings"
)

// fileSearchLimit bounds how many useful hits are read before ranking;
// fileScanLimit bounds the raw lines read to find them.
const (
	fileSearchLimit = 400
	fileScanLimit   = 200000
)

// homeFiles keeps paths inside home that are not caches or hidden folders,
// so noisy matches cannot fill the hit budget before user files arrive.
func homeFiles(home string) func(string) bool {
	prefix := home + string(os.PathSeparator)
	return func(path string) bool {
		// Windows paths are case-insensitive; the index may report c:\ for C:\.
		if len(path) <= len(prefix) || !(strings.HasPrefix(path, prefix) || runtime.GOOS == "windows" && strings.EqualFold(path[:len(prefix)], prefix)) {
			return false
		}
		return !core.NoisyPath(home+path[len(home):], home)
	}
}

// firstLines runs a search command and stops it once enough kept lines arrived.
func firstLines(ctx context.Context, cmd *exec.Cmd, keep func(string) bool) ([]string, error) {
	out, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err = cmd.Start(); err != nil {
		return nil, err
	}
	lines := []string{}
	scanner := bufio.NewScanner(out)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanned := 0; len(lines) < fileSearchLimit && scanned < fileScanLimit && scanner.Scan(); scanned++ {
		if line := scanner.Text(); keep(line) {
			lines = append(lines, line)
		}
	}
	_ = cmd.Process.Kill()
	_ = cmd.Wait()
	if ctx.Err() != nil && len(lines) == 0 {
		return nil, ctx.Err()
	}
	return lines, nil
}
