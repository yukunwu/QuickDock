import { describe, it, expect } from "vitest";
import {
  calculate,
  jsonFormat,
  base64,
  urlComponent,
  hash,
  uuids,
  timestamp,
  convert,
  textTransform,
  textStats,
} from "./engines";
describe("calculator", () => {
  it.each([
    ["(128+64)*15%", "28.8"],
    ["0.1+0.2", "0.3"],
    ["-2*-(3+4)", "14"],
    ["1e3/4", "250"],
  ])("%s", (s, r) => expect(calculate(s)).toBe(r));
  it.each([
    "1/0",
    "alert(1)",
    "1 2",
    "(1+2",
    "2**3",
    "NaN",
    "",
    "1e309",
    "(".repeat(150) + "1" + ")".repeat(150),
  ])("reject %s", (s) => expect(() => calculate(s)).toThrow());
});
it("preserves large JSON integers and validates syntax", () => {
  expect(jsonFormat('{"n":9007199254740993123456789}', true)).toBe(
    '{"n":9007199254740993123456789}',
  );
  expect(() => jsonFormat("{oops}")).toThrow();
});
it("UTF8 Base64 roundtrip and strict invalid data", () => {
  const text = "中文 😀 café";
  expect(base64(base64(text), true)).toBe(text);
  for (const text of ["@@@@", "YQ=", "YR==", "/w=="])
    expect(() => base64(text, true)).toThrow();
});
it("URL component semantics", () => {
  expect(urlComponent("a+b", true)).toBe("a+b");
  expect(urlComponent(urlComponent("中文 /?&"), true)).toBe("中文 /?&");
  expect(() => urlComponent("%ZZ", true)).toThrow();
});
it("known hash vectors", () => {
  expect(hash("abc", "MD5")).toBe("900150983cd24fb0d6963f7d28e17f72");
  expect(hash("abc", "SHA1")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  expect(hash("abc", "SHA256")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  expect(hash("abc", "SHA512")).toBe(
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  );
});
it("UUID v4 batches", () => {
  const ids = uuids(100).split("\n");
  expect(new Set(ids).size).toBe(100);
  ids.forEach((id) =>
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
  );
  expect(() => uuids(1001)).toThrow();
});
it("timestamp unit, timezone and invalid calendar dates", () => {
  expect(timestamp("0", "encode", "s", "utc")).toBe("1970-01-01T00:00:00.000Z");
  expect(timestamp("1000", "encode", "ms", "utc")).toBe(
    "1970-01-01T00:00:01.000Z",
  );
  expect(timestamp("1970-01-01 00:00:01", "date", "s", "utc")).toBe("1");
  expect(timestamp("2024-02-29 00:00:00.123", "date", "ms", "utc")).toBe(
    "1709164800123",
  );
  expect(() => timestamp("2023-02-29 00:00:00", "date", "s", "utc")).toThrow();
  expect(() => timestamp("Infinity", "encode", "ms", "utc")).toThrow();
  const date = "2026-11-04 12:00:00";
  expect(timestamp(date, "date", "ms", "local")).toBe(
    String(new Date(2026, 10, 4, 12).getTime()),
  );
});
it("temperature, binary capacity, and all unit categories", () => {
  expect(convert("32", "温度", "华氏 °F", "摄氏 °C")).toBe("0");
  expect(convert("0", "温度", "摄氏 °C", "开尔文 K")).toBe("273.15");
  expect(() => convert("-1", "温度", "开尔文 K", "摄氏 °C")).toThrow();
  expect(convert("1", "数据容量", "KiB (1024)", "字节 B")).toBe("1024");
  expect(convert("1", "数据容量", "KB (1000)", "字节 B")).toBe("1000");
  expect(convert("1", "长度", "英寸 in", "厘米 cm")).toBe("2.54");
  expect(convert("1", "质量", "千克 kg", "克 g")).toBe("1000");
  expect(convert("1", "面积", "公顷 ha", "平方米 m²")).toBe("10000");
  expect(convert("1", "体积", "立方米 m³", "升 L")).toBe("1000");
  expect(convert("36", "速度", "千米/小时 km/h", "米/秒 m/s")).toBe("10");
});
it("Unicode text, CRLF lines, stable deduplication", () => {
  expect(textTransform(" 中文 \r\n\r\n😀\r\n中文", "trim")).toBe(
    "中文\n\n😀\n中文",
  );
  expect(textTransform("中文\n😀\n中文", "unique")).toBe("中文\n😀");
  expect(textStats("😀")).toBe("1 个 Unicode 字符 · 1 行 · 4 字节 (UTF-8)");
  expect(textTransform("a\n \nb", "empty")).toBe("a\nb");
});

it("large Base64 crosses chunk boundaries without changing bytes", () => {
  const text = "中文😀 café\r\n".repeat(10000);
  expect(base64(base64(text), true)).toBe(text);
});
it("streamed statistics preserve CRLF, surrogate and UTF8 counts", () => {
  for (const text of ["", "\r\n\r\n", "a\rb\nc\r\nd", "😀\ud800中\udc00é"]) {
    expect(textStats(text)).toBe(
      `${[...text].length} 个 Unicode 字符 · ${text ? text.split(/\r\n?|\n/).length : 0} 行 · ${new TextEncoder().encode(text).length} 字节 (UTF-8)`,
    );
  }
});
