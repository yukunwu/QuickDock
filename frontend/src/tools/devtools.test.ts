import { expect, it } from "vitest";
import {
  contrast,
  convertBase,
  cronRuns,
  formatColor,
  groupDigits,
  jwtDecode,
  lineDiff,
  parseColor,
  parseCron,
  regexTest,
} from "./devtools";
it("regex lists matches with groups and replaces with the user's flags", () => {
  const r = regexTest(
    "(?<y>\\d{4})-(\\d{2})",
    "g",
    "2024-01 and 2025-12",
    "$2/$<y>",
  );
  expect(
    r.matches.map((m) => [m.index, m.text, m.groups[1], m.named.y]),
  ).toEqual([
    [0, "2024-01", "01", "2024"],
    [12, "2025-12", "12", "2025"],
  ]);
  expect(r.replaced).toBe("01/2024 and 12/2025");
  expect(regexTest("a", "", "aaa").matches).toHaveLength(1);
  expect(regexTest("a", "", "aaa", "b").replaced).toBe("baa");
  // Zero-length matches terminate.
  expect(regexTest("", "g", "ab").matches).toHaveLength(3);
  expect(() => regexTest("(", "", "x")).toThrow("正则表达式无效");
  expect(() => regexTest("a", "gg", "x")).toThrow("正则标志");
});
it("decodes a JWT without verifying, keeping big integers and times", () => {
  const enc = (o: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(o)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const token = [
    enc('{"alg":"HS256","typ":"JWT"}'),
    enc(
      '{"sub":"用户","id":9007199254740993,"exp":1700000000,"nbf":1600000000}',
    ),
    "sig",
  ].join(".");
  const r = jwtDecode("Bearer " + token, 1_800_000_000_000);
  expect(r.algorithm).toBe("HS256");
  expect(r.payload).toContain("9007199254740993");
  expect(r.payload).toContain("用户");
  expect(r.times).toEqual([
    { name: "nbf", ms: 1_600_000_000_000 },
    { name: "exp", ms: 1_700_000_000_000 },
  ]);
  expect(r.expired).toBe(true);
  expect(r.notYetValid).toBe(false);
  expect(() => jwtDecode("a.b")).toThrow("三段");
  expect(() => jwtDecode("a.b.c.d.e")).toThrow("JWE");
  expect(() => jwtDecode("!!.e30.x")).toThrow("Base64URL");
  expect(() => jwtDecode(enc("[1]") + ".e30.x")).toThrow("JSON 对象");
  expect(() => jwtDecode("e30." + enc("123") + ".x")).toThrow("JSON 对象");
});
it("parses and formats colors in hex, rgb, hsl and oklch", () => {
  expect(parseColor("#f80")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  expect(formatColor(parseColor("rgb(255 0 0 / 50%)"))).toMatchObject({
    hex: "#ff000080",
    rgb: "rgb(255 0 0 / 0.5)",
  });
  const blue = formatColor(parseColor("hsl(210, 100%, 50%)"));
  expect(blue.hex).toBe("#0080ff");
  expect(formatColor(parseColor("#ffffff")).oklch).toBe("oklch(100% 0 0)");
  expect(formatColor(parseColor("#ff0000")).oklch).toBe(
    "oklch(62.8% 0.2577 29.23)",
  );
  expect(formatColor(parseColor("hsl(0.5turn 50% 50%)")).hex).toBe("#40bfbf");
  expect(contrast(parseColor("#000"), parseColor("#fff"))).toBeCloseTo(21);
  expect(() => parseColor("rgb(1,2)")).toThrow();
  expect(() => parseColor("chartreuse")).toThrow("无法识别");
});
it("converts integers of any size between bases", () => {
  const value = (input: string, from = 0) =>
    Object.fromEntries(convertBase(input, from).map((r) => [r.base, r.value]));
  expect(value("0xff")).toMatchObject({ 2: "11111111", 10: "255", 36: "73" });
  expect(value("-0b1010_1010")[10]).toBe("-170");
  expect(value("0b1", 16)[10]).toBe("177");
  expect(value("18446744073709551616")[16]).toBe("10000000000000000");
  expect(() => convertBase("0x10", 8)).toThrow("前缀");
  expect(() => convertBase("19", 8)).toThrow("有效整数");
  expect(groupDigits("-111111111", 4)).toBe("-1 1111 1111");
});
it("diffs lines minimally and numbers both sides", () => {
  const rows = lineDiff("a\nb\nc\nd", "a\nB\nc\nd\ne");
  expect(
    rows.map((r) => `${r.type}:${r.text}:${r.left ?? ""}:${r.right ?? ""}`),
  ).toEqual([
    "same:a:1:1",
    "del:b:2:",
    "add:B::2",
    "same:c:3:3",
    "same:d:4:4",
    "add:e::5",
  ]);
  expect(lineDiff("x", "x")).toEqual([
    { type: "same", text: "x", left: 1, right: 1 },
  ]);
  expect(lineDiff("", "a\nb").filter((r) => r.type === "add")).toHaveLength(2);
  expect(
    lineDiff("a  b\n", "a b\n", true).every((r) => r.type === "same"),
  ).toBe(true);
  const big = Array.from({ length: 3000 }, (_, i) => String(i));
  const changed = big.map((v, i) => (i % 2 ? v + "!" : v));
  expect(() => lineDiff(big.join("\n"), changed.join("\n"))).toThrow(
    "差异过多",
  );
});
it("parses cron fields and finds the next runs", () => {
  const fields = parseCron("*/15 9-17 * * MON-FRI");
  expect(fields[0].values).toEqual([0, 15, 30, 45]);
  expect(fields[4].values).toEqual([1, 2, 3, 4, 5]);
  // Friday 2026-11-20 17:50 UTC → next is Monday 09:00.
  const from = Date.UTC(2026, 10, 20, 17, 50);
  expect(
    cronRuns(fields, 2, from, true).map((t) => new Date(t).toISOString()),
  ).toEqual(["2026-11-23T09:00:00.000Z", "2026-11-23T09:15:00.000Z"]);
  // Day-of-month and weekday both restricted: either matches.
  const either = cronRuns(
    parseCron("0 0 13 * 5"),
    2,
    Date.UTC(2026, 10, 1),
    true,
  );
  expect(either.map((t) => new Date(t).toISOString().slice(0, 10))).toEqual([
    "2026-11-06",
    "2026-11-13",
  ]);
  expect(parseCron("@daily").map((f) => f.values.length)).toEqual([
    1, 1, 31, 12, 7,
  ]);
  expect(parseCron("0 0 * * 7")[4].values).toEqual([0]);
  expect(
    cronRuns(parseCron("0 0 30 2 *"), 1, Date.UTC(2026, 0, 1), true),
  ).toEqual([]);
  expect(() => parseCron("60 * * * *")).toThrow("分钟");
  expect(() => parseCron("* * * *")).toThrow("5 段");
  expect(() => parseCron("* * * * 1-2-3")).toThrow("星期");
});
it("diff rows rebuild both texts with a minimal number of edits", () => {
  let seed = 7;
  const rand = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
  const lcs = (a: string[], b: string[]) => {
    const dp = Array.from({ length: a.length + 1 }, () =>
      new Array<number>(b.length + 1).fill(0),
    );
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1] + 1
            : Math.max(dp[i - 1][j], dp[i][j - 1]);
    return dp[a.length][b.length];
  };
  for (let round = 0; round < 300; round++) {
    const a = Array.from({ length: rand(12) }, () => "abc"[rand(3)]);
    const b = Array.from({ length: rand(12) }, () => "abc"[rand(3)]);
    const rows = lineDiff(a.join("\n"), b.join("\n"));
    const left = rows.filter((r) => r.type !== "add");
    const right = rows.filter((r) => r.type !== "del");
    expect(left.map((r) => r.text).join("\n")).toBe(a.join("\n"));
    expect(right.map((r) => r.text).join("\n")).toBe(b.join("\n"));
    expect(left.map((r) => r.left)).toEqual(left.map((_, i) => i + 1));
    expect(right.map((r) => r.right)).toEqual(right.map((_, i) => i + 1));
    const edits = rows.filter((r) => r.type !== "same").length;
    // "".split gives one empty line, so compare on what lineDiff sees.
    const sa = a.join("\n").split("\n"),
      sb = b.join("\n").split("\n");
    expect(edits).toBe(sa.length + sb.length - 2 * lcs(sa, sb));
  }
});
