package core

import (
	"strings"
	"testing"
)

func TestAutostartDesktopEntryQuotesExec(t *testing.T) {
	entry := AutostartDesktopEntry(`/opt/Quick Dock/$bin/a"b\c%d`)
	want := `Exec="/opt/Quick Dock/\\$bin/a\\"b\\\\c%%d" --autostart`
	if !strings.Contains(entry, "\n"+want+"\n") || !strings.HasPrefix(entry, "[Desktop Entry]\nType=Application\n") {
		t.Fatalf("unexpected entry:\n%s", entry)
	}
	if !LaunchedByAutostart([]string{"--toggle", AutostartFlag}) || LaunchedByAutostart([]string{"--toggle"}) {
		t.Fatal("autostart flag detection")
	}
}
