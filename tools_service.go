package main

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"path/filepath"
	"quickdock/internal/core"
	"quickdock/internal/platform"
	"slices"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

var translationClient = func() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxConnsPerHost = 2
	transport.MaxIdleConnsPerHost = 1
	transport.IdleConnTimeout = 30 * time.Second
	transport.Proxy = func(r *http.Request) (*url.URL, error) {
		proxy, err := http.ProxyFromEnvironment(r)
		if err != nil || proxy != nil {
			return proxy, err
		}
		raw, err := platform.SystemProxy(r.URL.String())
		if err != nil || raw == "" {
			return nil, err
		}
		return url.Parse(raw)
	}
	return &http.Client{Transport: transport, Timeout: 20 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
}()

func (s *Service) Translate(ctx context.Context, text, source, target, provider string) (core.Translation, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if provider == "mymemory" {
		return core.TranslateMemory(ctx, translationClient, text, source, target)
	}
	if provider != "google" {
		return core.Translation{}, errors.New("未知翻译源")
	}
	return core.Translate(ctx, translationClient, text, source, target)
}
func (s *Service) OpenGoogleSearch(query string) error {
	target, err := core.GoogleSearchURL(query)
	if err != nil {
		return err
	}
	if err = application.InvokeSyncWithError(func() error { return platform.Open(target, false) }); err != nil {
		return err
	}
	s.Hide()
	return nil
}
func (s *Service) Calculations() ([]core.Calculation, error) {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	state, err := core.LoadCalculations(filepath.Join(s.dir, "calculations.json"))
	return state.Records, err
}
func (s *Service) SaveCalculation(source string, results []string) ([]core.Calculation, error) {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	record, err := core.NewCalculation(source, results)
	if err != nil {
		return nil, err
	}
	path := filepath.Join(s.dir, "calculations.json")
	state, err := core.LoadCalculations(path)
	if err != nil {
		return nil, err
	}
	if len(state.Records) > 0 && state.Records[0].Source == source && slices.Equal(state.Records[0].Results, results) {
		return state.Records, nil
	}
	state.Records = append([]core.Calculation{record}, state.Records...)
	state.Records = core.BoundCalculations(state.Records)
	if err = core.AtomicJSON(path, state); err != nil {
		return nil, err
	}
	return state.Records, nil
}
func (s *Service) DeleteCalculation(id string) ([]core.Calculation, error) {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	path := filepath.Join(s.dir, "calculations.json")
	state, err := core.LoadCalculations(path)
	if err != nil {
		return nil, err
	}
	next := []core.Calculation{}
	for _, r := range state.Records {
		if r.ID != id {
			next = append(next, r)
		}
	}
	state.Records = next
	if err = core.AtomicJSON(path, state); err != nil {
		return nil, err
	}
	return next, nil
}
func (s *Service) ClearCalculations() error {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	path := filepath.Join(s.dir, "calculations.json")
	if _, err := core.LoadCalculations(path); err != nil {
		return err
	}
	return core.AtomicJSON(path, core.CalculationFile{Version: 1, Records: []core.Calculation{}})
}

func (s *Service) OpenTranslationPage(text, source, target string) error {
	targetURL, err := core.TranslationPageURL(text, source, target)
	if err != nil {
		return err
	}
	return application.InvokeSyncWithError(func() error { return platform.Open(targetURL, false) })
}
