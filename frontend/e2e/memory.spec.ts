import { test, expect } from "@playwright/test";

test("large results release workers, bound DOM, preserve drafts and copy full output", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copiedLength: number }).copiedLength =
            text.length;
        },
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("搜索应用和工具").fill("json");
  await page.getByLabel("搜索应用和工具").press("Enter");
  const input = page.getByLabel("工具输入");
  const output = page.getByLabel("工具结果");
  const payload = JSON.stringify({
    text: "中文😀".repeat(200000),
    n: "900719925474099312345",
  });
  await input.fill(payload);
  await expect(output).toHaveText(
    JSON.stringify(JSON.parse(payload), null, 2).slice(0, 65536),
  );
  await expect(
    page.getByText("预览前 65,536 字符 · 复制获取全文"),
  ).toBeVisible();
  await expect.poll(() => page.workers().length).toBe(0);
  await page.getByRole("button", { name: "复制结果" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { copiedLength: number }).copiedLength,
    ),
  ).toBe(JSON.stringify(JSON.parse(payload), null, 2).length);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: false }),
    ),
  );
  await expect(input).toHaveCount(0);
  await expect(output).toHaveCount(0);
  await expect.poll(() => page.workers().length).toBe(0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: true }),
    ),
  );
  await expect(input).toHaveValue(payload);
  await expect(output).toContainText('"text"');
  await page.getByRole("button", { name: "清空输入" }).click();
  await expect(input).toHaveValue("");
  await expect(output).toBeEmpty();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByLabel("搜索应用和工具").press("Enter");
  await expect(input).toHaveValue("");
});

test("cancelled computation cannot replace new input; repeated hide preserves latest draft", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("搜索应用和工具").fill("json");
  await page.getByLabel("搜索应用和工具").press("Enter");
  const input = page.getByLabel("工具输入");
  const output = page.getByLabel("工具结果");
  await input.fill(JSON.stringify({ text: "x".repeat(3 * 1024 * 1024) }));
  await input.fill('{"latest":900719925474099312345}');
  await expect(output).toContainText("900719925474099312345");
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("quickdock-visibility", { detail: false }),
      ),
    );
    await expect(input).toHaveCount(0);
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("quickdock-visibility", { detail: true }),
      ),
    );
    await expect(input).toHaveValue('{"latest":900719925474099312345}');
    await expect(output).toHaveText('{\n  "latest": 900719925474099312345\n}');
  }
  await expect.poll(() => page.workers().length).toBe(0);
});

test("idle reclamation reloads hidden heavy tools without losing drafts or revealing them", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("搜索应用和工具").fill("json");
  await page.getByLabel("搜索应用和工具").press("Enter");
  const payload = JSON.stringify({
    text: "x".repeat(1024 * 1024),
    n: "900719925474099312345",
  });
  await page.getByLabel("工具输入").fill(payload);
  await expect(page.getByLabel("工具结果")).toContainText('"text"');
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: false }),
    ),
  );
  await expect(page.getByLabel("工具输入")).toHaveCount(0);
  await Promise.all([
    page.waitForEvent("load"),
    page.evaluate(() => window.dispatchEvent(new Event("quickdock-idle"))),
  ]);
  await expect(page.locator(".main")).toBeVisible();
  await expect(page.getByLabel("工具输入")).toHaveCount(0);
  expect(
    await page.evaluate(() => history.state?.quickdockSession),
  ).toBeUndefined();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: true }),
    ),
  );
  await expect(page.getByLabel("工具输入")).toHaveValue(payload);
  await expect(page.getByLabel("工具结果")).toContainText('"text"');
  await page.getByRole("button", { name: "清空输入" }).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: false }),
    ),
  );
  await Promise.all([
    page.waitForEvent("load"),
    page.evaluate(() => window.dispatchEvent(new Event("quickdock-idle"))),
  ]);
  await expect(page.locator(".main")).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: true }),
    ),
  );
  await expect(page.getByLabel("工具输入")).toHaveValue("");
  await expect(page.getByLabel("工具结果")).toBeEmpty();
});

test("session quota failure keeps live input instead of discarding it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("搜索应用和工具").fill("json");
  await page.getByLabel("搜索应用和工具").press("Enter");
  const payload = JSON.stringify({ text: "x".repeat(100000) });
  await page.getByLabel("工具输入").fill(payload);
  await expect(page.getByLabel("工具结果")).toContainText('"text"');
  await page.evaluate(() => {
    history.replaceState = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: false }),
    );
    window.dispatchEvent(new Event("quickdock-idle"));
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: true }),
    );
  });
  await expect(page.getByLabel("工具输入")).toHaveValue(payload);
  await expect(page.getByLabel("工具结果")).toContainText('"text"');
});
