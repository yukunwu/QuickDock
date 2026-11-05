package core

import (
	"encoding/json"
	"errors"
	"os"
)

var ToolTitles = map[string]string{"calculator": "计算稿纸", "json": "JSON 格式化", "timestamp": "时间戳转换", "base64": "Base64", "url": "URL 编解码", "uuid": "UUID 生成", "hash": "文本哈希", "units": "单位换算", "text": "文本处理", "bookmarks": "常用网址", "translate": "翻译"}

type ToolWindowState struct {
	Version    int    `json:"version"`
	ID         string `json:"id"`
	Open       bool   `json:"open"`
	X          int    `json:"x"`
	Y          int    `json:"y"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Positioned bool   `json:"positioned"`
	Session    string `json:"session"`
}

func ValidateToolSession(id, session string) error {
	if ToolTitles[id] == "" {
		return errors.New("未知工具")
	}
	if len(session) > 8*1024*1024 {
		return errors.New("独立窗口草稿超过8MiB，无法保存，请缩小输入")
	}
	var envelope struct {
		Version int `json:"version"`
	}
	if json.Unmarshal([]byte(session), &envelope) != nil || envelope.Version != 1 {
		return errors.New("无法识别的工具草稿版本")
	}
	return nil
}
func LoadToolWindow(path, id string) (ToolWindowState, error) {
	state := ToolWindowState{Version: 1, ID: id, Width: 960, Height: 660, Session: `{"version":1}`}
	if ToolTitles[id] == "" {
		return state, errors.New("未知工具")
	}
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if len(raw) > 50*1024*1024 || json.Unmarshal(raw, &state) != nil || state.Version != 1 || state.ID != id {
		return state, errors.New("独立窗口记录损坏或版本不兼容，保留原文件")
	}
	if err = ValidateToolSession(id, state.Session); err != nil {
		return state, err
	}
	state.Width = max(760, min(state.Width, 2400))
	state.Height = max(520, min(state.Height, 1600))
	return state, nil
}
