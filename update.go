package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/updater"
	ghupdate "github.com/wailsapp/wails/v3/pkg/updater/providers/github"
	"quickdock/internal/core"
)

type UpdateInfo struct {
	Current  string `json:"current"`
	Version  string `json:"version"`
	State    string `json:"state"`
	Error    string `json:"error"`
	Notes    string `json:"notes"`
	Progress int    `json:"progress"`
	Linux    bool   `json:"linux"`
}
type updateState struct {
	mu       sync.Mutex
	info     UpdateInfo
	provider updater.Provider
	release  *updater.Release
	busy     bool
}

// Require a checksum even if GitHub's sidecar parser returns no matching row.
// Missing verification must never turn into an unsigned download silently.
type verifiedProvider struct{ updater.Provider }

func (p verifiedProvider) Check(ctx context.Context, req updater.CheckRequest) (*updater.Release, error) {
	r, err := p.Provider.Check(ctx, req)
	if err == nil && r != nil && (r.Verification == nil || r.Verification.DigestAlgo != "sha256" || len(r.Verification.Digest) != sha256.Size) {
		return nil, errors.New("发布包缺少有效 SHA256，已拒绝更新")
	}
	return r, err
}
func releaseMatcher(linuxFormat string) ghupdate.AssetMatcher {
	return func(req updater.CheckRequest, assets []ghupdate.ReleaseAsset) int {
		arch := map[string]string{"amd64": "x64", "arm64": "arm64"}[req.Arch]
		if arch == "" {
			return -1
		}
		platform, ext := req.Platform, ".zip"
		if platform == "darwin" {
			platform = "macos"
		}
		if platform == "linux" {
			ext = "." + linuxFormat
		}
		suffix := "-" + platform + "-" + arch + ext
		for i, a := range assets {
			if strings.HasPrefix(a.Name, "QuickDock-") && strings.HasSuffix(a.Name, suffix) {
				return i
			}
		}
		return -1
	}
}
func linuxPackageFormat() string {
	if _, err := exec.LookPath("dpkg-query"); err == nil {
		return "deb"
	}
	return "rpm"
}
func (s *Service) initUpdates() {
	p, err := ghupdate.New(ghupdate.Config{Repository: core.Repository, ChecksumAsset: "SHA256SUMS.txt", AssetMatcher: releaseMatcher(linuxPackageFormat()), HTTPClient: &http.Client{Timeout: 2 * time.Minute}})
	s.updates.info = UpdateInfo{Current: core.Version, State: "idle", Linux: runtime.GOOS == "linux"}
	if err != nil {
		s.setUpdateError(err)
		return
	}
	s.updates.provider = verifiedProvider{p}
	if err = s.app.Updater.Init(updater.Config{CurrentVersion: core.Version, Providers: []updater.Provider{s.updates.provider}, Window: updater.WindowNone}); err != nil {
		s.setUpdateError(err)
		return
	}
	s.app.Event.On(updater.EventDownloadProgress, func(e *application.CustomEvent) {
		// Payload is emitted by the native updater, never supplied by a remote page.
		var progress updater.Progress
		if e.Data != nil {
			raw, _ := json.Marshal(e.Data)
			_ = json.Unmarshal(raw, &progress)
		}
		if progress.Total > 0 {
			s.updates.mu.Lock()
			s.updates.info.Progress = int(progress.Written * 100 / progress.Total)
			s.updates.mu.Unlock()
		}
	})
	go func() {
		timer := time.NewTimer(10 * time.Second)
		defer timer.Stop()
		<-timer.C
		_, _ = s.CheckForUpdates()
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			_, _ = s.CheckForUpdates()
		}
	}()
}
func (s *Service) setUpdateError(err error) {
	s.updates.mu.Lock()
	s.updates.info.State = "error"
	s.updates.info.Error = err.Error()
	s.updates.mu.Unlock()
}
func (s *Service) UpdateStatus() UpdateInfo {
	s.updates.mu.Lock()
	defer s.updates.mu.Unlock()
	return s.updates.info
}
func (s *Service) CheckForUpdates() (UpdateInfo, error) {
	s.updates.mu.Lock()
	if s.updates.busy || s.updates.info.State == "ready" {
		info := s.updates.info
		s.updates.mu.Unlock()
		return info, nil
	}
	s.updates.busy = true
	s.updates.info.State = "checking"
	s.updates.info.Error = ""
	s.updates.mu.Unlock()
	defer func() { s.updates.mu.Lock(); s.updates.busy = false; s.updates.mu.Unlock() }()
	if s.updates.provider == nil {
		err := errors.New("更新服务尚未就绪")
		s.setUpdateError(err)
		return s.UpdateStatus(), err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	rel, err := s.app.Updater.Check(ctx)
	if err != nil {
		s.setUpdateError(err)
		return s.UpdateStatus(), err
	}
	s.updates.mu.Lock()
	s.updates.release = rel
	if rel == nil {
		s.updates.info.State = "latest"
	} else {
		s.updates.info.State = "available"
		s.updates.info.Version = rel.Version
		s.updates.info.Notes = rel.Notes
	}
	s.updates.mu.Unlock()
	return s.UpdateStatus(), nil
}
func (s *Service) InstallUpdate() error {
	s.updates.mu.Lock()
	if s.updates.busy || s.updates.info.State != "available" {
		s.updates.mu.Unlock()
		return errors.New("请先检查更新，或等待当前操作完成")
	}
	s.updates.busy = true
	s.updates.info.State = "downloading"
	s.updates.info.Error = ""
	rel := s.updates.release
	s.updates.mu.Unlock()
	go func() {
		defer func() { s.updates.mu.Lock(); s.updates.busy = false; s.updates.mu.Unlock() }()
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()
		var err error
		if runtime.GOOS == "linux" {
			err = s.installLinuxUpdate(ctx, rel)
		} else {
			err = s.app.Updater.DownloadAndInstall(ctx)
		}
		if err != nil {
			s.setUpdateError(err)
			return
		}
		s.updates.mu.Lock()
		s.updates.info.State = "ready"
		s.updates.info.Progress = 100
		s.updates.mu.Unlock()
	}()
	return nil
}
func (s *Service) RestartAfterUpdate() error {
	if s.UpdateStatus().State != "ready" {
		return errors.New("更新尚未安装完成")
	}
	if runtime.GOOS != "linux" {
		return s.app.Updater.Restart(context.Background())
	}
	self, err := os.Executable()
	if err != nil {
		return err
	}
	// No user input is interpreted as shell code. Positional arguments carry
	// PID and executable; wait for the normal draft-flush shutdown to finish.
	cmd := exec.Command("/bin/sh", "-c", `i=0; while kill -0 "$1" 2>/dev/null; do i=$((i+1)); [ "$i" -ge 120 ] && exit 1; sleep 1; done; exec "$2"`, "quickdock-restart", fmt.Sprint(os.Getpid()), self)
	if err = cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	s.app.Quit()
	return nil
}
func (s *Service) installLinuxUpdate(ctx context.Context, rel *updater.Release) error {
	if rel == nil || rel.Verification == nil {
		return errors.New("更新信息无效")
	}
	dir, err := os.MkdirTemp("", "quickdock-update-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, filepath.Base(rel.Artifact.Filename))
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	err = s.updates.provider.Download(ctx, rel, io.MultiWriter(f, hash), func(n, total int64) {
		if total > 0 {
			s.updates.mu.Lock()
			s.updates.info.Progress = int(n * 100 / total)
			s.updates.mu.Unlock()
		}
	})
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if hex.EncodeToString(hash.Sum(nil)) != hex.EncodeToString(rel.Verification.Digest) {
		return errors.New("更新包 SHA256 校验失败，已拒绝安装")
	}
	s.updates.mu.Lock()
	s.updates.info.State = "installing"
	s.updates.mu.Unlock()
	var command string
	var args []string
	if strings.HasSuffix(path, ".deb") {
		command = "apt-get"
		args = []string{"install", "-y", path}
	} else {
		command = "dnf"
		args = []string{"install", "-y", path}
	}
	executable, err := exec.LookPath(command)
	if err != nil {
		return err
	}
	if os.Geteuid() != 0 {
		args = append([]string{executable}, args...)
		executable, err = exec.LookPath("pkexec")
		if err != nil {
			return errors.New("请安装 policykit-1／polkit 以授权系统更新，或从 GitHub Release 手动安装")
		}
	}
	if out, err := exec.CommandContext(ctx, executable, args...).CombinedOutput(); err != nil {
		return fmt.Errorf("系统安装未完成（可取消后重试）：%w\n%s", err, string(out))
	}
	return nil
}
