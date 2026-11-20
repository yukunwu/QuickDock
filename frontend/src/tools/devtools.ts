import { parse, stringify } from "lossless-json";
// Pure engines for the regex, JWT, color, number base, diff and cron tools.
// Errors are Chinese message keys, localized by the UI with errorText().

export type RegexMatch = {
  index: number;
  text: string;
  groups: (string | undefined)[];
  named: Record<string, string | undefined>;
};
export type RegexResult = {
  matches: RegexMatch[];
  truncated: boolean;
  replaced?: string;
};
const MATCH_LIMIT = 1000;
export function regexTest(
  pattern: string,
  flags: string,
  text: string,
  replacement?: string,
): RegexResult {
  if (!/^[dgimsuvy]*$/.test(flags) || new Set(flags).size !== flags.length)
    throw new Error("正则标志只能是 d g i m s u v y，且不可重复");
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  } catch (e) {
    throw new Error(
      "正则表达式无效：" + (e instanceof Error ? e.message : String(e)),
    );
  }
  const matches: RegexMatch[] = [];
  let truncated = false;
  for (const m of text.matchAll(re)) {
    if (matches.length === MATCH_LIMIT) {
      truncated = true;
      break;
    }
    matches.push({
      index: m.index,
      text: m[0],
      groups: m.slice(1),
      named: { ...m.groups },
    });
    // Without g only the first match counts, as String.prototype.match.
    if (!flags.includes("g")) break;
  }
  const replaced =
    replacement === undefined
      ? undefined
      : text.replace(new RegExp(pattern, flags), replacement);
  return { matches, truncated, replaced };
}

export type JWTClaimTime = { name: string; ms: number };
export type JWTResult = {
  header: string;
  payload: string;
  signature: string;
  algorithm: string;
  times: JWTClaimTime[];
  expired: boolean;
  notYetValid: boolean;
};
function base64URL(part: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(part))
    throw new Error("JWT 段落不是有效的 Base64URL");
  const base = part.replace(/-/g, "+").replace(/_/g, "/");
  if (base.length % 4 === 1) throw new Error("JWT 段落不是有效的 Base64URL");
  const binary = atob(base + "=".repeat((4 - (base.length % 4)) % 4));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    );
  } catch {
    throw new Error("JWT 段落不是有效的 UTF-8 文本");
  }
}
// Decodes without verifying: the signature needs the issuer's key.
export function jwtDecode(token: string, now = Date.now()): JWTResult {
  const parts = token
    .trim()
    .replace(/^Bearer\s+/i, "")
    .split(".");
  if (parts.length === 5) throw new Error("暂不支持加密的 JWE 令牌");
  if (parts.length !== 3) throw new Error("JWT 应由点分隔的三段组成");
  const json = (part: string) => {
    try {
      const value = parse(base64URL(part));
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      return value as Record<string, unknown>;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("JWT")) throw e;
      throw new Error("JWT 头部或载荷不是 JSON 对象");
    }
  };
  const header = json(parts[0]);
  const payload = json(parts[1]);
  const times: JWTClaimTime[] = [];
  for (const name of ["iat", "nbf", "exp"]) {
    const value = Number(String(payload[name] ?? ""));
    if (payload[name] !== undefined && Number.isFinite(value))
      times.push({ name, ms: value * 1000 });
  }
  const at = (name: string) => times.find((c) => c.name === name)?.ms;
  return {
    header: stringify(header, undefined, 2)!,
    payload: stringify(payload, undefined, 2)!,
    signature: parts[2],
    algorithm: String(header.alg ?? ""),
    times,
    expired: at("exp") !== undefined && at("exp")! <= now,
    notYetValid: at("nbf") !== undefined && at("nbf")! > now,
  };
}

export type RGBA = { r: number; g: number; b: number; a: number };
const clamp = (v: number, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, v));
function channel(raw: string, scale = 255) {
  const value = raw.endsWith("%")
    ? (parseFloat(raw) / 100) * scale
    : parseFloat(raw);
  if (!Number.isFinite(value)) throw new Error("无法识别的颜色");
  return value;
}
function alpha(raw?: string) {
  return raw === undefined ? 1 : clamp(channel(raw, 1), 0, 1);
}
function hue(raw: string) {
  const m = /^(-?[\d.]+)(deg|turn|rad|grad)?$/.exec(raw);
  if (!m) throw new Error("无法识别的颜色");
  const value = parseFloat(m[1]);
  const deg =
    m[2] === "turn"
      ? value * 360
      : m[2] === "rad"
        ? (value * 180) / Math.PI
        : m[2] === "grad"
          ? value * 0.9
          : value;
  return ((deg % 360) + 360) % 360;
}
function hslToRGB(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
// Hex, rgb()/rgba() and hsl()/hsla() in comma or space syntax. Other CSS
// colors (names, oklch…) are resolved by the browser in the UI.
export function parseColor(input: string): RGBA {
  const text = input.trim().toLowerCase();
  const hex = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.exec(text);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = /^(rgba?|hsla?)\((.*)\)$/.exec(text);
  if (fn) {
    const [body, slash] = fn[2].split("/").map((s) => s.trim());
    const args = body.split(/[\s,]+/).filter(Boolean);
    const a = args.length === 4 ? args.pop() : slash;
    if (args.length !== 3) throw new Error("无法识别的颜色");
    if (fn[1].startsWith("rgb")) {
      const [r, g, b] = args.map((v) => clamp(channel(v)));
      return { r, g, b, a: alpha(a) };
    }
    const [r, g, b] = hslToRGB(
      hue(args[0]),
      clamp(channel(args[1], 1) / (args[1].endsWith("%") ? 1 : 100), 0, 1),
      clamp(channel(args[2], 1) / (args[2].endsWith("%") ? 1 : 100), 0, 1),
    );
    return { r, g, b, a: alpha(a) };
  }
  throw new Error("无法识别的颜色");
}
const round = (v: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};
const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export function luminance({ r, g, b }: RGBA) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
export function contrast(a: RGBA, b: RGBA) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export function formatColor(color: RGBA) {
  const r = Math.round(color.r),
    g = Math.round(color.g),
    b = Math.round(color.b);
  const a = round(color.a, 3);
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  const rh = r / 255,
    gh = g / 255,
    bh = b / 255;
  const max = Math.max(rh, gh, bh),
    min = Math.min(rh, gh, bh),
    d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d)
    h =
      max === rh
        ? 60 * (((gh - bh) / d) % 6)
        : max === gh
          ? 60 * ((bh - rh) / d + 2)
          : 60 * ((rh - gh) / d + 4);
  h = (h + 360) % 360;
  // sRGB → OKLab → OKLCH (Björn Ottosson's matrices).
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const lm = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const mm = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const sm = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  const L = 0.2104542553 * lm + 0.793617785 * mm - 0.0040720468 * sm;
  const A = 1.9779984951 * lm - 2.428592205 * mm + 0.4505937099 * sm;
  const B = 0.0259040371 * lm + 0.7827717662 * mm - 0.808675766 * sm;
  const C = Math.hypot(A, B);
  const H = C < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  const slash = a < 1 ? ` / ${a}` : "";
  return {
    hex:
      "#" + hex(r) + hex(g) + hex(b) + (a < 1 ? hex(Math.round(a * 255)) : ""),
    rgb: a < 1 ? `rgb(${r} ${g} ${b}${slash})` : `rgb(${r}, ${g}, ${b})`,
    hsl:
      a < 1
        ? `hsl(${round(h)} ${round(s * 100)}% ${round(l * 100)}%${slash})`
        : `hsl(${round(h)}, ${round(s * 100)}%, ${round(l * 100)}%)`,
    oklch: `oklch(${round(L * 100, 2)}% ${round(C, 4)} ${round(H, 2)}${slash})`,
  };
}

export type BaseRow = { base: number; value: string };
const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
// Arbitrary-size integers; 0x/0o/0b prefixes, _ and spaces are accepted.
// from = 0 detects the base from the prefix, defaulting to decimal.
export function convertBase(input: string, from: number): BaseRow[] {
  let text = input.trim().toLowerCase().replace(/[_\s]/g, "");
  const negative = text.startsWith("-");
  if (negative) text = text.slice(1);
  const prefix = /^0([xob])/.exec(text);
  let base = from;
  if (prefix) {
    const implied = { x: 16, o: 8, b: 2 }[prefix[1] as "x" | "o" | "b"];
    // In base 16, "0b1" is the hex number b1, not a binary prefix.
    if (!from || from === implied) {
      base = implied;
      text = text.slice(2);
    } else if (digits.indexOf(prefix[1]) >= from)
      throw new Error("数字前缀与所选进制不一致");
  }
  base ||= 10;
  if (
    !text ||
    [...text].some((c) => {
      const v = digits.indexOf(c);
      return v < 0 || v >= base;
    })
  )
    throw new Error("请输入所选进制的有效整数");
  let value = 0n;
  for (const c of text)
    value = value * BigInt(base) + BigInt(digits.indexOf(c));
  const sign = negative && value ? "-" : "";
  return [2, 8, 10, 16, 36].map((b) => ({
    base: b,
    value: sign + value.toString(b),
  }));
}
// "11111111" → "1111 1111"; groups count from the right.
export function groupDigits(value: string, size: number) {
  const sign = value.startsWith("-") ? "-" : "";
  const body = value.slice(sign.length);
  const head = body.length % size || size;
  const groups = [body.slice(0, head)];
  for (let i = head; i < body.length; i += size)
    groups.push(body.slice(i, i + size));
  return sign + groups.join(" ");
}

export type DiffRow = {
  type: "same" | "add" | "del";
  text: string;
  left?: number;
  right?: number;
};
const DIFF_LINES = 20000;
const DIFF_EDITS = 2000;
// Myers' O(ND) line diff after trimming the common prefix and suffix. Each
// step keeps only its live diagonals, so memory grows with edits², not size.
export function lineDiff(
  before: string,
  after: string,
  ignoreWhitespace = false,
): DiffRow[] {
  const a = before.split(/\r?\n/),
    b = after.split(/\r?\n/);
  if (a.length > DIFF_LINES || b.length > DIFF_LINES)
    throw new Error("文本过长，请缩小到 20000 行以内");
  const key = (s: string) =>
    ignoreWhitespace ? s.trim().replace(/\s+/g, " ") : s;
  const ka = a.map(key),
    kb = b.map(key);
  let start = 0;
  while (start < a.length && start < b.length && ka[start] === kb[start])
    start++;
  let endA = a.length,
    endB = b.length;
  while (endA > start && endB > start && ka[endA - 1] === kb[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start,
    m = endB - start;
  const offset = n + m + 1;
  const v = new Int32Array(2 * offset + 1);
  const trace: Int32Array[] = [];
  const down = (at: (k: number) => number, k: number, d: number) =>
    k === -d || (k !== d && at(k - 1) < at(k + 1));
  for (let d = 0, done = n === 0 && m === 0; !done; d++) {
    if (d > DIFF_EDITS) throw new Error("差异过多，请缩小对比范围");
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = down((i) => v[offset + i], k, d)
        ? v[offset + k + 1]
        : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && ka[start + x] === kb[start + y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        done = true;
        break;
      }
    }
  }
  const middle: DiffRow[] = [];
  const keep = (x: number, y: number) =>
    middle.push({
      type: "same",
      text: b[start + y],
      left: start + x + 1,
      right: start + y + 1,
    });
  let x = n,
    y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const saved = trace[d];
    const at = (k: number) => saved[k + d + 1];
    const k = x - y;
    const insert = down(at, k, d);
    const pk = insert ? k + 1 : k - 1;
    const px = at(pk),
      py = px - pk;
    while (x > px && y > py && x > 0 && y > 0) keep(--x, --y);
    if (d === 0) break;
    if (insert) {
      y--;
      middle.push({ type: "add", text: b[start + y], right: start + y + 1 });
    } else {
      x--;
      middle.push({ type: "del", text: a[start + x], left: start + x + 1 });
    }
  }
  middle.reverse();
  const same = (from: number, to: number, shift: number): DiffRow[] =>
    b.slice(from, to).map((text, i) => ({
      type: "same",
      text,
      left: from + i + 1 + shift,
      right: from + i + 1,
    }));
  return [
    ...same(0, start, 0),
    ...middle,
    ...same(endB, b.length, endA - endB),
  ];
}

export type CronField = {
  name: "minute" | "hour" | "day" | "month" | "weekday";
  values: number[];
  any: boolean;
};
const cronFields: [CronField["name"], number, number, string, string[]?][] = [
  ["minute", 0, 59, "Cron 分钟段无效"],
  ["hour", 0, 23, "Cron 小时段无效"],
  ["day", 1, 31, "Cron 日期段无效"],
  [
    "month",
    1,
    12,
    "Cron 月份段无效",
    "jan feb mar apr may jun jul aug sep oct nov dec".split(" "),
  ],
  [
    "weekday",
    0,
    7,
    "Cron 星期段无效",
    "sun mon tue wed thu fri sat".split(" "),
  ],
];
const cronMacros: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};
// Standard five-field cron (Vixie semantics): names, lists, ranges, steps.
export function parseCron(expression: string): CronField[] {
  const text = expression.trim().toLowerCase();
  const parts = (cronMacros[text] || text).split(/\s+/);
  if (parts.length !== 5)
    throw new Error("Cron 表达式需要 5 段：分 时 日 月 周");
  return parts.map((part, i) => {
    const [name, lo, hi, error, names] = cronFields[i];
    const fail = () => {
      throw new Error(error);
    };
    const number = (raw: string) => {
      const named = names?.indexOf(raw) ?? -1;
      if (named < 0 && !/^\d+$/.test(raw)) fail();
      const value = named >= 0 ? named + lo : Number(raw);
      if (value < lo || value > hi) fail();
      return value;
    };
    const values = new Set<number>();
    for (const item of part.split(",")) {
      const [range, stepRaw, extra] = item.split("/");
      if (
        extra !== undefined ||
        (stepRaw !== undefined && !/^\d+$/.test(stepRaw))
      )
        fail();
      const step = stepRaw === undefined ? 1 : Number(stepRaw);
      if (step < 1) fail();
      let from = lo,
        to = hi;
      if (range !== "*") {
        const [first, last, more] = range.split("-");
        if (more !== undefined) fail();
        from = number(first);
        // "5/15" means from 5 to the end, stepping by 15.
        to =
          last === undefined
            ? stepRaw === undefined
              ? from
              : hi
            : number(last);
        if (from > to) fail();
      }
      for (let n = from; n <= to; n += step)
        values.add(name === "weekday" && n === 7 ? 0 : n);
    }
    // Vixie cron treats a day field starting with * as unrestricted.
    return {
      name,
      values: [...values].sort((x, y) => x - y),
      any: part.startsWith("*"),
    };
  });
}
// Next run times, local or UTC. Jumps by month/day/hour instead of scanning
// every minute, and gives up after five years (e.g. 30 February).
export function cronRuns(
  fields: CronField[],
  count: number,
  from: number,
  utc: boolean,
): number[] {
  const [minute, hour, day, month, weekday] = fields.map(
    (f) => new Set(f.values),
  );
  const either = !fields[2].any && !fields[4].any;
  const d = new Date(from);
  const at = utc
    ? {
        month: () => d.getUTCMonth(),
        date: () => d.getUTCDate(),
        weekday: () => d.getUTCDay(),
        hours: () => d.getUTCHours(),
        minutes: () => d.getUTCMinutes(),
        nextMonth: () => d.setUTCMonth(d.getUTCMonth() + 1, 1),
        nextDate: () => d.setUTCDate(d.getUTCDate() + 1),
        midnight: () => d.setUTCHours(0, 0, 0, 0),
        nextHour: () => d.setUTCHours(d.getUTCHours() + 1, 0, 0, 0),
        nextMinute: () => d.setUTCMinutes(d.getUTCMinutes() + 1, 0, 0),
      }
    : {
        month: () => d.getMonth(),
        date: () => d.getDate(),
        weekday: () => d.getDay(),
        hours: () => d.getHours(),
        minutes: () => d.getMinutes(),
        nextMonth: () => d.setMonth(d.getMonth() + 1, 1),
        nextDate: () => d.setDate(d.getDate() + 1),
        midnight: () => d.setHours(0, 0, 0, 0),
        nextHour: () => d.setHours(d.getHours() + 1, 0, 0, 0),
        nextMinute: () => d.setMinutes(d.getMinutes() + 1, 0, 0),
      };
  at.nextMinute();
  const limit = from + 5 * 366 * 86400000;
  const runs: number[] = [];
  while (runs.length < count && d.getTime() <= limit) {
    const dom = day.has(at.date()),
      dow = weekday.has(at.weekday());
    if (!month.has(at.month() + 1)) {
      at.nextMonth();
      at.midnight();
    } else if (either ? !(dom || dow) : !(dom && dow)) {
      at.nextDate();
      at.midnight();
    } else if (!hour.has(at.hours())) at.nextHour();
    else if (!minute.has(at.minutes())) at.nextMinute();
    else {
      runs.push(d.getTime());
      at.nextMinute();
    }
  }
  return runs;
}
