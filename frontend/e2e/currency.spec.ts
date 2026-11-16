import { test, expect } from "@playwright/test";
const rates = {
  amount: 1,
  base: "EUR",
  date: "2026-11-13",
  rates: { USD: 1.25, CNY: 8.75, JPY: 175 },
};
test("currency converts offline-safe cached ECB rates and swaps pairs", async ({
  page,
}) => {
  let calls = 0;
  await page.route(/api\.frankfurter\.dev/, (route) => {
    calls++;
    return route.fulfill({ json: rates });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("quickdock-preview-rates"));
  await page.getByRole("button", { name: /^(全部工具|工具库.*)$/ }).click();
  await page.getByRole("button", { name: /^汇率换算/ }).click();
  const amount = page.getByLabel("金额", { exact: true });
  await expect(amount).toBeFocused();
  await expect(
    page.getByText("1 USD = 7 CNY · 1 CNY = 0.1429 USD"),
  ).toBeVisible();
  await expect(page.getByLabel("复制换算结果")).toHaveText("700.00");
  await amount.fill("2*50+20");
  await expect(page.getByLabel("复制换算结果")).toHaveText("840.00");
  await page.getByLabel("交换币种").click();
  await expect(page.getByLabel("原币种")).toHaveValue("CNY");
  await page.getByRole("button", { name: /^JPY/ }).click();
  await expect(page.getByLabel("目标币种")).toHaveValue("JPY");
  await expect(page.getByLabel("复制换算结果")).toHaveText("2,400");
  await expect(page.getByText("仅下载汇率表，金额只在本机计算")).toBeVisible();
  // Fresh cache: reopening the tool must not download again.
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: /^(全部工具|工具库.*)$/ }).click();
  await page.getByRole("button", { name: /^汇率换算/ }).click();
  await expect(page.getByLabel("复制换算结果")).toHaveText("2,400");
  expect(calls).toBe(1);
  await page.route(/api\.frankfurter\.dev/, (route) => route.abort());
  await page.getByLabel("刷新汇率").click();
  await expect(page.getByText("离线，显示上次保存的汇率")).toBeVisible();
  await expect(page.getByLabel("复制换算结果")).toHaveText("2,400");
});
