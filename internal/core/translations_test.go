package core

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestMergeTranslationTypingRestoreAndReorder(t *testing.T) {
	now := time.UnixMilli(1_800_000_000_000)
	rec := func(text, result string) TranslationRecord {
		return TranslationRecord{Text: text, Source: "auto", Target: "zh-CN", Result: result}
	}
	var list []TranslationRecord
	var err error
	step := func(r TranslationRecord, initial bool, at time.Time) bool {
		var changed bool
		list, changed, err = MergeTranslation(list, r, initial, at)
		if err != nil {
			t.Fatal(err)
		}
		return changed
	}
	step(rec("good", "好"), false, now)
	step(rec("good morning", "早上好"), false, now.Add(5*time.Second))
	if len(list) != 1 || list[0].Text != "good morning" || list[0].Result != "早上好" {
		t.Fatalf("typing must refine one record: %+v", list)
	}
	first := list[0].ID
	// A small correction stays in the same record; unrelated text is new.
	step(rec("good mornin", ""), false, now.Add(6*time.Second))
	step(rec("thanks", "谢谢"), false, now.Add(10*time.Second))
	if len(list) != 2 || list[1].ID != first || list[0].Text != "thanks" {
		t.Fatalf("%+v", list)
	}
	// Same text much later moves to the top instead of duplicating.
	step(rec("good mornin", "早上好"), false, now.Add(time.Hour))
	if len(list) != 2 || list[0].ID != first || list[0].Result != "早上好" {
		t.Fatalf("reorder %+v", list)
	}
	// Restoring a page refreshes the result in place without reordering.
	if !step(rec("thanks", "感谢"), true, now.Add(2*time.Hour)) || list[1].Result != "感谢" || list[0].ID != first {
		t.Fatalf("initial %+v", list)
	}
	if step(rec("thanks", ""), true, now.Add(3*time.Hour)) {
		t.Fatal("unchanged restore must not write")
	}
	// Long gaps never merge, even when the text continues.
	step(rec("good mornin everyone", ""), false, now.Add(5*time.Hour))
	if len(list) != 3 {
		t.Fatalf("stale merge %+v", list)
	}
	if _, _, err := MergeTranslation(list, TranslationRecord{Text: " ", Source: "auto", Target: "zh-CN"}, false, now); err == nil {
		t.Fatal("blank text accepted")
	}
	if _, _, err := MergeTranslation(list, TranslationRecord{Text: "x", Source: "auto", Target: "evil"}, false, now); err == nil {
		t.Fatal("bad language accepted")
	}
}
func TestLoadTranslationsRejectsCorruptFiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "translations.json")
	if state, err := LoadTranslations(path); err != nil || len(state.Records) != 0 {
		t.Fatal(state, err)
	}
	for _, raw := range []string{`{`, `{"version":2,"records":[]}`, `{"version":1,"records":[{"id":"a","createdAt":1,"text":"","source":"auto","target":"en"}]}`} {
		os.WriteFile(path, []byte(raw), 0600)
		if _, err := LoadTranslations(path); err == nil {
			t.Fatal("corrupt accepted", raw)
		}
	}
}
