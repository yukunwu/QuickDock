package core

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"time"
	"unicode/utf8"
)

// ClipboardEntry is one copied text. Pinned entries are kept when the history
// is trimmed and listed first.
type ClipboardEntry struct {
	ID        string `json:"id"`
	CreatedAt int64  `json:"createdAt"`
	Text      string `json:"text"`
	Pinned    bool   `json:"pinned,omitempty"`
}
type ClipboardFile struct {
	Version int              `json:"version"`
	Records []ClipboardEntry `json:"records"`
}

const (
	ClipboardLimit = 200
	// Larger copies (whole files, logs) are skipped rather than truncated.
	ClipboardTextLimit = 100 * 1024
	// Bounds the file rewritten on every copy.
	clipboardBudget = 4 * 1024 * 1024
)

func LoadClipboard(path string) (ClipboardFile, error) {
	empty := ClipboardFile{Version: 1, Records: []ClipboardEntry{}}
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return empty, nil
	}
	if err != nil {
		return empty, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 2*clipboardBudget+1))
	if err != nil {
		return empty, err
	}
	var state ClipboardFile
	if len(data) > 2*clipboardBudget || json.Unmarshal(data, &state) != nil || state.Version != 1 || len(state.Records) > ClipboardLimit {
		return empty, errors.New("剪贴板历史损坏或版本不支持，已保留原文件，禁止覆盖")
	}
	seen := map[string]bool{}
	for _, r := range state.Records {
		if r.ID == "" || seen[r.ID] || r.CreatedAt <= 0 || !clipboardText(r.Text) {
			return empty, errors.New("剪贴板历史内容无效，已保留原文件，禁止覆盖")
		}
		seen[r.ID] = true
	}
	if state.Records == nil {
		state.Records = []ClipboardEntry{}
	}
	return state, nil
}
func clipboardText(text string) bool {
	return strings.TrimSpace(text) != "" && len(text) <= ClipboardTextLimit && utf8.ValidString(text)
}

// AddClipboard records a copy. Copying known text again moves it to the top,
// keeping its pin; the oldest unpinned entries go first when over the limits.
func AddClipboard(records []ClipboardEntry, text string, now time.Time) ([]ClipboardEntry, bool, error) {
	if !clipboardText(text) {
		return records, false, nil
	}
	if len(records) > 0 && records[0].Text == text {
		return records, false, nil
	}
	next := ClipboardEntry{CreatedAt: now.UnixMilli(), Text: text}
	rest := make([]ClipboardEntry, 0, len(records))
	for _, r := range records {
		if r.Text == text {
			next.ID, next.Pinned = r.ID, r.Pinned
		} else {
			rest = append(rest, r)
		}
	}
	if next.ID == "" {
		var id [16]byte
		if _, err := rand.Read(id[:]); err != nil {
			return records, false, err
		}
		next.ID = hex.EncodeToString(id[:])
	}
	out := append([]ClipboardEntry{next}, rest...)
	size := 0
	for _, r := range out {
		size += len(r.Text)
	}
	for i := len(out) - 1; i > 0 && (len(out) > ClipboardLimit || size > clipboardBudget); i-- {
		if !out[i].Pinned {
			size -= len(out[i].Text)
			out = append(out[:i], out[i+1:]...)
		}
	}
	return out, true, nil
}
