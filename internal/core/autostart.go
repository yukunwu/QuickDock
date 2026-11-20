package core

import "strings"

// AutostartFlag marks a process started by the login item, so it stays hidden.
const AutostartFlag = "--autostart"

// LoginItem reports the OS login-item state; the OS is the source of truth,
// so it is never stored in settings.json.
type LoginItem struct {
	Supported     bool `json:"supported"`
	Enabled       bool `json:"enabled"`
	NeedsApproval bool `json:"needsApproval"`
}

func LaunchedByAutostart(args []string) bool {
	for _, arg := range args {
		if arg == AutostartFlag {
			return true
		}
	}
	return false
}

// AutostartDesktopEntry builds an XDG autostart entry. Exec arguments follow
// the Desktop Entry quoting rules, so paths with spaces or quotes stay intact.
func AutostartDesktopEntry(executable string) string {
	quoted := `"` + strings.NewReplacer(`\`, `\\\\`, `"`, `\\"`, "`", "\\\\`", `$`, `\\$`, "%", "%%").Replace(executable) + `"`
	return "[Desktop Entry]\nType=Application\nName=QuickDock\nExec=" + quoted + " " + AutostartFlag + "\nTerminal=false\nNoDisplay=true\nX-GNOME-Autostart-enabled=true\n"
}
