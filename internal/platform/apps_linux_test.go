package platform

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestLinuxLaunchPassesDesktopAndURLAsArguments(t *testing.T) {
	dir := t.TempDir()
	log := filepath.Join(dir, "args")
	for _, name := range []string{"gio", "xdg-open"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$QD_TEST_ARGS\"\n"), 0700); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PATH", dir)
	t.Setenv("QD_TEST_ARGS", log)
	entry := filepath.Join(dir, "App with spaces;literal.desktop")
	if err := os.WriteFile(entry, []byte("[Desktop Entry]\nType=Application\nName=Fixture\nExec=true\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := LaunchApplication(entry); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(log)
	if string(raw) != "launch\n"+entry+"\n" {
		t.Fatalf("desktop arguments: %q", raw)
	}
	if err := LaunchApplication(filepath.Join(dir, "missing.desktop")); err == nil {
		t.Fatal("missing app accepted")
	}
	if err := Open("file:///etc/passwd", false); err == nil {
		t.Fatal("unsupported URL accepted")
	}
	url := "https://www.google.com/search?q=a%20b&literal=$(no-shell)"
	if err := Open(url, false); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		raw, _ = os.ReadFile(log)
		if strings.TrimSpace(string(raw)) == url {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("URL argument changed: %q", raw)
}
