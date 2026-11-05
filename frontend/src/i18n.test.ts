import { afterEach, expect, it } from "vitest";
import messages from "../../internal/i18n/messages.json";
import {
  errorText,
  languages,
  localizedStats,
  resolveLanguage,
  setLanguage,
  t,
} from "./i18n";
afterEach(() => setLanguage("zh-CN"));
it("resolves system languages, Chinese scripts and unsupported locales", () => {
  for (const locale of ["zh-Hant", "zh-HK", "zh-MO", "zh-TW"])
    expect(resolveLanguage("system", [locale])).toBe("zh-TW");
  expect(resolveLanguage("system", ["fr-FR", "ja-JP"])).toBe("ja");
  expect(resolveLanguage("es", ["en-US"])).toBe("es");
  expect(resolveLanguage("system", ["de-DE"])).toBe("en");
});
it("all languages preserve interpolation fields and contain all shared keys", () => {
  const keys = Object.keys(messages.en).sort();
  for (const dictionary of Object.values(messages)) {
    expect(Object.keys(dictionary).sort()).toEqual(keys);
    for (const [source, translated] of Object.entries(dictionary)) {
      expect(translated.trim()).not.toBe("");
      expect(translated.match(/\{\w+\}/g)?.sort() || []).toEqual(
        source.match(/\{\w+\}/g)?.sort() || [],
      );
    }
  }
  expect(languages).toHaveLength(5);
});
it("localizes engine errors and text statistics without translating user content", () => {
  setLanguage("en");
  expect(errorText(new Error("不能除以零"))).toBe("Cannot divide by zero");
  expect(localizedStats("3 个 Unicode 字符 · 1 行 · 7 字节 (UTF-8)")).toBe(
    "3 Unicode characters · 1 lines · 7 bytes (UTF-8)",
  );
  expect(t("user entered content")).toBe("user entered content");
  expect(t("启用{tool}", { tool: "JSON" })).toContain("JSON");
});
