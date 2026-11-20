package main

import (
	"fmt"
	"testing"
)

func TestClipboardPinsSurviveClearAndAreBounded(t *testing.T) {
	s := newService(t.TempDir())
	if s.clipboardEnabled() {
		t.Fatal("clipboard history must be opt-in")
	}
	for _, text := range []string{"keep", "drop"} {
		s.recordClipboard(text)
	}
	records, err := s.ClipboardHistory()
	if err != nil || len(records) != 2 || records[0].Text != "drop" {
		t.Fatal(records, err)
	}
	if _, err = s.PinClipboard(records[1].ID, true); err != nil {
		t.Fatal(err)
	}
	if records, err = s.ClearClipboard(); err != nil || len(records) != 1 || records[0].Text != "keep" {
		t.Fatal(records, err)
	}
	for i := 0; i < clipboardPinLimit; i++ {
		s.recordClipboard(fmt.Sprint("item ", i))
	}
	records, _ = s.ClipboardHistory()
	for _, r := range records[:clipboardPinLimit-1] {
		if _, err = s.PinClipboard(r.ID, true); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = s.PinClipboard(records[clipboardPinLimit-1].ID, true); err == nil {
		t.Fatal("pin limit ignored")
	}
	if records, _ = s.DeleteClipboard(records[0].ID); len(records) != clipboardPinLimit {
		t.Fatal(len(records))
	}
}
