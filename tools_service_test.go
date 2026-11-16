package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"quickdock/internal/core"
	"strings"
	"testing"
	"time"
)

func TestNotebookPersistenceRetentionDeletionAndProtection(t *testing.T) {
	dir := t.TempDir()
	s := newService(dir)
	for i := 0; i < 105; i++ {
		if _, err := s.recordForTest(fmt.Sprintf("%d+1", i), []string{fmt.Sprint(i + 1)}); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := newService(dir).Calculations()
	if err != nil || len(rows) != 100 || rows[0].Source != "104+1" || rows[99].Source != "5+1" {
		t.Fatal("retention/restart", len(rows), err)
	}
	again, err := s.recordForTest(rows[0].Source, rows[0].Results)
	if err != nil || len(again) != 100 || again[0].ID != rows[0].ID {
		t.Fatal("duplicate save")
	}
	rows, err = s.DeleteCalculation(rows[0].ID)
	if err != nil || len(rows) != 99 {
		t.Fatal("delete", err)
	}
	if _, err = s.recordForTest("1/0", []string{"Infinity"}); err == nil {
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
	if _, err = s.recordForTest("2+2", []string{"4"}); err == nil {
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
	if _, err := s.recordForTest("1+1", []string{"2"}); err == nil {
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

func TestExchangeRatesCacheAndOfflineFallback(t *testing.T) {
	s := newService(t.TempDir())
	calls := 0
	s.fetchRates = func(context.Context) (core.Rates, error) {
		calls++
		return core.Rates{Base: "EUR", Date: "2026-11-13", Rates: map[string]float64{"EUR": 1, "USD": 1.1}, FetchedAt: time.Now().UnixMilli()}, nil
	}
	if r, err := s.ExchangeRates(context.Background(), false); err != nil || r.Rates["USD"] != 1.1 || calls != 1 {
		t.Fatalf("%+v %v %d", r, err, calls)
	}
	if _, err := s.ExchangeRates(context.Background(), false); err != nil || calls != 1 {
		t.Fatal("fresh cache must not refetch", calls)
	}
	s.fetchRates = func(context.Context) (core.Rates, error) { calls++; return core.Rates{}, errors.New("offline") }
	r, err := s.ExchangeRates(context.Background(), true)
	if err != nil || calls != 2 || !r.Stale || r.Error != "offline" || r.Rates["USD"] != 1.1 {
		t.Fatalf("stale fallback %+v %v", r, err)
	}
	empty := newService(t.TempDir())
	empty.fetchRates = s.fetchRates
	if _, err = empty.ExchangeRates(context.Background(), false); err == nil {
		t.Fatal("no cache and offline must fail")
	}
}

func TestRecordCalculationUpdatesTheSheetBeingEdited(t *testing.T) {
	s := newService(t.TempDir())
	first, err := s.RecordCalculation("", "1+1", []string{"2"})
	if err != nil || first.ID == "" || len(first.Records) != 1 {
		t.Fatal(first, err)
	}
	next, err := s.RecordCalculation(first.ID, "1+1\n2*3", []string{"2", "6"})
	if err != nil || next.ID != first.ID || len(next.Records) != 1 || next.Records[0].Source != "1+1\n2*3" {
		t.Fatal("editing must update one record", next, err)
	}
	other, _ := s.RecordCalculation("", "9-1", []string{"8"})
	again, _ := s.RecordCalculation(first.ID, "1+1\n2*4", []string{"2", "8"})
	if len(again.Records) != 2 || again.Records[0].ID != first.ID || again.Records[1].ID != other.ID {
		t.Fatal("updated sheet moves to top", again.Records)
	}
	if _, err := s.DeleteCalculation(first.ID); err != nil {
		t.Fatal(err)
	}
	fresh, _ := s.RecordCalculation(first.ID, "5+5", []string{"10"})
	if fresh.ID == first.ID || len(fresh.Records) != 2 {
		t.Fatal("a deleted id starts a new record", fresh)
	}
	if _, err := s.RecordCalculation("", "1/0", []string{"Infinity"}); err == nil {
		t.Fatal("invalid sheet recorded")
	}
}
func TestTranslationHistoryFromPageReports(t *testing.T) {
	s := newService(t.TempDir())
	report := func(text, result string, initial bool) {
		raw, _ := json.Marshal(map[string]any{"action": "history", "text": text, "source": "auto", "target": "zh-CN", "result": result, "initial": initial})
		s.recordTranslation("launcher", string(raw))
	}
	report("hello", "你好", false)
	report("hello world", "你好世界", false)
	report("garbage", "", false)
	s.recordTranslation("launcher", `{"text":"x","source":"auto","target":"evil"}`)
	rows, err := s.TranslationHistory()
	if err != nil || len(rows) != 2 || rows[0].Text != "garbage" || rows[1].Result != "你好世界" {
		t.Fatalf("%+v %v", rows, err)
	}
	// After an explicit submit, the page load counts as new work and moves up.
	s.translationSubmits["launcher"] = true
	report("hello world", "你好世界", true)
	rows, _ = s.TranslationHistory()
	if rows[0].Text != "hello world" || s.translationSubmits["launcher"] {
		t.Fatalf("submit %+v", rows)
	}
	if rows, err = s.DeleteTranslation(rows[0].ID); err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	if err = s.ClearTranslations(); err != nil {
		t.Fatal(err)
	}
	if rows, _ = s.TranslationHistory(); len(rows) != 0 {
		t.Fatal(rows)
	}
}

func (s *Service) recordForTest(source string, results []string) ([]core.Calculation, error) {
	saved, err := s.RecordCalculation("", source, results)
	return saved.Records, err
}
