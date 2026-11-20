package core

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParseConfigExport(t *testing.T) {
	settings := Defaults().Settings
	settings.Bookmarks = []Bookmark{{ID: "gh", Name: "GitHub", URL: "https://github.com/search?q={query}", Alias: "gh"}}
	raw, _ := json.Marshal(ConfigExport{Version: 1, App: "QuickDock", Settings: settings, WorldClocks: []string{"Asia/Shanghai", "Etc/GMT+8"}})
	config, err := ParseConfigExport(raw)
	if err != nil || len(config.Settings.Bookmarks) != 1 || len(config.WorldClocks) != 2 {
		t.Fatal(config, err)
	}
	for _, bad := range []string{
		`{"version":1,"app":"Other"}`,
		`{"version":2,"app":"QuickDock"}`,
		strings.Replace(string(raw), `"theme":"system"`, `"theme":"neon"`, 1),
		strings.Replace(string(raw), `"Etc/GMT+8"`, `"<script>"`, 1),
		strings.Replace(string(raw), `https://github.com`, `javascript://x`, 1),
	} {
		if _, err := ParseConfigExport([]byte(bad)); err == nil {
			t.Fatal("accepted", bad)
		}
	}
}
