import type { Bookmark } from "../catalog";
// A bookmark whose URL contains {query} is a search keyword: "gh rust" opens
// it with "rust" substituted. Mirrors core.BookmarkTarget in Go.
export const QUERY = "{query}";
const marker = "qdquerymarker";
// Browser-style %s templates are accepted; %s is never a valid escape.
export function normalizeBookmarkURL(raw: string): string {
  const template = raw.trim().replace(/%s/g, QUERY);
  let url: URL;
  try {
    url = new URL(template.replaceAll(QUERY, marker));
  } catch {
    throw new Error("网址必须为不含登录凭据的 http:// 或 https:// 地址");
  }
  if (url.username || url.password) throw new Error("网址不能包含登录凭据");
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("网址只支持 http:// 或 https://");
  if (url.hostname.includes(marker))
    throw new Error("搜索占位符 {query} 不能出现在域名中");
  return url.href.replaceAll(marker, QUERY);
}
export const isSearchKeyword = (b: Bookmark) => b.url.includes(QUERY);
export function bookmarkTarget(url: string, query: string) {
  return url.replaceAll(QUERY, encodeURIComponent(query));
}
// Aliases are free text; each word or comma-separated part is a keyword.
export function bookmarkKeywords(b: Bookmark) {
  return b.alias
    .normalize("NFKC")
    .toLowerCase()
    .split(/[\s,，、]+/)
    .filter(Boolean);
}
export const searchPresets: Omit<Bookmark, "id">[] = [
  { name: "GitHub", url: "https://github.com/search?q={query}", alias: "gh" },
  { name: "百度", url: "https://www.baidu.com/s?wd={query}", alias: "bd" },
  { name: "Bing", url: "https://www.bing.com/search?q={query}", alias: "bing" },
  {
    name: "Wikipedia",
    url: "https://en.wikipedia.org/w/index.php?search={query}",
    alias: "wiki",
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com/results?search_query={query}",
    alias: "yt",
  },
  {
    name: "哔哩哔哩",
    url: "https://search.bilibili.com/all?keyword={query}",
    alias: "bili",
  },
  {
    name: "npm",
    url: "https://www.npmjs.com/search?q={query}",
    alias: "npm",
  },
  {
    name: "MDN",
    url: "https://developer.mozilla.org/search?q={query}",
    alias: "mdn",
  },
];
