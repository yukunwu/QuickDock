import { expect, test } from "@playwright/test";

test("localized applications support pinyin, initials, English and Enter launching", async ({
  page,
}) => {
  await page.route("**/src/bridge.ts*", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(
      "apps: previewApps,",
      `apps: [
      {id:"fixture-wechat",name:"微信",path:"/Applications/WeChat.app",bundleId:"com.tencent.xinWeChat"},
      {id:"fixture-finder",name:"访达",path:"/System/Library/CoreServices/Finder.app",bundleId:"com.apple.finder"},
      {id:"fixture-settings",name:"系统设置",path:"/System/Applications/System Settings.app",bundleId:"com.apple.systempreferences"},
      {id:"fixture-custom",name:"自定义编辑器",path:"/Applications/opaque.app",bundleId:"test.editor",aliases:["Custom Editor"]}
    ],`,
    );
    body = body.replace(
      /export async function launch\(id\) \{/,
      "export async function launch(id) { window.testLaunchedApp=id; return;",
    );
    await route.fulfill({
      response,
      body,
      contentType: "application/javascript",
    });
  });
  await page.goto("/");
  const input = page.getByLabel("搜索应用和工具");
  for (const [query, title] of [
    ["weixin", "微信"],
    ["wei xin", "微信"],
    ["wx", "微信"],
    ["WeChat", "微信"],
    ["fangda", "访达"],
    ["fd", "访达"],
    ["finder", "访达"],
    ["xtsz", "系统设置"],
    ["system settings", "系统设置"],
    ["systemsettings", "系统设置"],
    ["ss", "系统设置"],
    ["custom editor", "自定义编辑器"],
    ["zdybjq", "自定义编辑器"],
  ]) {
    await input.fill(query);
    await expect(page.getByRole("option").first()).toContainText(title);
    await expect(
      page.getByRole("option", { name: /Google 搜索「|翻译「/ }),
    ).toHaveCount(0);
  }
  await input.fill("wechat");
  await input.press("Enter");
  await expect
    .poll(() => page.evaluate(() => (window as any).testLaunchedApp))
    .toBe("fixture-wechat");
  await input.fill("application that does not exist");
  await expect(
    page.getByRole("option", { name: /Google 搜索「/ }),
  ).toBeVisible();
});
