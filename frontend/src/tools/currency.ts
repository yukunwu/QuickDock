import { calculate } from "./calculator";
// Daily ECB reference rates relative to `base` (one unit of base = rates[code]).
export type Rates = {
  base: string;
  date: string;
  rates: Record<string, number>;
  fetchedAt: number;
  stale?: boolean;
  error?: string;
};
export const favoriteCurrencies = [
  "CNY",
  "USD",
  "EUR",
  "JPY",
  "HKD",
  "GBP",
  "KRW",
  "SGD",
  "AUD",
  "CAD",
  "CHF",
  "THB",
];
export const ratesURL = "https://api.frankfurter.dev/v1/latest";
export function parseRates(body: unknown, fetchedAt = Date.now()): Rates {
  const data = body as { base?: unknown; date?: unknown; rates?: unknown };
  if (
    !data ||
    typeof data.base !== "string" ||
    !/^[A-Z]{3}$/.test(data.base) ||
    typeof data.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !data.rates ||
    typeof data.rates !== "object"
  )
    throw Error("汇率数据格式异常");
  const rates: Record<string, number> = { [data.base]: 1 };
  for (const [code, value] of Object.entries(data.rates))
    if (
      /^[A-Z]{3}$/.test(code) &&
      typeof value === "number" &&
      value > 0 &&
      Number.isFinite(value)
    )
      rates[code] = value;
  if (Object.keys(rates).length < 2) throw Error("汇率数据格式异常");
  return { base: data.base, date: data.date, rates, fetchedAt };
}
export function rate(rates: Rates, from: string, to: string) {
  const a = rates.rates[from],
    b = rates.rates[to];
  if (!a || !b) throw Error("暂不支持该货币");
  return b / a;
}
// Amounts accept plain numbers with digit grouping, or a short calculation.
export function parseAmount(text: string) {
  const input = text.trim().replace(/[,，_\s](?=\d{3}\b)/g, "");
  if (!input) return null;
  const value = /^-?(?:\d+\.?\d*|\.\d+)$/.test(input)
    ? Number(input)
    : Number(calculate(input));
  if (!Number.isFinite(value)) throw Error("请输入有效金额");
  return value;
}
const noDecimals = new Set(["JPY", "KRW", "ISK", "IDR", "HUF"]);
export function formatMoney(value: number, code: string, language: string) {
  const digits = noDecimals.has(code) ? 0 : Math.abs(value) < 1 ? 4 : 2;
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: Math.min(digits, 2),
    maximumFractionDigits: digits,
  }).format(value);
}
// Plain digits for the clipboard: no grouping, same rounding as the display.
export function plainMoney(value: number, code: string) {
  const digits = noDecimals.has(code) ? 0 : Math.abs(value) < 1 ? 4 : 2;
  return String(Number(value.toFixed(digits)));
}
export function rateText(value: number) {
  return String(Number(value.toPrecision(value >= 1 ? 6 : 4)));
}
export function currencyName(code: string, language: string) {
  try {
    return (
      new Intl.DisplayNames([language], { type: "currency" }).of(code) || code
    );
  } catch {
    return code;
  }
}
