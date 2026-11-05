import { test, expect } from "@playwright/test";
test("update settings show status and preview cannot perform installation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("搜索应用和工具").waitFor();
  await page.keyboard.press("Meta+,");
  const panel = page.getByRole("region", { name: "应用更新" });
  await expect(panel).toContainText("QuickDock 0.1.4");
  await expect(panel.getByRole("button", { name: "下载并安装" })).toHaveCount(
    0,
  );
  await panel.getByRole("button", { name: "检查更新" }).click();
  await expect(panel.getByRole("alert")).toContainText("请在桌面版中检查更新");
});
