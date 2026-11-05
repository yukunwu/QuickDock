package i18n
import "testing"
func TestLocalesAndSharedCatalog(t *testing.T) {
 for _, l := range []string{"zh-Hant", "zh_HK.UTF-8", "zh_MO"} { if Resolve(l)!="zh-TW" {t.Fatal(l)} }
 for _, l := range []string{"", "system", "zh-CN", "zh-TW", "en", "ja", "es"} {if !Valid(l) {t.Fatal(l)}}
 if Valid("fr") {t.Fatal("unsupported persisted language")}
 for _, l := range []string{"en", "ja", "zh-TW", "es"} {if T(l,"打开翻译窗口")=="打开翻译窗口" {t.Fatal(l)}}
 if T("zh-CN","翻译")!="翻译" {t.Fatal("source language")}
}
