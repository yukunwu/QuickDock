import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("configuration exports and imports bookmarks and world clocks", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "quickdock-preview",
      JSON.stringify({
        bookmarks: [
          { id: "d", name: "Docs", url: "https://example.com", alias: "" },
        ],
      }),
    );
    localStorage.setItem(
      "quickdock-time-zones",
      JSON.stringify(["Asia/Tokyo"]),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "偏好设置" }).first().click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出配置" }).click();
  const path = await (await download).path();
  const exported = JSON.parse(await readFile(path, "utf8"));
  expect(exported).toMatchObject({
    app: "QuickDock",
    version: 1,
    worldClocks: ["Asia/Tokyo"],
  });
  expect(exported.settings.bookmarks).toHaveLength(1);
  expect(exported).not.toHaveProperty("usage");

  await page.evaluate(() => {
    localStorage.setItem("quickdock-preview", "{}");
    localStorage.setItem("quickdock-time-zones", "[]");
  });
  await page.reload();
  await page.getByRole("button", { name: "偏好设置" }).first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入配置" }).click();
  await (await chooser).setFiles(path);
  await expect(
    page.getByText("替换为 1 个常用网址、1 个世界时钟"),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认导入" }).click();
  await expect(page.getByText("配置已导入")).toBeVisible();
  await expect(page.locator(".bookmark-row")).toHaveCount(1);
  expect(
    await page.evaluate(() => localStorage.getItem("quickdock-time-zones")),
  ).toBe('["Asia/Tokyo"]');
});
