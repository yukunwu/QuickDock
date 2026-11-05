import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "quickdock-preview",
      JSON.stringify({
        version: 1,
        theme: "light",
        shortcut: "Option+Space",
        disabledTools: [],
        bookmarks: [],
      }),
    ),
  );
  await page.goto("/");
});
test("Google page opens in tool and independent windows without public API calls", async ({
  page,
}) => {
  let calls = 0;
  await page
    .context()
    .route(/translate.googleapis.com|api.mymemory.translated.net/, (route) => {
      calls++;
      return route.abort();
    });
  await page.getByLabel("搜索应用和工具").fill("翻译");
  await page.getByRole("option", { name: /Google网页翻译/ }).click();
  await expect(page.getByLabel("Google网页翻译")).toBeVisible();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "独立窗口", exact: true }).click(),
  ]);
  await expect(popup.getByLabel("Google网页翻译")).toBeVisible();
  await expect(popup.locator(".sidebar")).toHaveCount(0);
  await popup.reload();
  await expect(popup.getByLabel("Google网页翻译")).toBeVisible();
  expect(calls).toBe(0);
  await popup.getByRole("button", { name: "返回搜索结果" }).click();
  await expect.poll(() => popup.isClosed()).toBe(true);
});
test("detached notebook persists separately, reuses popup and keeps input on save failure", async ({
  page,
}) => {
  await page.getByLabel("搜索应用和工具").fill("jsq");
  await page.getByRole("option", { name: /计算稿纸/ }).click();
  await page.getByLabel("工具输入").fill("# 本月预算\n1+2+43");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "独立窗口", exact: true }).click(),
  ]);
  await expect(popup.getByLabel("工具输入")).toHaveValue("# 本月预算\n1+2+43");
  await popup.getByLabel("工具输入").fill("9*9");
  await expect(popup.getByRole("status")).toHaveText("已保存到本机");
  await page.getByLabel("工具输入").fill("1+1");
  await page.getByRole("button", { name: "独立窗口", exact: true }).click();
  expect(page.context().pages()).toHaveLength(2);
  await expect(popup.getByLabel("工具输入")).toHaveValue("9*9");
  await popup.reload();
  await expect(popup.getByLabel("工具输入")).toHaveValue("9*9");
  await expect(popup.getByLabel("工具结果")).toContainText("81");
  await popup.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw Error("disk full");
    };
  });
  await popup.getByLabel("工具输入").fill("123+1");
  await popup.getByRole("button", { name: "返回", exact: true }).click();
  await expect(popup.getByRole("status")).toContainText("保存失败，窗口已保留");
  await expect(popup.getByLabel("工具输入")).toHaveValue("123+1");
  expect(popup.isClosed()).toBe(false);
});
