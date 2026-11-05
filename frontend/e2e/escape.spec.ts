import { test, expect } from "@playwright/test";

test("Escape leaves the tool for Dock, then hides Dock; IME and held keys are ignored", async ({
  page,
}) => {
  // Observe the preview's hide boundary without hiding the browser itself.
  await page.route("**/src/bridge.ts*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "export async function hide() {",
      'export async function hide() { window.dispatchEvent(new Event("test-dock-hidden"));',
    );
    await route.fulfill({
      response,
      body,
      contentType: "application/javascript",
    });
  });
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).hideCount = 0;
    window.addEventListener(
      "test-dock-hidden",
      () => (window as any).hideCount++,
    );
  });
  await page.getByRole("button", { name: "全部工具", exact: true }).click();
  await page.getByRole("button", { name: /^计算稿纸/ }).click();
  const input = page.getByLabel("工具输入");
  await input.fill("# keep my draft\n42*2");
  await input.dispatchEvent("keydown", { key: "Escape", isComposing: true });
  await expect(input).toBeVisible();
  await input.dispatchEvent("keydown", { key: "Escape", keyCode: 229 });
  await expect(input).toBeVisible();
  await input.press("Escape");
  const dock = page.getByLabel("搜索应用和工具");
  await expect(dock).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).hideCount))
    .toBe(0);
  await dock.dispatchEvent("keydown", { key: "Escape", repeat: true });
  expect(await page.evaluate(() => (window as any).hideCount)).toBe(0);
  await dock.press("Escape");
  await expect
    .poll(() => page.evaluate(() => (window as any).hideCount))
    .toBe(1);
  await dock.fill("jsq");
  await dock.press("Enter");
  await expect(input).toHaveValue("# keep my draft\n42*2");
});

test("Escape from translation and its native page event returns to Dock", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByLabel("搜索应用和工具");
  await search.fill("hello world");
  await page.getByRole("option", { name: /翻译「hello world」/ }).click();
  await expect(page.getByLabel("Google网页翻译")).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("quickdock-escape")),
  );
  await expect(page.getByLabel("Google网页翻译")).toHaveCount(0);
  await expect(search).toHaveValue("");
  await search.fill("翻译");
  await page.getByRole("option", { name: /Google网页翻译/ }).click();
  await page.getByLabel("翻译原文").press("Escape");
  await expect(search).toBeVisible();
});

test("independent Escape flushes latest input before closing, preserves window on save failure", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("搜索应用和工具").fill("jsq");
  await page.getByRole("option", { name: /计算稿纸/ }).click();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "独立窗口", exact: true }).click(),
  ]);
  const input = popup.getByLabel("工具输入");
  await input.fill("83+17");
  await input.dispatchEvent("keydown", { key: "Escape", isComposing: true });
  expect(popup.isClosed()).toBe(false);
  await input.dispatchEvent("keydown", { key: "Escape" });
  await expect.poll(() => popup.isClosed()).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "全部工具", exact: true }).click();
  const [restored] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "独立打开 计算稿纸", exact: true }).click(),
  ]);
  await expect(restored.getByLabel("工具输入")).toHaveValue("83+17");
  await restored.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("disk full");
    };
  });
  await restored.getByLabel("工具输入").fill("99+1");
  await restored.getByLabel("工具输入").press("Escape");
  await expect(restored.getByRole("status")).toContainText(
    "保存失败，窗口已保留",
  );
  await expect(restored.getByLabel("工具输入")).toHaveValue("99+1");
});
