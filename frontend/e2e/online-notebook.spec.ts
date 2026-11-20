import { test, expect, type Page } from "@playwright/test";
async function notebook(page: Page) {
  await page.getByLabel("搜索应用和工具").fill("jsq");
  await page.getByRole("option", { name: /计算稿纸/ }).click();
  await expect(
    page.getByRole("heading", { name: "计算稿纸", exact: true }),
  ).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "quickdock-preview",
      JSON.stringify({
        version: 1,
        theme: "light",
        shortcut: "Option+Space",
        disabledTools: [],
        bookmarks: [],
      }),
    ),
  );
  await page.goto("/");
});
test("no-app-match entries search via default-browser bridge with exact query", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.open = (url) => {
      (window as unknown as { opened: string }).opened = String(url);
      return null;
    };
  });
  const search = page.getByLabel("搜索应用和工具");
  await search.fill("Finder");
  await expect(page.getByRole("option", { name: /Google 搜索/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole("option", { name: /在当前 Dock/ })).toHaveCount(
    0,
  );
  const query = "你好 &x=1 + # ?";
  await search.fill(query);
  await expect(page.getByRole("option")).toHaveCount(2);
  await page
    .locator(".launcher-shell")
    .screenshot({ path: "../docs/screenshots/08-online-shortcuts.png" });
  await page.getByRole("option", { name: /Google 搜索/ }).click();
  const url = new URL(
    await page.evaluate(() => (window as unknown as { opened: string }).opened),
  );
  expect(url.origin).toBe("https://www.google.com");
  expect(url.searchParams.get("q")).toBe(query);
});
test("Dock translation opens a native Google page and transfers text only on action", async ({
  page,
}) => {
  let calls = 0;
  await page
    .context()
    .route(/translate.googleapis.com|api.mymemory.translated.net/, (route) => {
      calls++;
      return route.abort();
    });
  await page.evaluate(() => {
    const events: unknown[] = [];
    (window as unknown as { googleEvents: unknown[] }).googleEvents = events;
    window.addEventListener("quickdock-google-page", (e) =>
      events.push((e as CustomEvent).detail),
    );
  });
  await page.getByLabel("搜索应用和工具").fill("Hello, world.");
  await page.getByRole("option", { name: /翻译「/ }).click();
  await expect(page.getByLabel("Google网页翻译")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            googleEvents: { text: string; action: string }[];
          }
        ).googleEvents.some(
          (e) => e.action === "submit" && e.text === "Hello, world.",
        ),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Google网页翻译")).toHaveCount(0);
  expect(calls).toBe(0);
});
test("notebook caret editing, selection and scrolled results stay on the same row", async ({
  page,
}) => {
  await notebook(page);
  const input = page.getByLabel("工具输入");
  await input.fill("# 本月预算\n1+2+43");
  await input.press("ArrowLeft");
  await input.press("Backspace");
  await input.press("9");
  await expect(input).toHaveValue("# 本月预算\n1+2+93");
  await expect(page.getByLabel("工具结果")).toContainText("96");
  await input.press("Shift+ArrowLeft");
  expect(
    await input.evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd),
    ),
  ).toBe("9");
  await input.press("ArrowRight");
  await input.screenshot({
    path: "../docs/screenshots/11-notebook-caret.png",
    caret: "initial",
  });
  await input.fill(Array.from({ length: 80 }, (_, i) => `${i}+1`).join("\n"));
  await input.evaluate((el) => {
    el.scrollTop = 300;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const positions = await page.evaluate(() => {
    const editor = document.querySelector<HTMLTextAreaElement>(
      ".notebook-columns textarea",
    )!;
    const result = document.querySelector<HTMLDivElement>(".notebook-results")!;
    return {
      editor: editor.scrollTop,
      result: result.scrollTop,
      line: parseFloat(getComputedStyle(editor).lineHeight),
      resultLine: result.firstElementChild!.getBoundingClientRect().height,
    };
  });
  expect(positions.editor).toBeGreaterThan(0);
  expect(positions.result).toBe(positions.editor);
  expect(positions.line).toBe(positions.resultLine);
});
test("notebook records automatically, loads, deletes and clears without losing the draft", async ({
  page,
}) => {
  await notebook(page);
  const input = page.getByLabel("工具输入"),
    output = page.getByLabel("工具结果"),
    entries = page.locator(".history-list article");
  const source = "# 旅行预算\n1200 + 800\nans / 2";
  await input.fill(source);
  await expect(output).toContainText("1000");
  await expect(page.locator(".notebook-autosave")).toContainText("已自动记录");
  // Continued editing updates the same record instead of adding new ones.
  await input.fill(source + "\nans + 1");
  await expect(page.locator(".notebook-autosave")).toContainText("已自动记录");
  await page.reload();
  await notebook(page);
  await page.getByRole("button", { name: /^历史记录/ }).click();
  await expect(entries).toHaveCount(1);
  await page.getByRole("button", { name: "载入记录 # 旅行预算" }).click();
  await expect(input).toHaveValue(source + "\nans + 1");
  // Editing a loaded sheet keeps updating that record.
  await input.fill("# 咖啡预算\n28 * 22\nans * 12");
  await expect(
    page.getByRole("button", { name: "载入记录 # 咖啡预算" }),
  ).toBeVisible();
  await expect(entries).toHaveCount(1);
  // A new sheet starts a new record.
  await page.getByRole("button", { name: "新稿纸" }).click();
  await input.fill("# 房租\n4500 / 3");
  await expect(entries).toHaveCount(2);
  await page
    .locator(".app-shell")
    .screenshot({ path: "../docs/screenshots/10-calculation-notebook.png" });
  await page.getByRole("button", { name: "删除记录 # 咖啡预算" }).click();
  await expect(entries).toHaveCount(1);
  await page.getByRole("button", { name: "清空历史", exact: true }).click();
  await page.getByRole("button", { name: "确认清空历史" }).click();
  await expect(entries).toHaveCount(0);
  await expect(input).toHaveValue("# 房租\n4500 / 3");
  // Invalid sheets are never recorded.
  await input.fill("1/0");
  await expect(output).toContainText("不能除以零");
  await page.waitForTimeout(2000);
  await expect(entries).toHaveCount(0);
  await page.reload();
  await notebook(page);
  await page.getByRole("button", { name: /^历史记录/ }).click();
  await expect(entries).toHaveCount(0);
});
test("Dock calculations copied with Enter join the notebook history", async ({
  page,
}) => {
  const search = page.getByLabel("搜索应用和工具");
  await search.fill("12*3+4");
  await search.press("Enter");
  await search.fill("jsq");
  await page.getByRole("option", { name: /计算稿纸/ }).click();
  await page.getByRole("button", { name: /^历史记录/ }).click();
  await expect(
    page.getByRole("button", { name: "载入记录 12*3+4" }),
  ).toBeVisible();
});
test("notebook save failure leaves the current paper intact", async ({
  page,
}) => {
  await notebook(page);
  const input = page.getByLabel("工具输入");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "quickdock-preview-calculations")
        throw new DOMException("quota", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await input.fill("100*15%");
  await expect(page.getByRole("alert")).toContainText("QuotaExceededError");
  await expect(input).toHaveValue("100*15%");
});
test("translations are recorded, reloaded from history and deletable", async ({
  page,
}) => {
  const search = page.getByLabel("搜索应用和工具");
  for (const text of ["good morning everyone", "see you tomorrow then"]) {
    await search.fill(text);
    await page.getByRole("option", { name: /翻译「/ }).click();
    await expect(page.getByLabel("Google网页翻译")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await search.fill("how is the weather today");
  await page.getByRole("option", { name: /翻译「/ }).click();
  await page.getByRole("button", { name: /^历史/ }).click();
  const entries = page.locator(".translation-history .history-list article");
  await expect(entries).toHaveCount(3);
  await expect(entries.first()).toContainText("how is the weather today");
  await expect(entries.first()).toContainText("自动检测 → 简体中文");
  await page
    .getByRole("button", { name: "载入翻译 good morning everyone" })
    .click();
  await expect(search).toHaveValue("good morning everyone");
  await expect(entries.first()).toContainText("good morning everyone");
  await page
    .getByRole("button", { name: "删除翻译 see you tomorrow then" })
    .click();
  await expect(entries).toHaveCount(2);
  await page.getByRole("button", { name: "清空历史", exact: true }).click();
  await page.getByRole("button", { name: "确认清空历史" }).click();
  await expect(entries).toHaveCount(0);
});
