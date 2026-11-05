package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"quickdock/internal/i18n"
	"runtime"
	"strings"
	"time"
)

type Bookmark struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	URL   string `json:"url"`
	Alias string `json:"alias"`
}
type Settings struct {
	Version       int        `json:"version"`
	Language      string     `json:"language,omitempty"`
	Theme         string     `json:"theme"`
	Shortcut      string     `json:"shortcut"`
	DisabledTools []string   `json:"disabledTools"`
	Bookmarks     []Bookmark `json:"bookmarks"`
}
type Usage struct {
	Count    int   `json:"count"`
	LastUsed int64 `json:"lastUsed"`
}
type AppEntry struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Path     string `json:"path"`
	BundleID string `json:"bundleId"`
	Icon     string `json:"icon,omitempty"`
}
type State struct {
	Version  int              `json:"version"`
	Settings Settings         `json:"settings"`
	Usage    map[string]Usage `json:"usage"`
}

func Defaults() State {
	shortcut := "Ctrl+Alt+Space"
	if runtime.GOOS == "darwin" {
		shortcut = "Option+Space"
	}
	return State{Version: 1, Settings: Settings{Version: 1, Theme: "system", Shortcut: shortcut, DisabledTools: []string{}, Bookmarks: []Bookmark{}}, Usage: map[string]Usage{}}
}
func Validate(s Settings) error {
	if s.Version != 1 {
		return errors.New("不支持的设置版本")
	}
	if !i18n.Valid(s.Language) {
		return errors.New("不支持的界面语言")
	}
	if s.Theme != "system" && s.Theme != "light" && s.Theme != "dark" {
		return errors.New("无效主题")
	}
	if strings.TrimSpace(s.Shortcut) == "" {
		return errors.New("快捷键不能为空")
	}
	valid := map[string]bool{}
	for _, id := range []string{"calculator", "timestamp", "json", "base64", "url", "uuid", "hash", "units", "text", "bookmarks", "translate", "google"} {
		valid[id] = true
	}
	for _, id := range s.DisabledTools {
		if !valid[id] {
			return fmt.Errorf("未知工具: %s", id)
		}
	}
	seen := map[string]bool{}
	for _, b := range s.Bookmarks {
		if b.ID == "" || seen[b.ID] || strings.TrimSpace(b.Name) == "" {
			return errors.New("网址名称或标识无效")
		}
		seen[b.ID] = true
		if err := ValidateURL(b.URL); err != nil {
			return err
		}
	}
	return nil
}
func ValidateURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil {
		return errors.New("网址必须为不含登录凭据的 http:// 或 https:// 地址")
	}
	return nil
}
func AtomicJSON(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".quickdock-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err = f.Chmod(0600); err == nil {
		_, err = f.Write(data)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(f.Name(), path)
}
func Load(path string) (State, string, error) {
	state := Defaults()
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return state, "", nil
	}
	if err != nil {
		return state, "", err
	}
	err = json.Unmarshal(data, &state)
	if err == nil && state.Version != 1 {
		return Defaults(), "", errors.New("配置版本不受支持，已保留原文件，禁止覆盖")
	}
	if err == nil {
		err = Validate(state.Settings)
	}
	if err != nil {
		backup := path + ".corrupt-" + time.Now().Format("20060102-150405.000000000")
		if renameErr := os.Rename(path, backup); renameErr != nil {
			return Defaults(), "", renameErr
		}
		return Defaults(), "配置损坏，已备份为 " + filepath.Base(backup) + " 并恢复默认", nil
	}
	if state.Usage == nil {
		state.Usage = map[string]Usage{}
	}
	if state.Settings.Bookmarks == nil {
		state.Settings.Bookmarks = []Bookmark{}
	}
	if state.Settings.DisabledTools == nil {
		state.Settings.DisabledTools = []string{}
	}
	return state, "", nil
}
