package core

import (
	"crypto/sha256"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// App bundles are leaves: embedded helpers must never become launcher results.
func Scan(roots []string, metadata func(string) (AppEntry, error)) ([]AppEntry, error) {
	entries := []AppEntry{}
	seen := map[string]bool{}
	var problems []string
	for _, root := range roots {
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				if os.IsNotExist(err) {
					return nil
				}
				problems = append(problems, fmt.Sprintf("%s: %v", path, err))
				if d != nil && d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if strings.HasSuffix(strings.ToLower(d.Name()), ".app") {
				real, e := filepath.EvalSymlinks(path)
				if e == nil && !seen[real] {
					seen[real] = true
					entry, e := metadata(path)
					if e == nil {
						entry.Path = path
						entry.ID = fmt.Sprintf("app-%x", sha256.Sum256([]byte(real)))
						entries = append(entries, entry)
					} else {
						problems = append(problems, fmt.Sprintf("%s: %v", path, e))
					}
				}
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if d.IsDir() && strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		})
		if err != nil && !os.IsNotExist(err) {
			problems = append(problems, err.Error())
		}
	}
	sort.Slice(entries, func(i, j int) bool { return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name) })
	if len(problems) > 0 {
		return entries, fmt.Errorf("部分应用未能读取（%d 项）：%s", len(problems), problems[0])
	}
	return entries, nil
}
