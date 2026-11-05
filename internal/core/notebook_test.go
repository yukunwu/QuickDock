package core

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestNotebookEncodedHistoryFitsLoadLimit(t *testing.T) {
	records := []Calculation{}
	for i := 0; i < 100; i++ {
		records = append(records, Calculation{ID: "x", CreatedAt: 1, Source: "#" + strings.Repeat("\x01", 19990) + "\n1", Results: []string{"", "1"}})
	}
	bounded := BoundCalculations(records)
	if len(bounded) == 0 || len(bounded) >= 100 {
		t.Fatal("escaped input was not bounded")
	}
	raw, err := json.Marshal(CalculationFile{Version: 1, Records: bounded})
	if err != nil || len(raw) > 8*1024*1024 {
		t.Fatal("history exceeds size budget", len(raw), err)
	}
}
