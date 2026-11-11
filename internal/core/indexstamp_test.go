package core

import (
	"os"
	"path/filepath"
	"testing"
)

func TestIndexStampTracksIncompleteBundlesNestedInstallsAndRemovals(t *testing.T) {
	root := filepath.Join(t.TempDir(), "Applications")
	roots := []string{root}
	previous := ApplicationIndexStamp(roots, ".app")
	changed := func() {
		t.Helper()
		next := ApplicationIndexStamp(roots, ".app")
		if next == previous {
			t.Fatal("change missed")
		}
		previous = next
	}
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(filepath.Join(root, "Utilities", "Test.app"), 0700))
	changed()
	contents := filepath.Join(root, "Utilities", "Test.app", "Contents")
	must(os.MkdirAll(filepath.Join(contents, "MacOS"), 0700))
	changed()
	must(os.WriteFile(filepath.Join(contents, "Info.plist"), []byte("metadata complete"), 0600))
	changed()
	// Helpers inside an application are irrelevant to launcher index contents.
	must(os.MkdirAll(filepath.Join(contents, "Helpers", "Helper.app"), 0700))
	stable := ApplicationIndexStamp(roots, ".app")
	must(os.WriteFile(filepath.Join(contents, "Helpers", "Helper.app", "irrelevant"), []byte("x"), 0600))
	if ApplicationIndexStamp(roots, ".app") != stable {
		t.Fatal("traversed application contents")
	}
	must(os.RemoveAll(filepath.Join(root, "Utilities", "Test.app")))
	changed()
}
func TestIndexStampTracksDesktopAndShortcutReplacement(t *testing.T) {
	for _, ext := range []string{".desktop", ".lnk"} {
		t.Run(ext, func(t *testing.T) {
			root := t.TempDir()
			roots := []string{root}
			before := ApplicationIndexStamp(roots, ext)
			path := filepath.Join(root, "App"+ext)
			if err := os.WriteFile(path, []byte("first"), 0600); err != nil {
				t.Fatal(err)
			}
			created := ApplicationIndexStamp(roots, ext)
			if created == before {
				t.Fatal("install missed")
			}
			if err := os.WriteFile(path, []byte("different metadata"), 0600); err != nil {
				t.Fatal(err)
			}
			if ApplicationIndexStamp(roots, ext) == created {
				t.Fatal("replacement missed")
			}
		})
	}
}
