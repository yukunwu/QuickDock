import { it, expect } from "vitest";
import { calculateSheet } from "./notebook";
import {
  googleSearchURL,
  translationRequest,
  parseTranslation,
  translationError,
} from "./online";
it("translation errors name the provider and hide transport exception wrappers", () => {
  expect(
    translationError(
      "RuntimeError: 翻译服务请求过于频繁，请稍后重试",
      "google",
    ),
  ).toBe("Google 翻译已限流（429）。可切换到 MyMemory，或稍后再试。");
  expect(
    translationError(new Error("RuntimeError: 网络连接失败"), "google"),
  ).toBe("网络连接失败");
  expect(translationError(new Error("429"), "mymemory")).toContain("MyMemory");
  expect(
    translationError("RuntimeError: context deadline exceeded", "google"),
  ).toContain("超时");
});
it("notebook handles notes, percentages, previous results and safe errors", () => {
  expect(
    calculateSheet("# budget\n128+64\nans*15%\n\nans / 2").map((x) => x.result),
  ).toEqual(["", "192", "28.8", "", "14.4"]);
  const errors = calculateSheet("1+2\n1/0\nans*2\nalert(1)");
  expect(errors[1].error).toContain("不能除以零");
  expect(errors[2].error).toContain("没有可引用");
  expect(errors[3].error).not.toBe("");
  expect(calculateSheet("1\n".repeat(200))[0].error).toContain("最多200行");
});
it("online URLs preserve the exact query and validate provider limits", () => {
  const value = "你好 &x=1 + # ?";
  const url = new URL(googleSearchURL(value));
  expect(url.origin).toBe("https://www.google.com");
  expect(url.searchParams.get("q")).toBe(value);
  expect([...url.searchParams]).toHaveLength(1);
  expect(() =>
    translationRequest("中".repeat(167), "zh-CN", "en", "mymemory"),
  ).toThrow("500字节");
  expect(
    new URL(
      translationRequest(value, "zh-CN", "en", "mymemory"),
    ).searchParams.get("q"),
  ).toBe(value);
  expect(() => translationRequest("test", "auto", "en", "mymemory")).toThrow();
  expect(
    parseTranslation(
      [
        [
          ["你好", "hello"],
          ["世界", "world"],
        ],
        null,
        "en",
      ],
      "auto",
      "google",
    ),
  ).toEqual({ text: "你好世界", detected: "en" });
  expect(() => parseTranslation([[[]]], "auto", "google")).toThrow();
});
