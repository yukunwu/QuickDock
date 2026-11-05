package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/updater"
	ghupdate "github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

type fixtureProvider struct {
	rel     *updater.Release
	payload []byte
}

func (p fixtureProvider) Name() string { return "fixture" }
func (p fixtureProvider) Check(context.Context, updater.CheckRequest) (*updater.Release, error) {
	return p.rel, nil
}
func (p fixtureProvider) Download(_ context.Context, _ *updater.Release, w io.Writer, progress func(int64, int64)) error {
	n, e := w.Write(p.payload)
	progress(int64(n), int64(len(p.payload)))
	return e
}

type updateTestHost struct{}

func (updateTestHost) Emit(string, ...any) bool         { return true }
func (updateTestHost) OnEvent(string, func(any)) func() { return func() {} }
func (updateTestHost) OpenWindow(updater.WindowOptions) updater.WindowHandle {
	panic("unexpected update window")
}
func (updateTestHost) Quit() { panic("staging test must not quit") }

func TestReleaseAssetSelectionEveryPlatform(t *testing.T) {
	assets := []ghupdate.ReleaseAsset{}
	for _, p := range []string{"macos", "windows", "linux"} {
		for _, a := range []string{"x64", "arm64"} {
			for _, e := range []string{"zip", "deb", "rpm"} {
				assets = append(assets, ghupdate.ReleaseAsset{Name: "QuickDock-0.1.2-" + p + "-" + a + "." + e})
			}
		}
	}
	for _, p := range []string{"darwin", "windows", "linux"} {
		for _, a := range []string{"amd64", "arm64"} {
			for _, f := range []string{"deb", "rpm"} {
				i := releaseMatcher(f)(updater.CheckRequest{Platform: p, Arch: a}, assets)
				if i < 0 {
					t.Fatalf("missing %s/%s/%s", p, a, f)
				}
				expectedP := p
				if p == "darwin" {
					expectedP = "macos"
				}
				expectedA := a
				if a == "amd64" {
					expectedA = "x64"
				}
				ext := "zip"
				if p == "linux" {
					ext = f
				}
				if got := assets[i].Name; got != "QuickDock-0.1.2-"+expectedP+"-"+expectedA+"."+ext {
					t.Fatal(got)
				}
			}
		}
	}
	if releaseMatcher("deb")(updater.CheckRequest{Platform: "linux", Arch: "386"}, assets) != -1 {
		t.Fatal("32-bit matched")
	}
}
func TestUpdatesRejectMissingChecksum(t *testing.T) {
	for _, v := range []*updater.Verification{nil, {}, {DigestAlgo: "sha256", Digest: []byte("short")}} {
		p := verifiedProvider{fixtureProvider{rel: &updater.Release{Version: "0.1.2", Verification: v}}}
		if _, e := p.Check(context.Background(), updater.CheckRequest{}); e == nil {
			t.Fatal("unverified release accepted")
		}
	}
}
func TestUpdaterStagesOneExecutableAndRejectsTampering(t *testing.T) {
	var archive bytes.Buffer
	z := zip.NewWriter(&archive)
	header := &zip.FileHeader{Name: "QuickDock.exe", Method: zip.Deflate}
	header.SetMode(0755)
	f, _ := z.CreateHeader(header)
	f.Write([]byte("fixture executable"))
	z.Close()
	payload := archive.Bytes()
	digest := sha256.Sum256(payload)
	for _, corrupt := range []bool{false, true} {
		expected := append([]byte{}, digest[:]...)
		if corrupt {
			expected[0] ^= 255
		}
		rel := &updater.Release{Version: "0.1.2", Artifact: updater.Artifact{Filename: "QuickDock-0.1.2-windows-x64.zip"}, Verification: &updater.Verification{DigestAlgo: "sha256", Digest: expected}}
		p := verifiedProvider{fixtureProvider{rel: rel, payload: payload}}
		u := updater.New(updateTestHost{})
		if e := u.Init(updater.Config{CurrentVersion: "0.1.1", Providers: []updater.Provider{p}, Window: updater.WindowNone}); e != nil {
			t.Fatal(e)
		}
		if _, e := u.Check(context.Background()); e != nil {
			t.Fatal(e)
		}
		err := u.DownloadAndInstall(context.Background())
		if corrupt {
			if err == nil || u.DownloadedPath() != "" {
				t.Fatal("tampered payload staged")
			}
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		path := u.DownloadedPath()
		defer os.RemoveAll(filepath.Dir(path))
		raw, e := os.ReadFile(path)
		if e != nil || string(raw) != "fixture executable" || u.State() != updater.StateReady {
			t.Fatal(path, e, u.State())
		}
	}
}
func TestUpdateActionsRequireAvailableAndReady(t *testing.T) {
	s := newService(t.TempDir())
	if s.InstallUpdate() == nil || s.RestartAfterUpdate() == nil {
		t.Fatal("unprepared update action accepted")
	}
	if _, err := s.CheckForUpdates(); err == nil {
		t.Fatal("unconfigured service accepted")
	}
}
