package main

import (
	"os"
	"path/filepath"
	"quickdock/internal/core"
	"strings"
	"testing"
)

func TestToolWindowsPersistSeparatelyAndProtectCorruptState(t *testing.T) {
	dir := t.TempDir()
	s := newService(dir)
	calc := `{"version":1,"draft":{"input":"123+456"}}`
	translation := `{"version":1,"translation":{"query":"hello"}}`
	if err := s.SaveToolWindow("calculator", calc); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveToolWindow("translate", translation); err != nil {
		t.Fatal(err)
	}
	reopened := newService(dir)
	state, err := reopened.ToolWindowState("calculator")
	if err != nil || state.Session != calc {
		t.Fatal(state, err)
	}
	state, err = reopened.ToolWindowState("translate")
	if err != nil || state.Session != translation {
		t.Fatal(state, err)
	}
	if err = s.SaveToolWindow("../escape", calc); err == nil {
		t.Fatal("invalid id accepted")
	}
	if err = s.SaveToolWindow("json", `{"version":2}`); err == nil {
		t.Fatal("future session accepted")
	}
	if err = s.SaveToolWindow("json", `{"version":1,"input":"`+strings.Repeat("x", 8*1024*1024)+`"}`); err == nil {
		t.Fatal("oversized accepted")
	}
	path := filepath.Join(dir, "tool-windows", "calculator.json")
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0600 {
		t.Fatal(info.Mode())
	}
	bad := []byte(`{"version":200}`)
	if err = os.WriteFile(path, bad, 0600); err != nil {
		t.Fatal(err)
	}
	if err = s.SaveToolWindow("calculator", calc); err == nil {
		t.Fatal("corrupt overwritten")
	}
	after, _ := os.ReadFile(path)
	if string(after) != string(bad) {
		t.Fatal("file changed")
	}
	state = core.ToolWindowState{Version: 1, ID: "translate", Open: true, Width: 1000, Height: 700, X: 50, Y: 60, Positioned: true, Session: translation}
	if err = core.AtomicJSON(s.toolPath("translate"), state); err != nil {
		t.Fatal(err)
	}
	if err = s.CloseToolWindow("translate"); err != nil {
		t.Fatal(err)
	}
	state, err = s.ToolWindowState("translate")
	if err != nil || state.Open || state.Session != translation || state.Width != 1000 || state.X != 50 {
		t.Fatal(state, err)
	}
}
