import { expect, it } from "vitest";
import { orderClipboard } from "./clipboard";
import { searchEntries } from "../search";
import { defaults } from "../catalog";
it("lists pinned clipboard entries first and searches folded text", () => {
  const rows = [
    { id: "a", createdAt: 1, text: "old pinned", pinned: true },
    { id: "b", createdAt: 3, text: "ＦＵＬＬＷＩＤＴＨ" },
    { id: "c", createdAt: 2, text: "middle" },
  ];
  expect(orderClipboard(rows, "").map((r) => r.id)).toEqual(["a", "b", "c"]);
  expect(orderClipboard(rows, "fullwidth").map((r) => r.id)).toEqual(["b"]);
});
it("finds the clipboard tool by pinyin and English", () => {
  const data = {
    apps: [],
    settings: defaults,
    usage: {},
    indexing: false,
    error: "",
    shortcutError: "",
  };
  for (const q of ["剪贴板", "jqb", "clipboard"])
    expect(searchEntries(q, data)[0].id).toBe("clipboard");
});
