import { t } from "./i18n";
import { calculate } from "./tools/calculator";
import { pinyin } from "pinyin-pro";
import { applicationAliases } from "./appAliases";
import {
  tools,
  fallbackIcons,
  genericAppIcon,
  type Snapshot,
  type SearchResult,
} from "./catalog";
import {
  Globe,
  Equal,
  Search,
  Languages,
  Clock3,
  NotebookPen,
} from "lucide-react";
import {
  formatZoned,
  localZone,
  offsetLabel,
  parseTime,
  zoneOffset,
} from "./tools/time";
type SearchTerms = {
  literal: string;
  compact: string;
  pinyin: string;
  initials: string;
  words: string;
  wordInitials: string;
};
const normalized = new Map<string, SearchTerms>();
function fold(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "");
}
function compact(value: string) {
  return fold(value).replace(/[\s\p{P}\p{S}]+/gu, "");
}
function searchable(name: string): SearchTerms {
  let value = normalized.get(name);
  if (!value) {
    if (normalized.size > 5000) normalized.clear();
    const words =
      fold(name.replace(/([a-z0-9])([A-Z])/g, "$1 $2")).match(
        /[\p{L}\p{N}]+/gu,
      ) || [];
    value = {
      literal: fold(name),
      compact: compact(name),
      pinyin: compact(
        pinyin(name, { toneType: "none", type: "array" }).join(""),
      ),
      initials: compact(
        pinyin(name, {
          pattern: "first",
          toneType: "none",
          type: "array",
        }).join(""),
      ),
      words: words.join(" "),
      wordInitials: words.map((word) => word[0]).join(""),
    };
    normalized.set(name, value);
  }
  return value;
}
function nameScore(name: string, q: string, joined: string, alias = false) {
  const value = searchable(name);
  const acronym =
    joined && (value.initials === joined || value.wordInitials === joined);
  const parts = q.split(/\s+/).filter(Boolean);
  return Math.max(
    value.literal === q ? (alias ? 90 : 100) : 0,
    value.literal.startsWith(q) ? (alias ? 75 : 80) : 0,
    value.literal.includes(q) ? (alias ? 55 : 60) : 0,
    joined && value.compact === joined ? (alias ? 88 : 95) : 0,
    joined && value.compact.startsWith(joined) ? (alias ? 72 : 78) : 0,
    joined && value.compact.includes(joined) ? (alias ? 52 : 58) : 0,
    joined && value.pinyin === joined ? (alias ? 65 : 70) : 0,
    joined && value.pinyin.startsWith(joined) ? (alias ? 48 : 50) : 0,
    joined && value.pinyin.includes(joined) ? (alias ? 38 : 40) : 0,
    acronym ? (alias ? 63 : 65) : 0,
    joined &&
      (value.initials.startsWith(joined) ||
        value.wordInitials.startsWith(joined))
      ? alias
        ? 33
        : 35
      : 0,
    parts.length > 1 &&
      parts.every((part) =>
        value.words.split(" ").some((word) => word.startsWith(part)),
      )
      ? alias
        ? 46
        : 48
      : 0,
  );
}
export type Intent = "app" | "calculation" | "time" | "translation";
// A date with a 4-digit year, a plausible Unix timestamp (1973–2286 in
// seconds, or milliseconds), or "now". 11-digit phone numbers never match.
const timeLike =
  /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?|\d{9,10}(?:\.\d{1,3})?|\d{12,13}|now|现在)$/i;
const cjk =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
// Sentences rather than names: several words, sentence punctuation, or a
// longer run of CJK text.
export function looksLikeText(query: string) {
  const text = query.trim();
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const punctuated = /[.,!?;:"'，。！？；：、「」“”]/.test(text);
  const cjkCount = text.match(cjk)?.length || 0;
  if (cjkCount) return cjkCount >= 6 || (cjkCount >= 2 && punctuated);
  return words.length >= 3 || (words.length >= 2 && punctuated);
}
export function detectIntent(query: string, bestNameScore: number): Intent {
  const text = query.trim();
  if (!text) return "app";
  // A strong name match wins unless the text is unmistakably data.
  if (
    timeLike.test(text) &&
    !(bestNameScore >= 60 && /^(now|现在)$/i.test(text))
  )
    return "time";
  if (/[+*/%()−×÷^-]/.test(text) && /\d/.test(text) && !/\p{L}{2,}/u.test(text))
    return "calculation";
  if (bestNameScore < 60 && looksLikeText(text)) return "translation";
  return "app";
}
export function searchEntries(query: string, data: Snapshot): SearchResult[] {
  const q = fold(query.trim());
  const joined = compact(query);
  const favorites = [
    "com.apple.finder",
    "com.apple.Safari",
    "com.google.Chrome",
    "com.microsoft.edgemac",
    "com.microsoft.VSCode",
    "com.apple.Terminal",
    "com.apple.Notes",
    "com.apple.systempreferences",
  ];
  const apps = [...data.apps].sort(
    (a, b) =>
      (favorites.includes(a.bundleId) ? favorites.indexOf(a.bundleId) : 100) -
      (favorites.includes(b.bundleId) ? favorites.indexOf(b.bundleId) : 100),
  );
  const entries: SearchResult[] = [
    ...apps.map((a) => ({
      id: a.id,
      title: a.name,
      subtitle: t("应用程序"),
      kind: "app" as const,
      icon: fallbackIcons[a.name] || genericAppIcon,
      color:
        a.name === "Safari"
          ? "blue"
          : a.name === "Terminal"
            ? "neutral"
            : "cyan",
      image: a.icon,
    })),
    ...tools
      .filter((t) => !data.settings.disabledTools.includes(t.id))
      .map((t) => ({
        id: t.id,
        title: t.name,
        subtitle: t.subtitle,
        kind: "tool" as const,
        icon: t.icon,
        color: t.color,
      })),
    ...(data.settings.disabledTools.includes("bookmarks")
      ? []
      : data.settings.bookmarks
    ).map((b) => ({
      id: b.id,
      title: b.name,
      subtitle: b.url,
      kind: "bookmark" as const,
      icon: Globe,
      color: "purple",
    })),
  ];
  const appAliases = new Map(
    apps.map((app) => [app.id, applicationAliases(app)]),
  );
  const score = (r: SearchResult) => {
    const aliases =
      r.kind === "tool"
        ? tools.find((t) => t.id === r.id)?.keywords || ""
        : r.kind === "bookmark"
          ? data.settings.bookmarks.find((b) => b.id === r.id)?.alias || ""
          : "";
    if (!q) return 1;
    const direct = nameScore(r.title, q, joined);
    const alternate =
      r.kind === "app"
        ? Math.max(
            0,
            ...(appAliases.get(r.id) || []).map((name) =>
              nameScore(name, q, joined, true),
            ),
          )
        : aliases.toLowerCase().includes(q)
          ? 40
          : 0;
    return Math.max(direct, alternate);
  };
  const ranked = entries
    .map((r, i) => ({ r, s: score(r), i }))
    .filter((e) => e.s > 0)
    .sort(
      (a, b) =>
        b.s - a.s ||
        (data.usage[b.r.id]?.lastUsed || 0) -
          (data.usage[a.r.id]?.lastUsed || 0) ||
        (data.usage[b.r.id]?.count || 0) - (data.usage[a.r.id]?.count || 0) ||
        a.i - b.i,
    );
  const best = Math.max(
    0,
    ...ranked.filter((e) => e.r.kind !== "tool").map((e) => e.s),
  );
  const intent = detectIntent(query, best);
  const enabled = (id: string) => !data.settings.disabledTools.includes(id);
  let calculation: SearchResult[] = [];
  if (q && intent === "calculation" && enabled("calculator")) {
    try {
      const value = calculate(q);
      calculation = [
        {
          id: "calculation",
          title: value,
          subtitle: `${query} = ${value}`,
          kind: "calculation",
          icon: Equal,
          color: "orange",
          value,
        },
        {
          id: "calculator",
          title: t("在计算稿纸中继续"),
          subtitle: t("带入算式，多行计算并保存历史"),
          kind: "tool",
          icon: NotebookPen,
          color: "orange",
          value: query.trim(),
        },
      ];
    } catch {
      /* Search text is not necessarily an expression. */
    }
  }
  let time: SearchResult[] = [];
  if (intent === "time" && enabled("timestamp")) {
    try {
      const parsed = parseTime(query, "local");
      if (parsed) {
        const ms = parsed.ms;
        const zone = `${localZone()} · ${offsetLabel(zoneOffset(ms, "local"))}`;
        const date = formatZoned(ms, "local", ms % 1000 !== 0);
        const seconds = String(Math.floor(ms / 1000));
        const toDate =
          parsed.kind === "seconds" || parsed.kind === "milliseconds";
        const rows: [string, string, string][] = toDate
          ? [
              [date, t("本地时间 · {zone}", { zone }), date],
              [
                new Date(ms).toISOString(),
                "UTC · ISO 8601",
                new Date(ms).toISOString(),
              ],
            ]
          : [
              [seconds, t("秒级时间戳 · 按本地时区 {zone}", { zone }), seconds],
              [String(ms), t("毫秒级时间戳"), String(ms)],
            ];
        time = [
          ...rows.map(([title, subtitle, value], i) => ({
            id: `time-${i}`,
            title,
            subtitle,
            kind: "time" as const,
            icon: Clock3,
            color: "blue",
            value,
          })),
          {
            id: "timestamp",
            title: t("在时间与时区中打开"),
            subtitle: t("查看全部格式与世界时钟"),
            kind: "tool",
            icon: Clock3,
            color: "blue",
            value: query.trim(),
          },
        ];
      }
    } catch {
      /* Invalid dates fall back to normal search. */
    }
  }
  const matched: SearchResult[] = [
    ...time,
    ...calculation,
    ...ranked.map((e) => e.r),
  ];
  const online: SearchResult[] = [];
  if (
    q &&
    (intent === "translation" || !matched.some((r) => r.kind === "app"))
  ) {
    if (enabled("google"))
      online.push({
        id: "google",
        kind: "websearch",
        title: t("Google 搜索「{query}」", { query }),
        subtitle: t("使用默认浏览器打开搜索结果"),
        icon: Search,
        color: "blue",
        value: query,
      });
    if (enabled("translate")) {
      const translation: SearchResult = {
        id: "translate",
        kind: "translation",
        title: t("翻译「{query}」", { query }),
        subtitle: t("在当前 Dock 内查看译文"),
        icon: Languages,
        color: "purple",
        value: query,
      };
      // Text that reads like a sentence leads with translation.
      if (intent === "translation") online.unshift(translation);
      else online.push(translation);
    }
  }
  if (intent === "translation") return [...online, ...matched];
  matched.push(...online);
  return matched;
}
