import { test, expect } from "@playwright/test";
test("system commands are typed, labelled, and refused in the preview", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByLabel("搜索应用和工具");
  await expect(
    page.locator(".recent-item", { hasText: "锁定屏幕" }),
  ).toHaveCount(0);
  await search.fill("suoping");
  await expect(page.getByRole("option").first()).toContainText("锁定屏幕");
  await expect(page.getByText("↵ 执行")).toBeVisible();
  await search.press("Enter");
  await expect(page.getByRole("status")).toContainText(
    "浏览器预览不能执行系统命令",
  );
});
