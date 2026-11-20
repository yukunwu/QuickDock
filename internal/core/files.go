package core

import (
	"path/filepath"
	"sort"
	"strings"
)

type FileHit struct {
	Path   string `json:"path"`
	Name   string `json:"name"`
	Folder string `json:"folder"`
}

// RankFiles orders search hits by how well the file name matches (exact,
// prefix, then substring) and then by path depth, dropping hidden paths and
// caches that drown out user files.
func RankFiles(paths []string, query string, home string, limit int) []FileHit {
	q := strings.ToLower(strings.TrimSpace(query))
	type scored struct {
		hit   FileHit
		score int
		depth int
	}
	rows := []scored{}
	seen := map[string]bool{}
	for _, path := range paths {
		path = filepath.Clean(strings.TrimSpace(path))
		if path == "." || seen[path] || noisyPath(path, home) {
			continue
		}
		seen[path] = true
		name := filepath.Base(path)
		lower := strings.ToLower(name)
		stem := strings.ToLower(strings.TrimSuffix(name, filepath.Ext(name)))
		score := 1
		switch {
		case lower == q || stem == q:
			score = 3
		case strings.HasPrefix(lower, q):
			score = 2
		case !strings.Contains(lower, q):
			continue
		}
		folder := filepath.Dir(path)
		if home != "" && (folder == home || strings.HasPrefix(folder, home+string(filepath.Separator))) {
			folder = "~" + strings.TrimPrefix(folder, home)
		}
		rows = append(rows, scored{FileHit{path, name, folder}, score, strings.Count(path, string(filepath.Separator))})
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].score != rows[j].score {
			return rows[i].score > rows[j].score
		}
		return rows[i].depth < rows[j].depth
	})
	out := []FileHit{}
	for i := 0; i < len(rows) && i < limit; i++ {
		out = append(out, rows[i].hit)
	}
	return out
}
func noisyPath(path, home string) bool {
	rel := path
	if home != "" {
		rel = strings.TrimPrefix(path, home)
	}
	for _, part := range strings.Split(filepath.ToSlash(rel), "/") {
		if strings.HasPrefix(part, ".") || part == "node_modules" || part == "__pycache__" {
			return true
		}
	}
	lower := strings.ToLower(filepath.ToSlash(rel))
	return strings.HasPrefix(lower, "/library/") || strings.HasPrefix(lower, "/appdata/")
}
