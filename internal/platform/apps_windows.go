package platform

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"golang.org/x/sys/windows"
	"os"
	"os/exec"
	"path/filepath"
	"quickdock/internal/core"
	"strings"
	"unicode/utf16"
	"unsafe"
)

func powershell(script string, extraEnv ...string) ([]byte, error) {
	units := utf16.Encode([]rune(script))
	raw := make([]byte, len(units)*2)
	for i, u := range units {
		binary.LittleEndian.PutUint16(raw[i*2:], u)
	}
	executable := filepath.Join(os.Getenv("SystemRoot"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
	cmd := exec.Command(executable, "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", base64.StdEncoding.EncodeToString(raw))
	cmd.Env = append(os.Environ(), extraEnv...)
	cmd.SysProcAttr = &windows.SysProcAttr{HideWindow: true}
	return cmd.Output()
}
func ScanApplications() ([]core.AppEntry, error) {
	raw, err := powershell(`$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Add-Type -AssemblyName System.Drawing;$shell=New-Object -ComObject WScript.Shell;$roots=@([Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'),[Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'));$rows=@();foreach($root in $roots){if(!$root){continue};Get-ChildItem -LiteralPath $root -Filter *.lnk -Recurse -ErrorAction SilentlyContinue|ForEach-Object {try{$link=$shell.CreateShortcut($_.FullName);if(!$link.TargetPath -or [IO.Path]::GetExtension($link.TargetPath) -ne '.exe'){return};$icon='';try{$image=[Drawing.Icon]::ExtractAssociatedIcon($link.TargetPath);if($image){$bitmap=$image.ToBitmap();$stream=New-Object IO.MemoryStream;$bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png);$icon='data:image/png;base64,'+[Convert]::ToBase64String($stream.ToArray());$stream.Dispose();$bitmap.Dispose();$image.Dispose()}}catch{};$rows+=@{name=$_.BaseName;path=$_.FullName;bundleId=$link.TargetPath;icon=$icon}}catch{}}};try{$rows+=@(Get-StartApps|Where-Object {$_.AppID -like '*!*'}|ForEach-Object {@{name=$_.Name;path=('shell:AppsFolder\'+$_.AppID);bundleId=$_.AppID;icon=''}})}catch{};ConvertTo-Json -InputObject @($rows) -Depth 4 -Compress`)
	if err != nil {
		return []core.AppEntry{}, errors.New("Windows开始菜单索引失败，请确认系统PowerShell可用")
	}
	var rows []core.AppEntry
	if err = json.Unmarshal(raw, &rows); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	out := []core.AppEntry{}
	for _, row := range rows {
		key := strings.ToLower(row.BundleID)
		if seen[key] {
			continue
		}
		seen[key] = true
		row.ID = fmt.Sprintf("app-%x", sha256.Sum256([]byte(key)))
		out = append(out, row)
	}
	return out, nil
}

var shell32 = windows.NewLazySystemDLL("shell32.dll")

func LaunchApplication(path string) error {
	if !strings.HasPrefix(path, `shell:AppsFolder\`) {
		if _, err := os.Stat(path); err != nil {
			return errors.New("应用入口已移动或删除，请刷新索引")
		}
		if !strings.EqualFold(filepath.Ext(path), ".lnk") {
			return errors.New("无效的Windows应用入口")
		}
	}
	return shellOpen(path)
}
func shellOpen(target string) error {
	verb, _ := windows.UTF16PtrFromString("open")
	file, err := windows.UTF16PtrFromString(target)
	if err != nil {
		return err
	}
	result, _, _ := shell32.NewProc("ShellExecuteW").Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(file)), 0, 0, 1)
	if result <= 32 {
		return fmt.Errorf("Windows打开失败（%d）", result)
	}
	return nil
}
func Open(target string, isApp bool) error {
	if isApp {
		return LaunchApplication(target)
	}
	if err := core.ValidateURL(target); err != nil {
		return err
	}
	return shellOpen(target)
}
func SystemProxy(target string) (string, error) { return "", nil }
