import { it, expect } from "vitest";
import { searchEntries } from "./search";
import { defaults, type Snapshot } from "./catalog";
const data: Snapshot = {
  apps: [{ id: "app1", name: "微信", path: "/WeChat.app", bundleId: "test" }],
  settings: {
    ...defaults,
    bookmarks: [
      { id: "site1", name: "文档", url: "https://example.com", alias: "docs" },
    ],
  },
  usage: {},
  indexing: false,
  error: "",
  shortcutError: "",
};
it("Chinese, pinyin, initials, aliases and calculator", () => {
  for (const q of ["微信", "weixin", "wx"])
    expect(searchEntries(q, data)[0].id).toBe("app1");
  expect(searchEntries("docs", data)[0].id).toBe("site1");
  expect(searchEntries("2*(3+4)", data)[0].value).toBe("14");
});
it("disabled tools and bookmarks disappear", () => {
  const disabled = {
    ...data,
    settings: {
      ...data.settings,
      disabledTools: ["calculator", "bookmarks", "google", "translate"],
    },
  };
  expect(searchEntries("2+2", disabled)).toEqual([]);
  expect(searchEntries("docs", disabled)).toEqual([]);
});
it("match strength precedes usage", () => {
  const entries = {
    ...data,
    apps: [
      ...data.apps,
      { id: "app2", name: "微信 helper", path: "", bundleId: "" },
    ],
    usage: { app2: { count: 100, lastUsed: Date.now() } },
  };
  expect(searchEntries("微信", entries)[0].id).toBe("app1");
});

it("online shortcuts only appear when no application matches and keep the original query", () => {
  expect(
    searchEntries("微信", data).some(
      (r) => r.kind === "websearch" || r.kind === "translation",
    ),
  ).toBe(false);
  expect(
    searchEntries("  Hello & 世界? ", data)
      .filter((r) => r.kind === "websearch" || r.kind === "translation")
      .map((r) => [r.kind, r.value]),
  ).toEqual([
    ["websearch", "  Hello & 世界? "],
    ["translation", "  Hello & 世界? "],
  ]);
  expect(
    searchEntries("", data).some(
      (r) => r.kind === "websearch" || r.kind === "translation",
    ),
  ).toBe(false);
  expect(
    searchEntries("没有此应用", {
      ...data,
      settings: { ...data.settings, disabledTools: ["translate"] },
    }).map((r) => r.kind),
  ).toEqual(["websearch"]);
});
