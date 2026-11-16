package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"quickdock/internal/core"
	"quickdock/internal/platform"
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

// ratesMaxAge bounds how often the daily ECB table is downloaded again.
const ratesMaxAge = 6 * time.Hour

// ExchangeRates returns cached rates while fresh, otherwise downloads them.
// When offline it falls back to the last saved table, marked stale.
func (s *Service) ExchangeRates(ctx context.Context, refresh bool) (core.Rates, error) {
	s.ratesMu.Lock()
	defer s.ratesMu.Unlock()
	path := filepath.Join(s.dir, "exchange-rates.json")
	var cached core.Rates
	if raw, err := os.ReadFile(path); err == nil {
		if parsed, err := core.ParseRates(raw, time.UnixMilli(0)); err == nil {
			cached = parsed
			var meta struct {
				FetchedAt int64 `json:"fetchedAt"`
			}
			_ = json.Unmarshal(raw, &meta)
			cached.FetchedAt = meta.FetchedAt
		}
	}
	if cached.Base != "" && !refresh && time.Since(time.UnixMilli(cached.FetchedAt)) < ratesMaxAge {
		return cached, nil
	}
	fetch := s.fetchRates
	if fetch == nil {
		fetch = func(ctx context.Context) (core.Rates, error) { return core.FetchRates(ctx, translationClient) }
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	fresh, err := fetch(ctx)
	if err != nil {
		if cached.Base == "" {
			return core.Rates{}, err
		}
		cached.Stale, cached.Error = true, err.Error()
		return cached, nil
	}
	if err = core.AtomicJSON(path, fresh); err != nil {
		fresh.Error = "汇率缓存写入失败：" + err.Error()
	}
	return fresh, nil
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
type CalculationSaved struct {
	ID      string             `json:"id"`
	Records []core.Calculation `json:"records"`
}

// RecordCalculation autosaves the sheet being edited under id; an empty or
// deleted id starts a new history record.
func (s *Service) RecordCalculation(id, source string, results []string) (CalculationSaved, error) {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	path := filepath.Join(s.dir, "calculations.json")
	state, err := core.LoadCalculations(path)
	if err != nil {
		return CalculationSaved{}, err
	}
	records, id, changed, err := core.UpsertCalculation(state.Records, id, source, results)
	if err != nil {
		return CalculationSaved{}, err
	}
	if changed {
		state.Records = records
		if err = core.AtomicJSON(path, state); err != nil {
			return CalculationSaved{}, err
		}
	}
	return CalculationSaved{ID: id, Records: records}, nil
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

func (s *Service) TranslationHistory() ([]core.TranslationRecord, error) {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	state, err := core.LoadTranslations(filepath.Join(s.dir, "translations.json"))
	return state.Records, err
}

// recordTranslation stores an observation from a Google page. A page load
// right after an explicit submit counts as new work, not a restore.
func (s *Service) recordTranslation(windowID, raw string) {
	var event struct {
		core.TranslationRecord
		Initial bool `json:"initial"`
	}
	if len(raw) > 200*1024 || json.Unmarshal([]byte(raw), &event) != nil {
		return
	}
	s.mu.Lock()
	if s.translationSubmits[windowID] {
		event.Initial = false
		delete(s.translationSubmits, windowID)
	}
	s.mu.Unlock()
	s.historyMu.Lock()
	path := filepath.Join(s.dir, "translations.json")
	state, err := core.LoadTranslations(path)
	changed := false
	if err == nil {
		state.Records, changed, err = core.MergeTranslation(state.Records, event.TranslationRecord, event.Initial, time.Now())
	}
	if err == nil && changed {
		err = core.AtomicJSON(path, state)
	}
	s.historyMu.Unlock()
	if err != nil {
		log.Printf("translation history: %v", err)
		return
	}
	if changed {
		s.notifyTranslationHistory()
	}
}
func (s *Service) notifyTranslationHistory() {
	script := `window.dispatchEvent(new Event("quickdock-translation-history"))`
	if s.window != nil {
		s.window.ExecJS(script)
	}
	s.toolMu.Lock()
	if t := s.toolWindows["translate"]; t != nil && t.window != nil {
		t.window.ExecJS(script)
	}
	s.toolMu.Unlock()
}
func (s *Service) DeleteTranslation(id string) ([]core.TranslationRecord, error) {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	path := filepath.Join(s.dir, "translations.json")
	state, err := core.LoadTranslations(path)
	if err != nil {
		return nil, err
	}
	next := []core.TranslationRecord{}
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
func (s *Service) ClearTranslations() error {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()
	path := filepath.Join(s.dir, "translations.json")
	if _, err := core.LoadTranslations(path); err != nil {
		return err
	}
	return core.AtomicJSON(path, core.TranslationFile{Version: 1, Records: []core.TranslationRecord{}})
}
func (s *Service) OpenTranslationPage(text, source, target string) error {
	targetURL, err := core.TranslationPageURL(text, source, target)
	if err != nil {
		return err
	}
	return application.InvokeSyncWithError(func() error { return platform.Open(targetURL, false) })
}
