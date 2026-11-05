package core

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

var Languages = map[string]bool{"auto": true, "zh-CN": true, "zh-TW": true, "en": true, "ja": true, "ko": true, "fr": true, "de": true, "es": true, "ru": true, "pt": true, "it": true}

type Translation struct {
	Text              string `json:"text"`
	Detected          string `json:"detected"`
	ValidationVersion int    `json:"validationVersion,omitempty"`
}

func GoogleSearchURL(query string) (string, error) {
	if strings.TrimSpace(query) == "" || !utf8.ValidString(query) || utf8.RuneCountInString(query) > 5000 {
		return "", errors.New("搜索内容须为1～5000字符")
	}
	return "https://www.google.com/search?" + url.Values{"q": {query}}.Encode(), nil
}
func Translate(ctx context.Context, client *http.Client, text, source, target string) (Translation, error) {
	if strings.TrimSpace(text) == "" || !utf8.ValidString(text) || utf8.RuneCountInString(text) > 5000 {
		return Translation{}, errors.New("翻译内容须为1～5000字符")
	}
	if !Languages[source] || !Languages[target] || target == "auto" {
		return Translation{}, errors.New("请选择有效语言")
	}
	query := url.Values{"client": {"gtx"}, "sl": {source}, "tl": {target}, "dt": {"t"}, "q": {text}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://translate.googleapis.com/translate_a/single?"+query.Encode(), nil)
	if err != nil {
		return Translation{}, errors.New("无法创建翻译请求")
	}
	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return Translation{}, ctx.Err()
		}
		return Translation{}, errors.New("翻译请求失败，请检查网络或系统代理后重试")
	}
	defer resp.Body.Close()
	if resp.StatusCode == 429 {
		return Translation{}, errors.New("Google 翻译已限流（429）。可切换到 MyMemory，或稍后再试。")
	}
	if resp.StatusCode != 200 {
		return Translation{}, errors.New("Google翻译暂不可用，请稍后重试")
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024+1))
	if err != nil || len(raw) > 1024*1024 {
		return Translation{}, errors.New("翻译响应异常，请重试")
	}
	return ParseTranslation(raw)
}
func ParseTranslation(raw []byte) (Translation, error) {
	invalid := errors.New("翻译服务返回了无法识别的结果，请稍后重试")
	var parts []json.RawMessage
	if json.Unmarshal(raw, &parts) != nil || len(parts) < 1 {
		return Translation{}, invalid
	}
	var segments [][]json.RawMessage
	if json.Unmarshal(parts[0], &segments) != nil {
		return Translation{}, invalid
	}
	var text strings.Builder
	for _, seg := range segments {
		var fragment string
		if len(seg) == 0 || json.Unmarshal(seg[0], &fragment) != nil {
			return Translation{}, invalid
		}
		text.WriteString(fragment)
	}
	if text.Len() == 0 {
		return Translation{}, invalid
	}
	detected := ""
	if len(parts) > 2 {
		_ = json.Unmarshal(parts[2], &detected)
	}
	return Translation{Text: text.String(), Detected: detected}, nil
}

func TranslateMemory(ctx context.Context, client *http.Client, text, source, target string) (Translation, error) {
	if strings.TrimSpace(text) == "" || !utf8.ValidString(text) || len(text) > 500 {
		return Translation{}, errors.New("MyMemory每次支持最多500字节，请缩短文本或选择Google翻译")
	}
	if !Languages[source] || !Languages[target] || source == "auto" || target == "auto" || source == target {
		return Translation{}, errors.New("请选择不同的原文和目标语言")
	}
	query := url.Values{"q": {text}, "langpair": {source + "|" + target}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.mymemory.translated.net/get?"+query.Encode(), nil)
	if err != nil {
		return Translation{}, errors.New("无法创建翻译请求")
	}
	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return Translation{}, ctx.Err()
		}
		return Translation{}, errors.New("翻译请求失败，请检查网络后重试")
	}
	defer resp.Body.Close()
	if resp.StatusCode == 429 {
		return Translation{}, errors.New("MyMemory请求频率受限（HTTP 429），请稍后重试或切换翻译源")
	}
	if resp.StatusCode != 200 {
		return Translation{}, fmt.Errorf("MyMemory服务暂不可用（HTTP %d），请稍后重试或切换翻译源", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024+1))
	if err != nil || len(raw) > 1024*1024 {
		return Translation{}, errors.New("翻译响应异常")
	}
	return ParseMemoryTranslation(raw, text, source, target)
}

// Script checks only catch obvious language mismatches, not semantic errors.
func TranslationScriptValid(text, target string) bool {
	latin := target == "en" || target == "fr" || target == "de" || target == "es" || target == "pt" || target == "it"
	if !latin {
		return true
	}
	letters, latinLetters := 0, 0
	for _, r := range text {
		if unicode.IsLetter(r) {
			letters++
			if unicode.In(r, unicode.Latin) {
				latinLetters++
			}
		}
	}
	return letters == 0 || latinLetters > 0
}
func languageBase(value string) string { return strings.ToLower(strings.Split(value, "-")[0]) }
func ParseMemoryTranslation(raw []byte, text, source, target string) (Translation, error) {
	var result struct {
		ResponseData    json.RawMessage   `json:"responseData"`
		ResponseStatus  json.RawMessage   `json:"responseStatus"`
		ResponseDetails string            `json:"responseDetails"`
		QuotaFinished   json.RawMessage   `json:"quotaFinished"`
		Matches         []json.RawMessage `json:"matches"`
	}
	if json.Unmarshal(raw, &result) != nil {
		return Translation{}, errors.New("MyMemory响应格式异常，未取得译文；请稍后重试或切换翻译源")
	}
	status, _ := strconv.Atoi(strings.Trim(string(result.ResponseStatus), `"`))
	details := strings.ToUpper(result.ResponseDetails)
	quota := string(result.QuotaFinished) == "true" || string(result.QuotaFinished) == `"true"`
	if quota || status == 429 || strings.Contains(details, "USED ALL AVAILABLE FREE TRANSLATIONS") || strings.Contains(details, "DAILY LIMIT") || strings.Contains(details, "QUOTA EXCEEDED") {
		return Translation{}, errors.New("MyMemory免费翻译额度已用完或请求受限，请稍后重试或切换翻译源")
	}
	if status != 200 {
		return Translation{}, fmt.Errorf("MyMemory拒绝了翻译请求（服务状态 %d），请检查原文与语言选择或切换翻译源", status)
	}
	var data struct {
		TranslatedText string `json:"translatedText"`
	}
	if json.Unmarshal(result.ResponseData, &data) != nil {
		return Translation{}, errors.New("MyMemory响应格式异常，未取得译文；请稍后重试或切换翻译源")
	}
	if strings.TrimSpace(data.TranslatedText) == "" {
		return Translation{}, errors.New("MyMemory未找到这段文字的译文，请修改原文或切换翻译源")
	}
	translated := html.UnescapeString(data.TranslatedText)
	if !TranslationScriptValid(translated, target) {
		translated = ""
		for _, rawMatch := range result.Matches {
			var m struct {
				Segment     string          `json:"segment"`
				Translation string          `json:"translation"`
				Source      string          `json:"source"`
				Target      string          `json:"target"`
				Match       json.RawMessage `json:"match"`
			}
			if json.Unmarshal(rawMatch, &m) != nil {
				continue
			}
			score, _ := strconv.ParseFloat(strings.Trim(string(m.Match), `"`), 64)
			candidate := html.UnescapeString(m.Translation)
			if strings.TrimSpace(m.Segment) == strings.TrimSpace(text) && languageBase(m.Source) == languageBase(source) && languageBase(m.Target) == languageBase(target) && score == 1 && strings.TrimSpace(candidate) != "" && TranslationScriptValid(candidate, target) {
				translated = candidate
				break
			}
		}
		if translated == "" {
			return Translation{}, errors.New("MyMemory返回的译文与目标语言不符，已拦截；请切换翻译源")
		}
	}
	return Translation{Text: translated, Detected: source, ValidationVersion: 1}, nil
}

func TranslationPageURL(text, source, target string) (string, error) {
	if !utf8.ValidString(text) || utf8.RuneCountInString(text) > 5000 {
		return "", errors.New("翻译内容最多5000字符")
	}
	if !Languages[source] || !Languages[target] || target == "auto" {
		return "", errors.New("请选择有效语言")
	}
	return "https://translate.google.com/?" + url.Values{"sl": {source}, "tl": {target}, "text": {text}, "op": {"translate"}}.Encode(), nil
}
