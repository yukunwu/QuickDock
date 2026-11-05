package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"quickdock/internal/core"
	"strings"
	"testing"
)

func TestNotebookPersistenceRetentionDeletionAndProtection(t *testing.T) {
	dir := t.TempDir()
	s := newService(dir)
	for i := 0; i < 105; i++ {
		if _, err := s.SaveCalculation(fmt.Sprintf("%d+1", i), []string{fmt.Sprint(i + 1)}); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := newService(dir).Calculations()
	if err != nil || len(rows) != 100 || rows[0].Source != "104+1" || rows[99].Source != "5+1" {
		t.Fatal("retention/restart", len(rows), err)
	}
	again, err := s.SaveCalculation(rows[0].Source, rows[0].Results)
	if err != nil || len(again) != 100 || again[0].ID != rows[0].ID {
		t.Fatal("duplicate save")
	}
	rows, err = s.DeleteCalculation(rows[0].ID)
	if err != nil || len(rows) != 99 {
		t.Fatal("delete", err)
	}
	if _, err = s.SaveCalculation("1/0", []string{"Infinity"}); err == nil {
		t.Fatal("invalid saved")
	}
	if err = s.ClearCalculations(); err != nil {
		t.Fatal(err)
	}
	rows, err = newService(dir).Calculations()
	if err != nil || len(rows) != 0 {
		t.Fatal("clear not persisted")
	}
	path := filepath.Join(dir, "calculations.json")
	original := []byte(`{"version":99,"records":[]}`)
	if err = os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = s.SaveCalculation("2+2", []string{"4"}); err == nil {
		t.Fatal("future version overwritten")
	}
	if err = s.ClearCalculations(); err == nil {
		t.Fatal("future version cleared")
	}
	raw, _ := os.ReadFile(path)
	if string(raw) != string(original) {
		t.Fatal("data changed")
	}
}
func TestNotebookFailedWriteKeepsPrevious(t *testing.T) {
	dir := t.TempDir()
	s := newService(dir)
	// A directory where the file belongs must be an explicit failure.
	if err := os.Mkdir(filepath.Join(dir, "calculations.json"), 0700); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SaveCalculation("1+1", []string{"2"}); err == nil {
		t.Fatal("write failure hidden")
	}
	if err := core.ValidateCalculation("# note\n1+1\nans*2", []string{"", "2", "4"}); err != nil {
		t.Fatal(err)
	}
}
func TestTranslationLive(t *testing.T) {
	if os.Getenv("QUICKDOCK_TEST_TRANSLATION") != "1" {
		t.Skip("explicit live network probe only")
	}
	s := newService(t.TempDir())
	result, err := s.Translate(context.Background(), "Hello, world.", "en", "zh-CN", "mymemory")
	if err != nil || result.Text == "" || result.Text == "Hello, world." {
		t.Fatalf("translation failed: %+v %v", result, err)
	}
	t.Logf("MyMemory synthetic phrase translated: %s", result.Text)
	result, err = s.Translate(context.Background(), "我爱你", "zh-CN", "en", "mymemory")
	if err != nil || !strings.EqualFold(strings.TrimSpace(result.Text), "I love you") {
		t.Fatalf("common phrase translation failed: %+v %v", result, err)
	}
	t.Logf("MyMemory Chinese phrase checked: %s", result.Text)
}
