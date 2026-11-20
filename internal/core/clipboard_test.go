package core

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAddClipboardDedupesAndKeepsPins(t *testing.T) {
	now := time.UnixMilli(1_000)
	records, changed, err := AddClipboard(nil, "a", now)
	if err != nil || !changed || len(records) != 1 {
		t.Fatal(records, changed, err)
	}
	records[0].Pinned = true
	pinnedID := records[0].ID
	records, _, _ = AddClipboard(records, "b", now)
	// Copying the newest text again is not a new event.
	if again, changed, _ := AddClipboard(records, "b", now); changed || len(again) != 2 {
		t.Fatal("repeat copy recorded")
	}
	records, _, _ = AddClipboard(records, "a", now.Add(time.Second))
	if len(records) != 2 || records[0].ID != pinnedID || !records[0].Pinned || records[0].CreatedAt != 2_000 {
		t.Fatal(records)
	}
	for _, skipped := range []string{"   \n", strings.Repeat("x", ClipboardTextLimit+1), "\xff"} {
		if _, changed, _ := AddClipboard(records, skipped, now); changed {
			t.Fatalf("recorded %q", skipped[:1])
		}
	}
}
func TestAddClipboardTrimsOldestUnpinned(t *testing.T) {
	var records []ClipboardEntry
	for i := 0; i < ClipboardLimit; i++ {
		records, _, _ = AddClipboard(records, string(rune('A'+i%26))+strings.Repeat("-", i), time.UnixMilli(int64(i+1)))
	}
	records[len(records)-1].Pinned = true // the oldest entry
	oldest := records[len(records)-1].Text
	records, _, _ = AddClipboard(records, "new", time.UnixMilli(9_999))
	if len(records) != ClipboardLimit || records[len(records)-1].Text != oldest || records[0].Text != "new" {
		t.Fatal(len(records), records[len(records)-1].Text)
	}
	// The byte budget trims too, not only the count.
	big := strings.Repeat("y", ClipboardTextLimit)
	for i := 0; i < 60; i++ {
		records, _, _ = AddClipboard(records, big+string(rune('a'+i%26))+strings.Repeat("z", i), time.UnixMilli(10_000+int64(i)))
	}
	size := 0
	for _, r := range records {
		size += len(r.Text)
	}
	if size > clipboardBudget || records[len(records)-1].Text != oldest {
		t.Fatal(size)
	}
}
func TestLoadClipboardRejectsCorruptHistory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "clipboard.json")
	if state, err := LoadClipboard(path); err != nil || len(state.Records) != 0 {
		t.Fatal(state, err)
	}
	for _, raw := range []string{`{"version":2,"records":[]}`, `{"version":1,"records":[{"id":"","createdAt":1,"text":"a"}]}`, `{"version":1,"records":[{"id":"1","createdAt":1,"text":"a"},{"id":"1","createdAt":2,"text":"b"}]}`, `nope`} {
		if err := os.WriteFile(path, []byte(raw), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := LoadClipboard(path); err == nil {
			t.Fatal("accepted", raw)
		}
	}
}
func TestClipboardBudgetCountsEscapesAndPins(t *testing.T) {
	path := filepath.Join(t.TempDir(), "clipboard.json")
	var records []ClipboardEntry
	heavy := strings.Repeat("<a>&", ClipboardTextLimit/4-8)
	for i := 0; i < 60; i++ {
		records, _, _ = AddClipboard(records, fmt.Sprintf("%s%04d", heavy, i), time.UnixMilli(int64(i+1)))
		records[0].Pinned = true
		if err := AtomicJSON(path, ClipboardFile{Version: 1, Records: records}); err != nil {
			t.Fatal(err)
		}
		if _, err := LoadClipboard(path); err != nil {
			t.Fatalf("history unreadable after %d copies: %v", i+1, err)
		}
	}
	if records[0].Text != heavy+"0059" {
		t.Fatal("newest entry dropped")
	}
}
