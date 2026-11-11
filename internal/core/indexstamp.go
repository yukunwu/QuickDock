package core

import (
	"crypto/sha256"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// ApplicationIndexStamp inspects directory entries and metadata, never icons or
// executable contents. App bundles are leaves, just as in Scan, so a background
// check does not recursively read the contents of every installed application.
func ApplicationIndexStamp(roots []string, extension string) [32]byte {
	hash := sha256.New()
	record := func(path string) {
		info, err := os.Stat(path)
		if err != nil {
			fmt.Fprintf(hash, "%q:missing:%v\n", path, os.IsNotExist(err))
			return
		}
		fmt.Fprintf(hash, "%q:%d:%d:%d\n", path, info.Size(), info.ModTime().UnixNano(), info.Mode())
	}
	for _, root := range roots {
		fmt.Fprintf(hash, "root:%q\n", root)
		_ = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				fmt.Fprintf(hash, "unreadable:%q:%v\n", path, os.IsNotExist(err))
				return nil
			}
			if strings.EqualFold(filepath.Ext(path), extension) {
				record(path)
				if extension == ".app" {
					// Installers can create .app before copying its metadata/executable. These
					// inexpensive stat calls detect completion even after the parent settles.
					for _, suffix := range []string{"Contents", "Contents/Info.plist", "Contents/MacOS", "Contents/Resources"} {
						record(filepath.Join(path, suffix))
					}
					if target, err := filepath.EvalSymlinks(path); err == nil {
						fmt.Fprintf(hash, "target:%q\n", target)
					}
					if entry.IsDir() {
						return filepath.SkipDir
					}
				}
			} else if entry.IsDir() {
				if extension == ".app" && strings.HasPrefix(entry.Name(), ".") {
					return filepath.SkipDir
				}
				record(path)
			}
			return nil
		})
	}
	var result [32]byte
	copy(result[:], hash.Sum(nil))
	return result
}
