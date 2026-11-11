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
