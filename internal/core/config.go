package core

import (
	"encoding/json"
	"errors"
	"regexp"
)

// ConfigExport is a portable backup of preferences: settings, bookmarks and
// world clocks. Usage counts and histories stay on the machine.
type ConfigExport struct {
	Version     int      `json:"version"`
	App         string   `json:"app"`
	ExportedAt  int64    `json:"exportedAt"`
	Settings    Settings `json:"settings"`
	WorldClocks []string `json:"worldClocks"`
}

const configExportLimit = 1024 * 1024

var zoneName = regexp.MustCompile(`^[A-Za-z0-9_+\-/]{1,64}$`)

func ParseConfigExport(raw []byte) (ConfigExport, error) {
	var config ConfigExport
	if len(raw) > configExportLimit || json.Unmarshal(raw, &config) != nil || config.App != "QuickDock" {
		return config, errors.New("不是 QuickDock 配置文件")
	}
	if config.Version != 1 {
		return config, errors.New("配置文件版本不受支持")
	}
	if config.Settings.Bookmarks == nil {
		config.Settings.Bookmarks = []Bookmark{}
	}
	if config.Settings.DisabledTools == nil {
		config.Settings.DisabledTools = []string{}
	}
	if err := Validate(config.Settings); err != nil {
		return config, err
	}
	if len(config.WorldClocks) > 24 {
		return config, errors.New("配置文件内容无效")
	}
	for _, zone := range config.WorldClocks {
		if !zoneName.MatchString(zone) {
			return config, errors.New("配置文件内容无效")
		}
	}
	return config, nil
}
