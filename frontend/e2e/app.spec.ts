import { test, expect, type Page } from "@playwright/test";
async function tool(page: Page, name: string) {
  if (await page.getByRole("button", { name: "返回", exact: true }).count())
    await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: /^(全部工具|工具库.*)$/ }).click();
  await page.getByRole("button", { name: new RegExp("^" + name) }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({
    content:
      "*,*::before,*::after{transition:none!important;animation:none!important}",
  });
  await expect(page.getByText("浏览器预览 · 示例应用")).toBeVisible();
});
test("launcher keyboard, IME guard, calculation and preview boundary", async ({
  page,
}) => {
  const search = page.getByRole("textbox", { name: "搜索应用和工具" });
  await search.fill("jsq");
  await expect(page.getByRole("option").first()).toContainText("计算稿纸");
  await search.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  await expect(search).toHaveValue("jsq");
  await search.press("Enter");
  await expect(
    page.getByRole("heading", { name: "计算稿纸", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await search.fill("2*(3+4)");
  await expect(page.getByRole("option").first()).toContainText("14");
  await search.fill("Finder");
  await search.press("Enter");
  await expect(page.getByRole("status")).toContainText("浏览器预览不能启动");
});
test("ten real tools and session state", async ({ page }) => {
  await tool(page, "JSON 格式化");
  const input = page.getByRole("textbox", { name: "工具输入" }),
    out = page.getByLabel("工具结果");
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.locator(".topbar")).toHaveCount(0);
  await input.fill('{"n":9007199254740993123}');
  await expect(out).toContainText("9007199254740993123");
  await input.fill("{invalid");
  await expect(page.getByRole("alert")).toBeVisible();
  await input.fill('{"saved":true}');
  await tool(page, "Base64");
  await input.fill("中文 😀");
  await expect(out).toHaveText("5Lit5paHIPCfmIA=");
  await page.getByLabel("操作").selectOption("decode");
  await input.fill("@@");
  await expect(page.getByRole("alert")).toBeVisible();
  await tool(page, "URL 编解码");
  await input.fill("a+b c");
  await expect(out).toHaveText("a%2Bb%20c");
  await tool(page, "时间戳转换");
  await page.getByLabel("时区", { exact: true }).selectOption("utc");
  await input.fill("0");
  await expect(out).toHaveText("1970-01-01T00:00:00.000Z");
  await tool(page, "UUID 生成");
  await page.getByLabel("UUID 数量").fill("3");
  await page.getByRole("button", { name: "生成 UUID v4" }).click();
  await expect(out).toHaveText(/^[\da-f-]{36}\n[\da-f-]{36}\n[\da-f-]{36}$/);
  await tool(page, "文本哈希");
  await input.fill("abc");
  await page.getByLabel("算法").selectOption("MD5");
  await expect(out).toHaveText("900150983cd24fb0d6963f7d28e17f72");
  await tool(page, "单位换算");
  await page.getByLabel("类别").selectOption("温度");
  await input.fill("0");
  await expect(out).toHaveText("32");
  await tool(page, "文本处理");
  await input.fill(" a \n b ");
  await expect(out).toHaveText("a\nb");
  await tool(page, "计算稿纸");
  await input.fill("1/0");
  await expect(out).toHaveText("不能除以零");
  await tool(page, "常用网址");
  await page.getByLabel("网址名称").fill("示例文档");
  await page.getByLabel("网址地址").fill("https://example.com");
  await page.getByLabel("网址别名").fill("example-docs");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(
    page.getByText("https://example.com/ · example-docs"),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑示例文档" }).click();
  await page.getByLabel("网址名称").fill("文档新版");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("文档新版", { exact: true })).toBeVisible();
  await tool(page, "JSON 格式化");
  await expect(input).toHaveValue('{"saved":true}');
  if (await page.getByRole("button", { name: "返回", exact: true }).count())
    await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "快捷启动", exact: true }).click();
  await page.getByLabel("搜索应用和工具").fill("example-docs");
  await expect(page.getByRole("option").first()).toContainText("文档新版");
});
test("settings persistence, disable and screenshot stable workspace", async ({
  page,
}) => {
  if (await page.getByRole("button", { name: "返回", exact: true }).count())
    await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "偏好设置" }).click();
  await page.getByRole("button", { name: "浅色", exact: true }).click();
  await page.getByRole("switch", { name: "启用计算稿纸" }).click();
  await page.reload();
  await page.getByRole("button", { name: "全部工具" }).click();
  await expect(page.getByRole("button", { name: /计算稿纸/ })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await tool(page, "JSON 格式化");
  await expect(page.getByLabel("工具结果")).toContainText("9007199254740993");
  await page.screenshot({
    animations: "disabled",
    path: "../docs/screenshots/05-workspace-light.png",
  });
  if (await page.getByRole("button", { name: "返回", exact: true }).count())
    await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "偏好设置" }).click();
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await page.getByRole("switch", { name: "启用计算稿纸" }).click();
  await expect(page.locator(".toast[role=status]")).toContainText("设置已保存");
  await expect(
    page.getByRole("button", { name: "保存", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "关闭提示" }).click();
  await page.screenshot({
    animations: "disabled",
    path: "../docs/screenshots/04-settings.png",
  });
  await tool(page, "JSON 格式化");
  await expect(page.getByLabel("工具结果")).toContainText("9007199254740993");
  await page.screenshot({
    animations: "disabled",
    path: "../docs/screenshots/03-workspace.png",
  });
  if (await page.getByRole("button", { name: "返回", exact: true }).count())
    await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "工具库" }).click();
  await page.screenshot({
    animations: "disabled",
    path: "../docs/screenshots/02-tools.png",
  });
  if (await page.getByRole("button", { name: "返回", exact: true }).count())
    await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "快捷启动", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "搜索应用和工具" }),
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "../docs/screenshots/01-launcher.png",
  });
  await page.getByRole("button", { name: "偏好设置", exact: true }).click();
  await page.getByRole("button", { name: "浅色", exact: true }).click();
  if (await page.getByRole("button", { name: "返回", exact: true }).count())
    await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "快捷启动", exact: true }).click();
  await page.screenshot({
    animations: "disabled",
    path: "../docs/screenshots/06-launcher-light.png",
  });
});
