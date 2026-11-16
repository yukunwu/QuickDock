import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("浏览器预览 · 示例应用")).toBeVisible();
});
test("search predicts time, calculation, translation and apps", async ({
  page,
}) => {
  const search = page.getByLabel("搜索应用和工具");
  const intent = page.locator(".search-intent");
  const first = page.getByRole("option").first();
  await search.fill("1700000000");
  await expect(intent).toHaveText("时间转换");
  await expect(first).toContainText(/2023-11-1[45]/);
  await expect(page.locator(".compact-footer kbd").first()).toHaveText(
    "↵ 复制",
  );
  await search.fill("12*3+4");
  await expect(intent).toHaveText("计算");
  await expect(first).toContainText("40");
  await search.fill("how are you today");
  await expect(intent).toHaveText("翻译");
  await expect(first).toContainText("翻译「how are you today」");
  await search.fill("Safari");
  await expect(intent).toHaveCount(0);
  await expect(first).toContainText("Safari");
  // The tool row carries the input into the tool.
  await search.fill("2026-11-16 09:30");
  await page.getByRole("option", { name: /在时间与时区中打开/ }).click();
  await expect(page.getByLabel("时间输入")).toHaveValue("2026-11-16 09:30");
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await search.fill("12*3+4");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.getByLabel("工具输入")).toHaveValue(/12\*3\+4$/);
});
