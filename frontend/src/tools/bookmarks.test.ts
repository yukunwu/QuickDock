import { expect, it } from "vitest";
import { searchEntries } from "../search";
import { defaults, type Snapshot } from "../catalog";
import { bookmarkTarget, normalizeBookmarkURL } from "./bookmarks";
const data: Snapshot = {
  apps: [],
  settings: {
    ...defaults,
    bookmarks: [
      {
        id: "gh",
        name: "GitHub",
        url: "https://github.com/search?q={query}",
        alias: "gh, github",
      },
      { id: "docs", name: "Docs", url: "https://example.com", alias: "gh" },
    ],
  },
  usage: {},
  indexing: false,
  error: "",
  shortcutError: "",
};
it("normalizes %s templates and rejects placeholders in the host", () => {
  expect(normalizeBookmarkURL(" https://x.dev/s?q=%s ")).toBe(
    "https://x.dev/s?q={query}",
  );
  expect(normalizeBookmarkURL("https://x.dev/wiki/{query}")).toBe(
    "https://x.dev/wiki/{query}",
  );
  expect(() => normalizeBookmarkURL("https://{query}.x.dev/")).toThrow("域名");
  expect(() => normalizeBookmarkURL("javascript:{query}")).toThrow();
  expect(bookmarkTarget("https://x.dev/s?q={query}", "a b&c")).toBe(
    "https://x.dev/s?q=a%20b%26c",
  );
});
it("a keyword prefix searches its bookmark, even for sentence-like text", () => {
  const [first] = searchEntries("GH how do I rebase, again?", data);
  expect(first).toMatchObject({
    id: "gh",
    kind: "bookmark",
    value: "how do I rebase, again?",
  });
  expect(searchEntries("github rust", data)[0].id).toBe("gh");
  // A plain bookmark sharing the alias never becomes a search.
  expect(searchEntries("gh rust", data).filter((r) => r.id === "docs")).toEqual(
    [],
  );
});
it("a bare keyword completes to the keyword and a space", () => {
  const row = searchEntries("gh", data).find((r) => r.id === "gh");
  expect(row?.complete).toBe("gh ");
  expect(row?.value).toBeUndefined();
});
