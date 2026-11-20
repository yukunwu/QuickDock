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
    ["translation", "  Hello & 世界? "],
    ["websearch", "  Hello & 世界? "],
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

it("application English names, aliases and pinyin resolve independently of the display language", () => {
  const apps = [
    {
      id: "wechat",
      name: "微信",
      path: "/Applications/WeChat.app",
      bundleId: "com.tencent.xinWeChat",
    },
    {
      id: "finder",
      name: "访达",
      path: "/System/Library/CoreServices/Finder.app",
      bundleId: "com.apple.finder",
    },
    {
      id: "settings",
      name: "系统设置",
      path: "/System/Applications/System Settings.app",
      bundleId: "com.apple.systempreferences",
    },
    {
      id: "notes",
      name: "备忘录",
      path: "/System/Applications/Notes.app",
      bundleId: "com.apple.Notes",
    },
    {
      id: "code",
      name: "Code",
      path: "/Applications/Visual Studio Code.app",
      bundleId: "com.microsoft.VSCode",
    },
    {
      id: "custom",
      name: "自定义编辑器",
      path: "/Applications/opaque.app",
      bundleId: "test.editor",
      aliases: ["Custom Editor"],
    },
  ];
  const fixture = { ...data, apps };
  for (const [id, queries] of [
    [
      "wechat",
      [
        "微信",
        "weixin",
        "wei xin",
        "wei-xin",
        "wx",
        "WeChat",
        "WECHAT",
        "wechat",
        "ＷｅＣｈａｔ",
      ],
    ],
    ["finder", ["访达", "fangda", "fd", "finder"]],
    [
      "settings",
      [
        "系统设置",
        "xitongshezhi",
        "xtsz",
        "system settings",
        "systemsettings",
        "sys set",
        "ss",
      ],
    ],
    ["notes", ["备忘录", "beiwanglu", "bwl", "notes"]],
    [
      "code",
      ["visual studio code", "visualstudiocode", "vs code", "vscode", "vsc"],
    ],
    [
      "custom",
      ["zidingyibianjiqi", "zdybjq", "custom editor", "customeditor", "ce"],
    ],
  ] as [string, string[]][]) {
    for (const query of queries) {
      expect(searchEntries(query, fixture)[0].id, query).toBe(id);
      expect(
        searchEntries(query, fixture).some(
          (r) => r.kind === "websearch" || r.kind === "translation",
        ),
        query,
      ).toBe(false);
    }
  }
  expect(
    searchEntries("weixin", {
      ...fixture,
      apps: [{ ...apps[0], name: "WeChat" }],
    })[0].id,
  ).toBe("wechat");
});
it("Windows executable basenames and Linux original metadata remain searchable, parent folders do not", () => {
  const fixture = {
    ...data,
    apps: [
      {
        id: "win",
        name: "微信",
        path: "C:\\Users\\PrivateUser\\AppData\\Start Menu\\微信.lnk",
        bundleId: "C:\\Program Files\\Tencent\\WeChat.exe",
      },
      {
        id: "linux",
        name: "文本编辑器",
        path: "/usr/share/applications/org.gnome.gedit.desktop",
        bundleId: "org.gnome.gedit.desktop",
        aliases: ["Text Editor", "gedit"],
      },
    ],
  };
  expect(searchEntries("wechat", fixture)[0].id).toBe("win");
  expect(searchEntries("texteditor", fixture)[0].id).toBe("linux");
  expect(searchEntries("gedit", fixture)[0].id).toBe("linux");
  for (const query of [
    "privateuser",
    "applications",
    "program files",
    "tencent",
    "com.apple",
    "exe",
  ])
    expect(
      searchEntries(query, fixture).filter((r) => r.kind === "app"),
      query,
    ).toEqual([]);
});
it("exact names rank above aliases, strong alias matches rank above popularity, and live metadata replaces cached terms", () => {
  const fixture = {
    ...data,
    apps: [
      {
        id: "one",
        name: "工具甲",
        path: "",
        bundleId: "test.one",
        aliases: ["Editor"],
      },
      { id: "two", name: "Editor", path: "", bundleId: "test.two" },
      { id: "three", name: "Editor Helper", path: "", bundleId: "test.three" },
    ],
    usage: { three: { count: 9999, lastUsed: Date.now() } },
  };
  expect(
    searchEntries("editor", fixture)
      .filter((r) => r.kind === "app")
      .map((r) => r.id),
  ).toEqual(["two", "one", "three"]);
  fixture.apps[0].aliases = ["Changed Alias"];
  expect(
    searchEntries("editor", fixture).filter((r) => r.id === "one"),
  ).toEqual([]);
  expect(searchEntries("changedalias", fixture)[0].id).toBe("one");
  expect(
    searchEntries("cdef", {
      ...data,
      apps: [
        {
          id: "boundary",
          name: "abc",
          aliases: ["def"],
          path: "",
          bundleId: "",
        },
      ],
    }).filter((r) => r.kind === "app"),
  ).toEqual([]);
});

it("predicts time, calculation, translation or app search from the input", () => {
  const kinds = (q: string) => searchEntries(q, data).map((r) => r.kind);
  const lead = (q: string) => searchEntries(q, data)[0];
  // Timestamps and dates convert; Enter copies the converted value.
  expect(lead("1700000000").kind).toBe("time");
  expect(lead("1700000000").value).toMatch(/^2023-11-1[45] /);
  expect(lead("1700000000000").kind).toBe("time");
  expect(lead("2026-11-16 09:30").value).toMatch(/^\d{10}$/);
  expect(lead("2026-11-16").kind).toBe("time");
  expect(
    searchEntries("1700000000", data).find((r) => r.id === "timestamp"),
  ).toMatchObject({ kind: "tool", value: "1700000000" });
  // Phone numbers, short numbers and impossible dates are not timestamps.
  expect(kinds("13800138000")).not.toContain("time");
  expect(kinds("2023-02-30")).not.toContain("time");
  // Arithmetic copies the result and offers the notebook with the expression.
  expect(lead("(128 + 64) * 15%")).toMatchObject({
    kind: "calculation",
    value: "28.8",
  });
  expect(searchEntries("12*3", data)[1]).toMatchObject({
    id: "calculator",
    kind: "tool",
    value: "12*3",
  });
  // Sentences lead with translation; names and short words keep app search.
  expect(lead("how are you today").kind).toBe("translation");
  expect(lead("今天天气怎么样呢").kind).toBe("translation");
  expect(lead("你好，世界").kind).toBe("translation");
  expect(lead("微信").kind).toBe("app");
  expect(lead("weixin").kind).toBe("app");
  expect(kinds("hello")[0]).toBe("websearch");
  // Disabled tools never surface their intent.
  const off = {
    ...data,
    settings: { ...data.settings, disabledTools: ["timestamp", "calculator"] },
  };
  expect(searchEntries("1700000000", off).map((r) => r.kind)).not.toContain(
    "time",
  );
  expect(searchEntries("2+2", off).map((r) => r.kind)).not.toContain(
    "calculation",
  );
});
