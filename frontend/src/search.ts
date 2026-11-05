import { t } from "./i18n";
import { calculate } from "./tools/calculator";
import { pinyin } from "pinyin-pro";
import {
  tools,
  fallbackIcons,
  genericAppIcon,
  type Snapshot,
  type SearchResult,
} from "./catalog";
import { Globe, Equal, Search, Languages } from "lucide-react";
const normalized = new Map<string, string>();
function searchable(name: string) {
  if (!normalized.has(name)) {
    if (normalized.size > 5000) normalized.clear();
    normalized.set(
      name,
      `${name} ${pinyin(name, { toneType: "none", type: "array" }).join("")} ${pinyin(name, { pattern: "first", toneType: "none", type: "array" }).join("")}`.toLowerCase(),
    );
  }
  return normalized.get(name)!;
}
export function searchEntries(query: string, data: Snapshot): SearchResult[] {
  const q = query.trim().toLowerCase();
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
  const score = (r: SearchResult) => {
    const name = r.title.toLowerCase();
    const aliases =
      r.kind === "tool"
        ? tools.find((t) => t.id === r.id)?.keywords || ""
        : r.kind === "bookmark"
          ? data.settings.bookmarks.find((b) => b.id === r.id)?.alias || ""
          : "";
    if (!q) return 1;
    if (name === q) return 100;
    if (name.startsWith(q)) return 80;
    if (name.includes(q)) return 60;
    if (searchable(r.title).includes(q) || aliases.toLowerCase().includes(q))
      return 40;
    return 0;
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
