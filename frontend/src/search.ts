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
import { Globe, Equal, Search, Languages } from "lucide-react";
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
  let calculation: SearchResult[] = [];
  if (
    q &&
    /[+*/%()−×÷-]/.test(q) &&
    !data.settings.disabledTools.includes("calculator")
  ) {
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
      ];
    } catch {
      /* Search text is not necessarily an expression. */
    }
  }
  const matched: SearchResult[] = [
    ...calculation,
    ...entries
      .map((r, i) => ({ r, s: score(r), i }))
      .filter((e) => e.s > 0)
      .sort(
        (a, b) =>
          b.s - a.s ||
          (data.usage[b.r.id]?.lastUsed || 0) -
            (data.usage[a.r.id]?.lastUsed || 0) ||
          (data.usage[b.r.id]?.count || 0) - (data.usage[a.r.id]?.count || 0) ||
          a.i - b.i,
      )
      .map((e) => e.r),
  ];
  if (q && !matched.some((r) => r.kind === "app")) {
    if (!data.settings.disabledTools.includes("google"))
      matched.push({
        id: "google",
        kind: "websearch",
        title: t("Google 搜索「{query}」", { query }),
        subtitle: t("使用默认浏览器打开搜索结果"),
        icon: Search,
        color: "blue",
        value: query,
      });
    if (!data.settings.disabledTools.includes("translate"))
      matched.push({
        id: "translate",
        kind: "translation",
        title: t("翻译「{query}」", { query }),
        subtitle: t("在当前 Dock 内查看译文"),
        icon: Languages,
        color: "purple",
        value: query,
      });
  }
  return matched;
}
