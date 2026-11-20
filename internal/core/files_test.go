package core

import (
	"path/filepath"
	"testing"
)

func TestRankFiles(t *testing.T) {
	home := filepath.FromSlash("/Users/me")
	paths := []string{
		"/Users/me/Projects/deep/notes/report-final.pdf",
		"/Users/me/report.pdf",
		"/Users/me/Documents/Report",
		"/Users/me/.cache/report.pdf",
		"/Users/me/Library/Caches/report.txt",
		"/Users/me/code/node_modules/report/index.js",
		"/Users/me/Documents/annual-report.docx",
		"/Users/me/report.pdf",
	}
	for i := range paths {
		paths[i] = filepath.FromSlash(paths[i])
	}
	hits := RankFiles(paths, "Report", home, 10)
	names := []string{}
	for _, h := range hits {
		names = append(names, h.Name)
	}
	want := []string{"report.pdf", "Report", "report-final.pdf", "annual-report.docx"}
	if len(names) != len(want) {
		t.Fatal(names)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Fatal(names)
		}
	}
	if hits[1].Folder != filepath.FromSlash("~/Documents") {
		t.Fatal(hits[1].Folder)
	}
	if len(RankFiles(paths, "report", home, 2)) != 2 {
		t.Fatal("limit ignored")
	}
}
