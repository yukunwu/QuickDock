import { test, expect, type Page } from "@playwright/test";
const shots = process.env.QUICKDOCK_SHOTS;
async function open(page: Page, name: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: /^(全部工具|工具库.*)$/ }).click();
  await page.getByRole("button", { name }).first().click();
}
const shot = (page: Page, name: string) =>
  shots ? page.screenshot({ path: `${shots}/${name}.png` }) : undefined;
test("regex highlights matches, lists groups and previews replacements", async ({
  page,
}) => {
  await open(page, /^正则测试/);
  await expect(page.getByText("2 个匹配")).toBeVisible();
  await expect(page.locator(".regex-highlight mark")).toHaveText([
    "alice@example.com",
    "bob@test.com",
  ]);
  await shot(page, "regex");
  await page.getByText("替换", { exact: true }).click();
  await expect(page.getByLabel("替换结果")).toHaveText(
    "example: alice, test: bob",
  );
  await page.getByLabel("正则表达式", { exact: true }).fill("(");
  await expect(page.getByRole("alert")).toContainText("正则表达式无效：");
  // Catastrophic backtracking is stopped by the worker deadline.
  await page.getByLabel("正则表达式", { exact: true }).fill("^(a+)+$");
  await page.getByLabel("测试文本").fill("a".repeat(40) + "!");
  await expect(page.getByRole("alert")).toContainText("匹配超时", {
    timeout: 8000,
  });
});
test("JWT, color, base, diff and cron tools work offline", async ({ page }) => {
  await open(page, /^JWT 解码/);
  await page
    .getByLabel("JWT 令牌")
    .fill("Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjoxfQ.c2ln");
  await expect(page.getByText("HS256", { exact: true })).toBeVisible();
  await expect(page.getByText("已过期")).toBeVisible();
  await shot(page, "jwt");

  await open(page, /^颜色转换/);
  await page.getByLabel("颜色", { exact: true }).fill("rebeccapurple");
  await expect(page.locator(".time-row dd").first()).toHaveText("#663399");
  await shot(page, "color");

  await open(page, /^进制转换/);
  await page.getByLabel("整数", { exact: true }).fill("0xff");
  await expect(page.getByRole("button", { name: /^二进制/ })).toContainText(
    "1111 1111",
  );
  await shot(page, "base");

  await open(page, /^文本对比/);
  await page.getByLabel("原文本").fill("a\nb\nc");
  await page.getByLabel("新文本").fill("a\nB\nc\nd");
  await expect(page.getByText("新增 2 行 · 删除 1 行")).toBeVisible();
  await shot(page, "diff");

  await open(page, /^Cron 表达式/);
  await page
    .getByLabel("Cron 表达式", { exact: true })
    .fill("*/15 9-17 * * 1-5");
  await expect(page.locator(".cron-run")).toHaveCount(10);
  await expect(page.locator(".cron-field dd").first()).toHaveText(
    "0, 15, 30, 45",
  );
  await shot(page, "cron");
});
test("search keywords complete, search, and copy their URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "quickdock-preview",
      JSON.stringify({
        bookmarks: [
          {
            id: "gh",
            name: "GitHub",
            url: "https://github.com/search?q={query}",
            alias: "gh",
          },
        ],
      }),
    ),
  );
  await page.reload();
  const search = page.getByLabel("搜索应用和工具");
  await search.fill("gh");
  await expect(page.getByText("↵ 输入关键词")).toBeVisible();
  await search.press("Tab");
  await expect(search).toHaveValue("gh ");
  await search.pressSequentially("quick dock");
  await expect(
    page.getByRole("option", { name: /在 GitHub 中搜索「quick dock」/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText("https://github.com/search?q=quick%20dock"),
  ).toBeVisible();
  await shot(page, "keyword");
  const popup = page.waitForEvent("popup");
  await search.press("Enter");
  expect((await popup).url()).toContain("github.com/search?q=quick%20dock");
});
test("clipboard history is opt-in and records QuickDock copies in preview", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, /^剪贴板历史/);
  const enable = page.getByRole("button", { name: "开启剪贴板记录" });
  await expect(enable).toBeVisible();
  await shot(page, "clipboard-intro");
  await enable.click();
  await expect(page.getByText("复制一段文本，它会出现在这里。")).toBeVisible();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: /^(全部工具|工具库.*)$/ }).click();
  await page.getByRole("button", { name: /^进制转换/ }).click();
  await page.getByRole("button", { name: /^十进制/ }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: /^(全部工具|工具库.*)$/ }).click();
  await page.getByRole("button", { name: /^剪贴板历史/ }).click();
  await expect(page.locator(".clipboard-row strong")).toHaveText(["255"]);
  await page.getByRole("button", { name: "固定" }).click();
  await expect(page.getByRole("button", { name: "取消固定" })).toBeVisible();
  await shot(page, "clipboard");
});
