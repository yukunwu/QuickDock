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

// TranslationRecord is one remembered Google page translation. Result is
// best-effort text read from the page and may be empty.
type TranslationRecord struct {
	ID        string `json:"id"`
	CreatedAt int64  `json:"createdAt"`
	Text      string `json:"text"`
	Source    string `json:"source"`
	Target    string `json:"target"`
	Result    string `json:"result"`
}
type TranslationFile struct {
	Version int                 `json:"version"`
	Records []TranslationRecord `json:"records"`
}

const translationLimit = 200

// Typing pauses within this window refine the newest record instead of
// adding a new one.
const translationMergeWindow = 2 * time.Minute

func ValidateTranslationRecord(r TranslationRecord) error {
	if strings.TrimSpace(r.Text) == "" || !utf8.ValidString(r.Text) || utf8.RuneCountInString(r.Text) > 5000 {
		return errors.New("翻译内容须为1～5000字符")
	}
	if !Languages[r.Source] || !Languages[r.Target] || r.Target == "auto" {
		return errors.New("请选择有效语言")
	}
	if !utf8.ValidString(r.Result) || utf8.RuneCountInString(r.Result) > 20000 {
		return errors.New("翻译服务返回了无法识别的结果")
	}
	return nil
}
func LoadTranslations(path string) (TranslationFile, error) {
	empty := TranslationFile{Version: 1, Records: []TranslationRecord{}}
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return empty, nil
	}
	if err != nil {
		return empty, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 10*1024*1024+1))
	if err != nil {
		return empty, err
	}
	if len(data) > 10*1024*1024 {
		return empty, errors.New("翻译历史文件过大，已保留原文件")
	}
	var state TranslationFile
	if json.Unmarshal(data, &state) != nil || state.Version != 1 || len(state.Records) > translationLimit {
		return empty, errors.New("翻译历史损坏或版本不支持，已保留原文件，禁止覆盖")
	}
	seen := map[string]bool{}
	for _, r := range state.Records {
		if r.ID == "" || seen[r.ID] || r.CreatedAt <= 0 || ValidateTranslationRecord(r) != nil {
			return empty, errors.New("翻译历史内容无效，已保留原文件，禁止覆盖")
		}
		seen[r.ID] = true
	}
	if state.Records == nil {
		state.Records = []TranslationRecord{}
	}
	return state, nil
}

// continues reports whether next is the same piece of work as previous:
// more text typed, or a little deleted while correcting.
func continues(previous, next string) bool {
	if strings.HasPrefix(next, previous) {
		return true
	}
	return strings.HasPrefix(previous, next) && len(next)*2 >= len(previous)
}

// MergeTranslation applies one observation from the page. initial marks a page
// load restoring earlier text: it refreshes a known record without reordering.
func MergeTranslation(records []TranslationRecord, next TranslationRecord, initial bool, now time.Time) ([]TranslationRecord, bool, error) {
	next.Text = strings.TrimSpace(next.Text)
	next.Result = strings.TrimSpace(next.Result)
	if err := ValidateTranslationRecord(next); err != nil {
		return records, false, err
	}
	same := -1
	for i, r := range records {
		if r.Text == next.Text && r.Target == next.Target {
			same = i
			break
		}
	}
	if same >= 0 && (initial || same == 0) {
		r := records[same]
		if (next.Result == "" || r.Result == next.Result) && (initial || r.Source == next.Source) {
			return records, false, nil
		}
		if initial {
			out := append([]TranslationRecord{}, records...)
			out[same].Result = next.Result
			return out, true, nil
		}
	}
	// The record this observation replaces: the same text, or the newest one
	// when the user is still typing it.
	replace := same
	if replace < 0 && !initial && len(records) > 0 && records[0].Target == next.Target &&
		now.Sub(time.UnixMilli(records[0].CreatedAt)) < translationMergeWindow && continues(records[0].Text, next.Text) {
		replace = 0
	}
	if replace >= 0 {
		next.ID = records[replace].ID
		if next.Result == "" && records[replace].Text == next.Text {
			next.Result = records[replace].Result
		}
	} else {
		var id [16]byte
		if _, err := rand.Read(id[:]); err != nil {
			return records, false, err
		}
		next.ID = hex.EncodeToString(id[:])
	}
	next.CreatedAt = now.UnixMilli()
	out := []TranslationRecord{next}
	for i, r := range records {
		if i != replace {
			out = append(out, r)
		}
	}
	if len(out) > translationLimit {
		out = out[:translationLimit]
	}
	return out, true, nil
}
