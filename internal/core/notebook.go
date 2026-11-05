package core

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"math"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type Calculation struct {
	ID        string   `json:"id"`
	CreatedAt int64    `json:"createdAt"`
	Source    string   `json:"source"`
	Results   []string `json:"results"`
}
type CalculationFile struct {
	Version int           `json:"version"`
	Records []Calculation `json:"records"`
}

func ValidateCalculation(source string, results []string) error {
	if !utf8.ValidString(source) || len(source) > 80000 || utf8.RuneCountInString(source) > 20000 {
		return errors.New("稿纸最多20000字符")
	}
	lines := strings.Split(source, "\n")
	if len(lines) > 200 || len(results) != len(lines) {
		return errors.New("稿纸最多200行，结果须逐行对应")
	}
	count := 0
	for i, result := range results {
		line := strings.TrimSpace(lines[i])
		if line == "" || strings.HasPrefix(line, "#") {
			if result != "" {
				return errors.New("备注行不能有计算结果")
			}
			continue
		}
		n, err := strconv.ParseFloat(result, 64)
		if len(result) > 64 || err != nil || math.IsNaN(n) || math.IsInf(n, 0) {
			return errors.New("请修正所有算式后保存")
		}
		count++
	}
	if count == 0 {
		return errors.New("请至少输入一个有效算式")
	}
	return nil
}
func LoadCalculations(path string) (CalculationFile, error) {
	empty := CalculationFile{Version: 1, Records: []Calculation{}}
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return empty, nil
	}
	if err != nil {
		return empty, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 10*1024*1024+1))
	if err != nil {
		return empty, err
	}
	if len(data) > 10*1024*1024 {
		return empty, errors.New("计算历史文件过大，已保留原文件")
	}
	var state CalculationFile
	if json.Unmarshal(data, &state) != nil || state.Version != 1 || len(state.Records) > 100 {
		return empty, errors.New("计算历史损坏或版本不支持，已保留原文件，禁止覆盖")
	}
	seen := map[string]bool{}
	for _, r := range state.Records {
		if r.ID == "" || seen[r.ID] || r.CreatedAt <= 0 || ValidateCalculation(r.Source, r.Results) != nil {
			return empty, errors.New("计算历史内容无效，已保留原文件，禁止覆盖")
		}
		seen[r.ID] = true
	}
	if state.Records == nil {
		state.Records = []Calculation{}
	}
	return state, nil
}
func NewCalculation(source string, results []string) (Calculation, error) {
	if err := ValidateCalculation(source, results); err != nil {
		return Calculation{}, err
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return Calculation{}, err
	}
	return Calculation{ID: hex.EncodeToString(id[:]), CreatedAt: time.Now().UnixMilli(), Source: source, Results: append([]string{}, results...)}, nil
}

// Bound both count and encoded bytes so even heavily escaped notes remain
// below the load limit. Always retain the newest records first.
func BoundCalculations(records []Calculation) []Calculation {
	bytesUsed := 64
	end := 0
	for _, record := range records {
		encoded, _ := json.Marshal(record)
		if end == 100 || bytesUsed+len(encoded)+2 > 8*1024*1024 {
			break
		}
		bytesUsed += len(encoded) + 2
		end++
	}
	return records[:end]
}
