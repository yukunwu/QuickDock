package core

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"regexp"
	"time"
)

// RatesURL serves the European Central Bank daily reference rates (EUR base).
const RatesURL = "https://api.frankfurter.dev/v1/latest"

type Rates struct {
	Base      string             `json:"base"`
	Date      string             `json:"date"`
	Rates     map[string]float64 `json:"rates"`
	FetchedAt int64              `json:"fetchedAt"`
	Stale     bool               `json:"stale,omitempty"`
	Error     string             `json:"error,omitempty"`
}

var currencyCode = regexp.MustCompile(`^[A-Z]{3}$`)
var rateDate = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// FetchRates downloads the rate table only; no user amounts leave the machine.
func FetchRates(ctx context.Context, client *http.Client) (Rates, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, RatesURL, nil)
	if err != nil {
		return Rates{}, errors.New("无法创建汇率请求")
	}
	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return Rates{}, ctx.Err()
		}
		return Rates{}, errors.New("汇率更新失败，请检查网络或系统代理后重试")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return Rates{}, errors.New("汇率服务暂不可用，请稍后重试")
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024+1))
	if err != nil || len(raw) > 256*1024 {
		return Rates{}, errors.New("汇率数据格式异常")
	}
	return ParseRates(raw, time.Now())
}

func ParseRates(raw []byte, fetched time.Time) (Rates, error) {
	invalid := errors.New("汇率数据格式异常")
	var data struct {
		Base  string             `json:"base"`
		Date  string             `json:"date"`
		Rates map[string]float64 `json:"rates"`
	}
	if json.Unmarshal(raw, &data) != nil || !currencyCode.MatchString(data.Base) || !rateDate.MatchString(data.Date) {
		return Rates{}, invalid
	}
	rates := map[string]float64{data.Base: 1}
	for code, value := range data.Rates {
		if currencyCode.MatchString(code) && value > 0 && !math.IsInf(value, 0) {
			rates[code] = value
		}
	}
	if len(rates) < 2 {
		return Rates{}, invalid
	}
	return Rates{Base: data.Base, Date: data.Date, Rates: rates, FetchedAt: fetched.UnixMilli()}, nil
}
