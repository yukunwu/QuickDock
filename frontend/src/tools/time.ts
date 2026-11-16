// Time parsing and zone math for the time tool. Zones are IANA identifiers;
// "local" means the system zone so saved lists follow the user when they travel.
export type ParsedTime = {
  ms: number;
  kind: "now" | "seconds" | "milliseconds" | "date" | "iso";
};
export const localZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export const resolveZone = (zone: string) =>
  zone === "local" ? localZone() : zone;
export function validZone(zone: string) {
  if (zone === "local") return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
export function allZones(): string[] {
  const list = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf?.("timeZone");
  return list?.length ? list : commonZones.map(([id]) => id);
}
// Curated cities shown first in the picker; labels are i18n keys.
export const commonZones: [string, string][] = [
  ["UTC", "协调世界时 UTC"],
  ["Asia/Shanghai", "北京／上海"],
  ["Asia/Hong_Kong", "香港"],
  ["Asia/Taipei", "台北"],
  ["Asia/Tokyo", "东京"],
  ["Asia/Seoul", "首尔"],
  ["Asia/Singapore", "新加坡"],
  ["Asia/Kolkata", "新德里"],
  ["Asia/Dubai", "迪拜"],
  ["Europe/London", "伦敦"],
  ["Europe/Paris", "巴黎"],
  ["Europe/Berlin", "柏林"],
  ["Europe/Moscow", "莫斯科"],
  ["America/New_York", "纽约"],
  ["America/Chicago", "芝加哥"],
  ["America/Denver", "丹佛"],
  ["America/Los_Angeles", "洛杉矶"],
  ["America/Sao_Paulo", "圣保罗"],
  ["Australia/Sydney", "悉尼"],
  ["Pacific/Auckland", "奥克兰"],
];
export const defaultZones = [
  "local",
  "UTC",
  "America/New_York",
  "Europe/London",
  "Asia/Tokyo",
];
const formatters = new Map<string, Intl.DateTimeFormat>();
export function zonedParts(ms: number, zone: string) {
  const id = resolveZone(zone);
  let format = formatters.get(id);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(id, format);
  }
  const parts: Record<string, string> = {};
  for (const p of format.formatToParts(new Date(ms))) parts[p.type] = p.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday,
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday,
  };
}
// Minutes east of UTC at the given instant.
export function zoneOffset(ms: number, zone: string) {
  const p = zonedParts(ms, zone);
  const asUTC = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
}
export function offsetLabel(minutes: number) {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
const pad = (n: number, size = 2) => String(n).padStart(size, "0");
export function formatZoned(ms: number, zone: string, withMs = false) {
  const p = zonedParts(ms, zone);
  const millis = ((ms % 1000) + 1000) % 1000;
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${withMs ? "." + pad(millis, 3) : ""}`;
}
export function isoWithOffset(ms: number, zone: string) {
  const offset = zoneOffset(ms, zone);
  const millis = ((ms % 1000) + 1000) % 1000;
  return (
    formatZoned(ms, zone).replace(" ", "T") +
    (millis ? "." + pad(millis, 3) : "") +
    (offset === 0 ? "Z" : offsetLabel(offset).slice(3))
  );
}
// Calendar-day difference of a zone relative to another at the same instant.
export function dayShift(ms: number, zone: string, reference: string) {
  const a = zonedParts(ms, zone),
    b = zonedParts(ms, reference);
  return Math.round(
    (Date.UTC(a.year, a.month - 1, a.day) -
      Date.UTC(b.year, b.month - 1, b.day)) /
      86400000,
  );
}
// Wall-clock time in a zone → instant; rejects times skipped by DST.
export function fromZoned(
  fields: [number, number, number, number, number, number, number],
  zone: string,
) {
  const [y, m, d, h, min, s, millis] = fields;
  const wall = Date.UTC(y, m - 1, d, h, min, s, millis);
  let guess = wall - zoneOffset(wall, zone) * 60000;
  guess = wall - zoneOffset(guess, zone) * 60000;
  const p = zonedParts(guess, zone);
  if (
    [p.year, p.month, p.day, p.hour, p.minute, p.second].some(
      (v, i) => v !== [y, m, d, h, min, s][i],
    )
  )
    throw new Error("日期不存在或位于夏令时跳跃区间");
  return guess;
}
const datePattern =
  /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;
export function parseTime(text: string, zone: string): ParsedTime | null {
  let input = text.trim();
  if (!input) return null;
  // Pasted numbers may carry digit grouping: 1,700,000,000 or 1_700_000_000.
  if (/^-?\d{1,3}(?:[,，_ ]\d{3})+$/.test(input))
    input = input.replace(/[,，_ ]/g, "");
  if (/^(now|现在|今|现|今天)$/i.test(input))
    return { ms: Date.now(), kind: "now" };
  if (/^-?\d+(?:\.\d+)?$/.test(input)) {
    const digits = input.replace(/^-/, "").split(".")[0].length;
    // 12+ digits are milliseconds (seconds that large are past year 5138).
    const kind = digits >= 12 ? "milliseconds" : "seconds";
    const ms = Number(input) * (kind === "seconds" ? 1000 : 1);
    if (!Number.isSafeInteger(Math.round(ms)) || Math.abs(ms) > 8.64e15)
      throw new Error("时间戳超出日期范围");
    return { ms: Math.round(ms), kind };
  }
  const match = datePattern.exec(input);
  if (match) {
    const [y, m, d, h, min, s] = match.slice(1, 7).map((v) => Number(v ?? 0));
    const millis = Number((match[7] || "").padEnd(3, "0"));
    if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59 || s > 59)
      throw new Error("日期不存在或位于夏令时跳跃区间");
    return {
      ms: fromZoned([y, m, d, h, min, s, millis], resolveZone(zone)),
      kind: "date",
    };
  }
  if (/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:?\d{2})$/i.test(input)) {
    const ms = Date.parse(input);
    if (Number.isFinite(ms)) return { ms, kind: "iso" };
  }
  throw new Error("无法识别，请输入时间戳或 YYYY-MM-DD HH:mm:ss");
}
export function relativeTime(ms: number, now: number, language: string) {
  const diff = (ms - now) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  for (const [unit, size] of units)
    if (Math.abs(diff) >= size || unit === "second")
      return format.format(Math.round(diff / size), unit);
  return "";
}
