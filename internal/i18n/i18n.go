package i18n

import (
	_ "embed"
	"encoding/json"
	"strings"
)

//go:embed messages.json
var raw []byte
var messages map[string]map[string]string

func init() {
	if err := json.Unmarshal(raw, &messages); err != nil {
		panic(err)
	}
}
func Valid(language string) bool {
	return language == "" || language == "system" || language == "zh-CN" || language == "zh-TW" || language == "en" || language == "ja" || language == "es"
}
func T(language, key string) string {
	if v := messages[language][key]; v != "" {
		return v
	}
	return key
}
func Resolve(value string) string {
	l := strings.ToLower(value)
	if strings.HasPrefix(l, "zh") {
		if strings.Contains(l, "tw") || strings.Contains(l, "hk") || strings.Contains(l, "mo") || strings.Contains(l, "hant") {
			return "zh-TW"
		}
		return "zh-CN"
	}
	for _, language := range []string{"ja", "es", "en"} {
		if strings.HasPrefix(l, language) {
			return language
		}
	}
	return "en"
}
