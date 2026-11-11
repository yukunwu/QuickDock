import { expect, test, type Page } from "@playwright/test";
async function visibility(page: Page, shown: boolean) {
  await page.evaluate(
    (value) =>
      window.dispatchEvent(
        new CustomEvent("quickdock-visibility", { detail: value }),
      ),
    shown,
  );
}
test("each native hide clears search, selection, IME and expanded Dock without clearing on focus", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByLabel("搜索应用和工具");
  await search.fill("retained while visible");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await visibility(page, true);
  await expect(search).toHaveValue("retained while visible");
  await search.dispatchEvent("compositionstart");
  await visibility(page, false);
  await visibility(page, true);
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await search.fill("json");
  await search.press("Enter");
  await expect(
    page.getByRole("heading", { name: "JSON 格式化", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /展开/ }).click();
  await visibility(page, false);
  await visibility(page, true);
  await expect(search).toHaveValue("");
  await expect(page.getByRole("button", { name: /展开/ })).toBeVisible();
  await expect(page.getByRole("option").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
test("hiding tools/settings/translation returns clean Dock while preserving calculator draft", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByLabel("搜索应用和工具");
  await search.fill("jsq");
  await search.press("Enter");
  await page.getByLabel("工具输入").fill("# preserved paper\n125*8");
  await visibility(page, false);
  await visibility(page, true);
  await expect(search).toHaveValue("");
  await expect(page.getByLabel("工具输入")).toHaveCount(0);
  await search.fill("jsq");
  await search.press("Enter");
  await expect(page.getByLabel("工具输入")).toHaveValue(
    "# preserved paper\n125*8",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "偏好设置" }).click();
  await visibility(page, false);
  await visibility(page, true);
  await expect(search).toHaveValue("");
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await search.fill("a phrase with no apps");
  await page.getByRole("option", { name: /翻译「/ }).click();
  await expect(page.getByLabel("Google网页翻译")).toBeVisible();
  await visibility(page, false);
  await visibility(page, true);
  await expect(search).toHaveValue("");
  await expect(page.getByLabel("Google网页翻译")).toHaveCount(0);
});
test("background index completion updates visible results without changing input", async ({
  page,
}) => {
  await page.route("**/src/bridge.ts*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "apps: previewApps,",
      "apps: [...previewApps, ...(window.installedApps || [])],",
    );
    await route.fulfill({
      response,
      body,
      contentType: "application/javascript",
    });
  });
  await page.goto("/");
  const search = page.getByLabel("搜索应用和工具");
  await search.fill("FreshInstalledApp");
  await expect(
    page.getByRole("option", { name: /FreshInstalledApp.*应用程序/ }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    (window as any).installedApps = [
      {
        id: "app-fixture",
        name: "FreshInstalledApp",
        path: "/Applications/FreshInstalledApp.app",
        bundleId: "com.test.fresh",
      },
    ];
    window.dispatchEvent(new Event("quickdock-apps-changed"));
  });
  await expect(page.getByRole("option").first()).toContainText(
    "FreshInstalledApp",
  );
  await expect(page.getByRole("option").first()).toContainText("应用程序");
  await expect(search).toHaveValue("FreshInstalledApp");
  await page.evaluate(() => {
    (window as any).installedApps = [];
    window.dispatchEvent(new Event("quickdock-apps-changed"));
  });
  await expect(
    page.getByRole("option", { name: /FreshInstalledApp.*应用程序/ }),
  ).toHaveCount(0);
});
