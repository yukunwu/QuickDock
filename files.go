package main

import (
	"context"
	"errors"
	"os"
	"quickdock/internal/core"
	"quickdock/internal/platform"
	"strings"
	"time"
	"unicode/utf8"
)

// SearchFiles lists files in the home folder whose names contain query.
// Only paths from the latest search may be opened or revealed afterwards.
func (s *Service) SearchFiles(ctx context.Context, query string) ([]core.FileHit, error) {
	query = strings.TrimSpace(query)
	if utf8.RuneCountInString(query) < 2 {
		return []core.FileHit{}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	paths, err := platform.SearchFiles(ctx, query)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, errors.New("文件搜索超时，请输入更具体的名称")
		}
		return nil, err
	}
	home, _ := os.UserHomeDir()
	hits := core.RankFiles(paths, query, home, 30)
	s.mu.Lock()
	s.fileHits = map[string]bool{}
	for _, h := range hits {
		s.fileHits[h.Path] = true
	}
	s.mu.Unlock()
	return hits, nil
}
func (s *Service) foundFile(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.fileHits[path] {
		return errors.New("请重新搜索该文件")
	}
	return nil
}
func (s *Service) OpenFile(path string) error {
	if err := s.foundFile(path); err != nil {
		return err
	}
	if err := platform.OpenPath(path); err != nil {
		return err
	}
	s.Hide()
	return nil
}
func (s *Service) RevealFile(path string) error {
	if err := s.foundFile(path); err != nil {
		return err
	}
	if err := platform.RevealPath(path); err != nil {
		return err
	}
	s.Hide()
	return nil
}
