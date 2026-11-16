import { expect, it } from "vitest";
import {
  dayShift,
  formatZoned,
  fromZoned,
  isoWithOffset,
  offsetLabel,
  parseTime,
  zoneOffset,
} from "./time";
import {
  currencyName,
  parseAmount,
  parseRates,
  plainMoney,
  rate,
} from "./currency";
import { formatUUIDs, uuidV7, uuids } from "./engines";
it("detects seconds, milliseconds, grouped digits and zoned dates", () => {
  expect(parseTime("1700000000", "UTC")).toEqual({
    ms: 1700000000000,
    kind: "seconds",
  });
  expect(parseTime("1700000000123", "UTC")?.kind).toBe("milliseconds");
  expect(parseTime("1,700,000,000", "UTC")?.ms).toBe(1700000000000);
  expect(parseTime("1970-01-01 08:00", "Asia/Shanghai")?.ms).toBe(0);
  expect(parseTime("2024-02-29", "UTC")?.ms).toBe(Date.UTC(2024, 1, 29));
  expect(parseTime("2026-11-16T09:30:00+08:00", "UTC")?.kind).toBe("iso");
  expect(parseTime("  ", "UTC")).toBeNull();
  expect(() => parseTime("2023-02-29 00:00", "UTC")).toThrow();
  expect(() => parseTime("hello", "UTC")).toThrow();
});
it("rejects wall times skipped by daylight saving", () => {
  expect(() =>
    fromZoned([2026, 3, 8, 2, 30, 0, 0], "America/New_York"),
  ).toThrow();
  expect(fromZoned([2026, 7, 1, 12, 0, 0, 0], "America/New_York")).toBe(
    Date.UTC(2026, 6, 1, 16),
  );
});
it("formats offsets, ISO strings and day differences across zones", () => {
  const ms = Date.UTC(2026, 10, 16, 20, 0, 0);
  expect(zoneOffset(ms, "Asia/Kolkata")).toBe(330);
  expect(offsetLabel(-210)).toBe("UTC-03:30");
  expect(formatZoned(ms, "Asia/Tokyo")).toBe("2026-11-17 05:00:00");
  expect(isoWithOffset(ms, "Asia/Tokyo")).toBe("2026-11-17T05:00:00+09:00");
  expect(isoWithOffset(ms, "UTC")).toBe("2026-11-16T20:00:00Z");
  expect(dayShift(ms, "Asia/Tokyo", "UTC")).toBe(1);
  expect(dayShift(ms, "UTC", "Asia/Tokyo")).toBe(-1);
});
it("parses rates, cross-converts and accepts calculated amounts", () => {
  const rates = parseRates({
    base: "EUR",
    date: "2026-11-13",
    rates: { USD: 1.1, CNY: 7.7, bad: 2, JPY: -1 },
  });
  expect(Object.keys(rates.rates).sort()).toEqual(["CNY", "EUR", "USD"]);
  expect(rate(rates, "USD", "CNY")).toBeCloseTo(7);
  expect(() => rate(rates, "USD", "JPY")).toThrow();
  expect(() => parseRates({ base: "EUR", rates: {} })).toThrow();
  expect(parseAmount("1,000")).toBe(1000);
  expect(parseAmount("12*3")).toBe(36);
  expect(parseAmount("")).toBeNull();
  expect(() => parseAmount("abc")).toThrow();
  expect(plainMoney(1234.5678, "USD")).toBe("1234.57");
  expect(plainMoney(1234.5678, "JPY")).toBe("1235");
  expect(currencyName("USD", "en")).toBe("US Dollar");
});
it("generates ordered v7 UUIDs and formats batches", () => {
  const ids = Array.from({ length: 50 }, () => uuidV7(1700000000000));
  expect(
    ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab]/.test(id)),
  ).toBe(true);
  expect([...ids].sort()).toEqual(ids);
  expect(ids[0].replace(/-/g, "").slice(0, 12)).toBe(
    (1700000000000).toString(16).padStart(12, "0"),
  );
  expect(uuids(3, "v7").split("\n")).toHaveLength(3);
  const sample = [
    "0190a6b2-1c3d-7e4f-8a9b-0c1d2e3f4a5b",
    "0190a6b2-1c3d-7e4f-8a9b-0c1d2e3f4a5c",
  ];
  expect(
    formatUUIDs(sample, { upper: true, hyphens: false, output: "lines" }),
  ).toBe("0190A6B21C3D7E4F8A9B0C1D2E3F4A5B\n0190A6B21C3D7E4F8A9B0C1D2E3F4A5C");
  expect(
    JSON.parse(
      formatUUIDs(sample, { upper: false, hyphens: true, output: "json" }),
    ),
  ).toEqual(sample);
  expect(
    formatUUIDs(sample, { upper: false, hyphens: true, output: "sql" }),
  ).toBe(`'${sample[0]}', '${sample[1]}'`);
});
