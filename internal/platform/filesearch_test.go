package platform

import (
	"os"
	"testing"
)

func TestHomeFilesDropsNoiseAndOtherUsers(t *testing.T) {
	sep := string(os.PathSeparator)
	home := sep + "home" + sep + "me"
	keep := homeFiles(home)
	for path, want := range map[string]bool{
		home + sep + "docs" + sep + "readme.md":               true,
		home + sep + ".cache" + sep + "readme.md":             false,
		home + sep + "app" + sep + "node_modules" + sep + "x": false,
		sep + "home" + sep + "other" + sep + "readme.md":      false,
		home + "2" + sep + "readme.md":                        false,
		home:                                                  false,
	} {
		if keep(path) != want {
			t.Errorf("%s: got %v", path, !want)
		}
	}
}
