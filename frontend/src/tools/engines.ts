import { parse, stringify } from "lossless-json";
import { md5 } from "js-md5";
import { sha1 } from "js-sha1";
import { sha256 } from "js-sha256";
import { sha512 } from "js-sha512";
export { calculate } from "./calculator";
export function jsonFormat(text: string, compact = false) {
  return stringify(parse(text), undefined, compact ? undefined : 2)!;
}
export function base64(text: string, decode = false) {
  if (!decode) {
    const bytes = new TextEncoder().encode(text);
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 32768)
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
    return btoa(chunks.join(""));
  }
  const clean = text.replace(/\s/g, "");
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      clean,
    )
  )
    throw new Error("无效 Base64：请检查字符与 = 填充");
  const binary = atob(clean);
  if (btoa(binary) !== clean) throw new Error("无效 Base64 填充位");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    );
  } catch {
    throw new Error("解码内容不是有效 UTF-8 文本");
  }
}
export function urlComponent(text: string, decode = false) {
  try {
    return decode ? decodeURIComponent(text) : encodeURIComponent(text);
  } catch {
    throw new Error("无效 URL 组件编码或 Unicode 文本");
  }
}
export function hash(text: string, algorithm: string) {
  const fn = { MD5: md5, SHA1: sha1, SHA256: sha256, SHA512: sha512 }[
    algorithm
  ];
  if (!fn) throw new Error("未知哈希算法");
  return fn(text);
}
export function uuids(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 1000)
    throw new Error("数量必须为 1–1000 的整数");
  return Array.from({ length: count }, () => crypto.randomUUID()).join("\n");
}
export function timestamp(
  text: string,
  mode: string,
  unit: string,
  zone: string,
) {
  let date: Date;
  if (mode === "date") {
    const input = text.trim();
    if (
      !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(input)
    )
      throw new Error("请输入 YYYY-MM-DD HH:mm:ss（不含时区，使用所选时区）");
    const [y, m, d, h, min, s = 0] = input.split(/[-T :.]/).map(Number);
    const ms = Number((input.split(".")[1] || "").padEnd(3, "0"));
    date =
      zone === "utc"
        ? new Date(Date.UTC(y, m - 1, d, h, min, s, ms))
        : new Date(y, m - 1, d, h, min, s, ms);
    const parts =
      zone === "utc"
        ? [
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
          ]
        : [
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
          ];
    if (parts.some((v, i) => v !== [y, m, d, h, min, s][i]))
      throw new Error("日期不存在或位于夏令时跳跃区间");
    return String(unit === "s" ? date.getTime() / 1000 : date.getTime());
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(text.trim()))
    throw new Error("请输入有效时间戳");
  const value = Number(text) * (unit === "s" ? 1000 : 1);
  if (!Number.isSafeInteger(value))
    throw new Error("时间戳须精确至毫秒且在安全整数范围内");
  date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("时间戳超出日期范围");
  return zone === "utc"
    ? date.toISOString()
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${date.toTimeString().slice(0, 8)}.${String(date.getMilliseconds()).padStart(3, "0")} (UTC${date.getTimezoneOffset() <= 0 ? "+" : "-"}${String(Math.floor(Math.abs(date.getTimezoneOffset()) / 60)).padStart(2, "0")}:${String(Math.abs(date.getTimezoneOffset()) % 60).padStart(2, "0")})`;
}
export const units: Record<string, Record<string, number>> = {
  长度: {
    "米 m": 1,
    "千米 km": 1000,
    "厘米 cm": 0.01,
    "毫米 mm": 0.001,
    "英寸 in": 0.0254,
    "英尺 ft": 0.3048,
    "英里 mi": 1609.344,
  },
  质量: {
    "千克 kg": 1,
    "克 g": 0.001,
    "毫克 mg": 0.000001,
    "吨 t": 1000,
    "磅 lb": 0.45359237,
    "盎司 oz": 0.028349523125,
  },
  温度: { "摄氏 °C": 1, "华氏 °F": 1, "开尔文 K": 1 },
  面积: {
    "平方米 m²": 1,
    "平方千米 km²": 1e6,
    "公顷 ha": 1e4,
    "平方厘米 cm²": 0.0001,
    "平方英尺 ft²": 0.09290304,
    "英亩 acre": 4046.8564224,
  },
  体积: {
    "升 L": 1,
    "毫升 mL": 0.001,
    "立方米 m³": 1000,
    "美制加仑 gal": 3.785411784,
    "英制加仑 gal": 4.54609,
  },
  速度: {
    "米/秒 m/s": 1,
    "千米/小时 km/h": 1 / 3.6,
    "英里/小时 mph": 0.44704,
    "节 kn": 1852 / 3600,
  },
  数据容量: {
    "字节 B": 1,
    "位 bit": 1 / 8,
    "KB (1000)": 1e3,
    "MB (1000²)": 1e6,
    "GB (1000³)": 1e9,
    "TB (1000⁴)": 1e12,
    "KiB (1024)": 1024,
    "MiB (1024²)": 1024 ** 2,
    "GiB (1024³)": 1024 ** 3,
    "TiB (1024⁴)": 1024 ** 4,
  },
};
export function convert(text: string, group: string, from: string, to: string) {
  if (!text.trim() || !Number.isFinite(Number(text)))
    throw new Error("请输入有效数值");
  const n = Number(text),
    table = units[group];
  if (!table || !(from in table) || !(to in table))
    throw new Error("请选择有效单位");
  let result: number;
  if (group === "温度") {
    const c =
      from === "摄氏 °C"
        ? n
        : from === "华氏 °F"
          ? ((n - 32) * 5) / 9
          : n - 273.15;
    if (c < -273.15 - 1e-10) throw new Error("温度不能低于绝对零度");
    result =
      to === "摄氏 °C" ? c : to === "华氏 °F" ? (c * 9) / 5 + 32 : c + 273.15;
  } else result = (n * table[from]) / table[to];
  if (!Number.isFinite(result)) throw new Error("结果超出数值范围");
  return String(Number(result.toPrecision(14)));
}
export function textTransform(text: string, mode: string) {
  if (mode === "upper") return text.toLocaleUpperCase();
  if (mode === "lower") return text.toLocaleLowerCase();
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  switch (mode) {
    case "trim":
      return lines.map((l) => l.trim()).join("\n");
    case "empty":
      return lines.filter((l) => l.trim()).join("\n");
    case "unique":
      return [...new Set(lines)].join("\n");
    case "sort":
      return lines
        .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }))
        .join("\n");
    default:
      return text;
  }
}
export function textStats(text: string) {
  let characters = 0,
    bytes = 0,
    lines = text ? 1 : 0,
    previous = "";
  for (const character of text) {
    characters++;
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (character === "\r" || (character === "\n" && previous !== "\r"))
      lines++;
    previous = character;
  }
  return `${characters} 个 Unicode 字符 · ${lines} 行 · ${bytes} 字节 (UTF-8)`;
}
