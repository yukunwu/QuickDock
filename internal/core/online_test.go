package core

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestGoogleQueryEncoding(t *testing.T) {
	query := "你好 &x=1+# /?"
	raw, err := GoogleSearchURL(query)
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(raw)
	if u.Host != "www.google.com" || u.Path != "/search" || u.Query().Get("q") != query || len(u.Query()) != 1 {
		t.Fatal(raw)
	}
	if _, err = GoogleSearchURL("  "); err == nil {
		t.Fatal("empty accepted")
	}
}
func TestTranslationValidationAndParsing(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.Query().Get("q") != "Hi & 世界" {
			t.Fatal("query changed")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`[[["你好","Hi"],["世界","world"]],null,"en"]`))}, nil
	})}
	result, err := Translate(context.Background(), client, "Hi & 世界", "auto", "zh-CN")
	if err != nil || result.Text != "你好世界" || result.Detected != "en" {
		t.Fatalf("%+v %v", result, err)
	}
	if _, err = Translate(context.Background(), client, "x", "evil", "zh-CN"); err == nil || calls != 1 {
		t.Fatal("invalid language sent")
	}
	for _, raw := range []string{`null`, `{}`, `[[]]`, `[[[null]]]`, `[[[12]]]`} {
		if _, err = ParseTranslation([]byte(raw)); err == nil {
			t.Fatal("bad result accepted", raw)
		}
	}
}
func TestTranslationErrorsCancellationAndMyMemory(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 429, Body: io.NopCloser(strings.NewReader("quota"))}, nil
	})}
	if _, err := Translate(context.Background(), client, "hello", "en", "zh-CN"); err == nil || !strings.Contains(err.Error(), "Google") || !strings.Contains(err.Error(), "429") {
		t.Fatal("429 must identify provider and recovery", err)
	}
	client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) { <-r.Context().Done(); return nil, r.Context().Err() })
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Translate(ctx, client, "hello", "en", "zh-CN"); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "api.mymemory.translated.net" || r.URL.Query().Get("langpair") != "en|zh-CN" {
			t.Fatal(r.URL.Host)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"responseStatus":200,"quotaFinished":false,"responseData":{"translatedText":"A &amp; B"}}`))}, nil
	})
	result, err := TranslateMemory(context.Background(), client, "hello", "en", "zh-CN")
	if err != nil || result.Text != "A & B" {
		t.Fatal(result, err)
	}
	if _, err = TranslateMemory(context.Background(), client, strings.Repeat("中", 167), "zh-CN", "en"); err == nil {
		t.Fatal("byte limit ignored")
	}
}

func TestMemoryRejectsWrongScriptAndUsesOnlyExactLanguageCandidate(t *testing.T) {
	raw := []byte(`{"responseStatus":200,"responseData":{"translatedText":"你很笨"},"matches":[{"segment":"我爱你","translation":"你很笨","source":"zh-CN","target":"en-GB","match":1},{"segment":"我爱你","translation":"Here I Love You","source":"zh-CN","target":"en-GB","match":0.99},{"segment":"我爱你","translation":"wrong language","source":"ja","target":"en","match":1},{"segment":"我爱你","translation":"I Love You","source":"zh-CN","target":"en-GB","match":"1"}]}`)
	result, err := ParseMemoryTranslation(raw, "我爱你", "zh-CN", "en")
	if err != nil || result.Text != "I Love You" || result.ValidationVersion != 1 {
		t.Fatal(result, err)
	}
	for _, matches := range []string{`[]`, `[{"segment":"我爱你吗","translation":"Do you love me?","source":"zh-CN","target":"en","match":1}]`, `[{"segment":"我爱你","translation":"I Love You","source":"zh-CN","target":"en","match":0.99}]`} {
		raw = []byte(`{"responseStatus":200,"responseData":{"translatedText":"你很笨"},"matches":` + matches + `}`)
		if _, err = ParseMemoryTranslation(raw, "我爱你", "zh-CN", "en"); err == nil {
			t.Fatal("bad response accepted", string(raw))
		}
	}
	for _, value := range []string{"I love you", "OpenAI", "你好, Peter", "123"} {
		if !TranslationScriptValid(value, "en") {
			t.Fatal("valid text rejected", value)
		}
	}
	if TranslationScriptValid("你很笨", "en") {
		t.Fatal("wrong script accepted")
	}
	if _, err = ParseMemoryTranslation([]byte(`{"responseStatus":403,"responseData":{"translatedText":"quota"}}`), "x", "en", "zh-CN"); err == nil {
		t.Fatal("quota accepted")
	}
}

func TestMemoryFailureKindsRemainDistinct(t *testing.T) {
	for _, tc := range []struct{ raw, want string }{
		{`{"responseStatus":"200","responseData":{"translatedText":"Hello"},"matches":[{"translation":123}]}`, ""},
		{`{"responseStatus":200,"responseData":{"translatedText":""}}`, "未找到"},
		{`{"responseStatus":200,"quotaFinished":true,"responseData":{"translatedText":"limit"}}`, "额度"},
		{`{"responseStatus":403,"responseDetails":"MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY"}`, "额度"},
		{`{"responseStatus":403,"responseDetails":"INVALID LANGUAGE PAIR"}`, "服务状态 403"},
		{`{"responseStatus":200,"responseData":"invalid"}`, "格式异常"},
	} {
		result, err := ParseMemoryTranslation([]byte(tc.raw), "test", "en", "zh-CN")
		if tc.want == "" {
			if err != nil || result.Text != "Hello" {
				t.Fatal(result, err)
			}
			continue
		}
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Fatal(tc.want, err)
		}
	}
	raw, err := TranslationPageURL("你好 & + # ?", "auto", "en")
	u, _ := url.Parse(raw)
	if err != nil || u.Host != "translate.google.com" || u.Query().Get("text") != "你好 & + # ?" {
		t.Fatal(raw, err)
	}
}
