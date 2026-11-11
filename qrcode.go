package main

import (
	"encoding/base64"
	"errors"
	"os"
	"strings"
)

// SaveQRCode only writes to a path explicitly selected in the native save dialog.
// An empty selection is cancellation, not an error.
func (s *Service) SaveQRCode(format, data string) (bool, error) {
	if format != "png" && format != "svg" {
		return false, errors.New("不支持的图片格式")
	}
	if len(data) > 2*1024*1024 {
		return false, errors.New("二维码图片过大")
	}
	content := []byte(data)
	if format == "png" {
		var err error
		content, err = base64.StdEncoding.DecodeString(data)
		if err != nil || len(content) < 8 || string(content[:8]) != "\x89PNG\r\n\x1a\n" {
			return false, errors.New("无效的二维码图片")
		}
	} else if !strings.HasPrefix(data, `<svg xmlns="http://www.w3.org/2000/svg"`) {
		return false, errors.New("无效的二维码图片")
	}
	path, err := s.app.Dialog.SaveFile().SetFilename("QuickDock-QR."+format).AddFilter(strings.ToUpper(format), "*."+format).CanCreateDirectories(true).PromptForSingleSelection()
	if err != nil || path == "" {
		return false, err
	}
	if err = os.WriteFile(path, content, 0600); err != nil {
		return false, err
	}
	return true, nil
}
