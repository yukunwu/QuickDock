package platform

import (
	"bufio"
	"context"
	"os/exec"
)

// fileSearchLimit bounds how many raw hits are read before ranking.
const fileSearchLimit = 400

// firstLines runs a search command and stops it once enough lines arrived.
func firstLines(ctx context.Context, cmd *exec.Cmd) ([]string, error) {
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
	for len(lines) < fileSearchLimit && scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	_ = cmd.Process.Kill()
	_ = cmd.Wait()
	if ctx.Err() != nil && len(lines) == 0 {
		return nil, ctx.Err()
	}
	return lines, nil
}
