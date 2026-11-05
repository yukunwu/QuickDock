package core

import (
	"bufio"
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// DesktopEntry holds launcher metadata; Exec remains in the desktop file and is
// handed to GIO, which implements field codes and D-Bus activation without a shell.
type DesktopEntry struct {
	Name, Icon, TryExec string
	Hidden              bool
}

func ParseDesktopEntry(raw, locale, desktop string) (DesktopEntry, error) {
	values := map[string]string{}
	active := false
	scanner := bufio.NewScanner(strings.NewReader(raw))
	scanner.Buffer(make([]byte, 4096), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "[") {
			active = line == "[Desktop Entry]"
			continue
		}
		if !active || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if ok {
			values[strings.TrimSpace(k)] = v
		}
	}
	if err := scanner.Err(); err != nil {
		return DesktopEntry{}, err
	}
	unescape := func(s string) string {
		return strings.NewReplacer(`\s`, " ", `\n`, "\n", `\t`, "\t", `\r`, "\r", `\\`, `\`).Replace(s)
	}
	name := values["Name"]
	locale = strings.Split(strings.Split(locale, ".")[0], "@")[0]
	if v := values["Name["+locale+"]"]; v != "" {
		name = v
	} else if v := values["Name["+strings.Split(locale, "_")[0]+"]"]; v != "" {
		name = v
	}
	member := func(list string) bool {
		for _, d := range strings.Split(desktop, ":") {
			for _, v := range strings.Split(list, ";") {
				if d != "" && v == d {
					return true
				}
			}
		}
		return false
	}
	hidden := values["Hidden"] == "true" || values["NoDisplay"] == "true" || (values["OnlyShowIn"] != "" && !member(values["OnlyShowIn"])) || (values["NotShowIn"] != "" && member(values["NotShowIn"]))
	if values["Type"] != "Application" || strings.TrimSpace(name) == "" || (values["Exec"] == "" && values["DBusActivatable"] != "true") {
		hidden = true
	}
	return DesktopEntry{Name: unescape(name), Icon: unescape(values["Icon"]), TryExec: unescape(values["TryExec"]), Hidden: hidden}, nil
}
func ScanDesktopFiles(roots []string, locale, desktop string, available func(string) bool, icon func(string) string) ([]AppEntry, error) {
	rows := []AppEntry{}
	seen := map[string]bool{}
	var problems []string
	for _, root := range roots {
		err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				return nil
			}
			if filepath.Ext(path) != ".desktop" {
				return nil
			}
			rel, _ := filepath.Rel(root, path)
			id := strings.ReplaceAll(rel, string(filepath.Separator), "-")
			// User entries (even Hidden=true) mask lower-priority system entries.
			if seen[id] {
				return nil
			}
			seen[id] = true
			raw, err := os.ReadFile(path)
			if err != nil {
				problems = append(problems, path)
				return nil
			}
			entry, err := ParseDesktopEntry(string(raw), locale, desktop)
			if err != nil || entry.Hidden || entry.TryExec != "" && !available(entry.TryExec) {
				return nil
			}
			rows = append(rows, AppEntry{ID: fmt.Sprintf("app-%x", sha256.Sum256([]byte(id))), Name: entry.Name, Path: path, BundleID: id, Icon: icon(entry.Icon)})
			return nil
		})
		if err != nil && !os.IsNotExist(err) {
			problems = append(problems, root)
		}
	}
	sort.Slice(rows, func(i, j int) bool { return strings.ToLower(rows[i].Name) < strings.ToLower(rows[j].Name) })
	if len(problems) > 0 {
		return rows, fmt.Errorf("部分桌面应用未能读取（%d项）", len(problems))
	}
	return rows, nil
}
