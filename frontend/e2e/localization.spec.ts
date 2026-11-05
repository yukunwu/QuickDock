import { test, expect } from "@playwright/test";
const preferences = {
  "zh-CN": "偏好设置",
  ja: "環境設定",
  en: "Preferences",
  "zh-TW": "偏好設定",
  es: "Preferencias",
};
for (const language of ["zh-CN", "ja", "en", "zh-TW", "es"] as const) {
  test(`language ${language} persists and translates settings, tools and errors`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(".compact-search input").waitFor();
    await page.keyboard.press("Meta+,");
    await page.getByRole("combobox").first().selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.locator("h1")).toHaveText(preferences[language]);
    await page.reload();
    await page.locator(".compact-search input").waitFor();
    await page.keyboard.press("Meta+,");
    await expect(page.locator("h1")).toHaveText(preferences[language]);
    await expect(page.getByRole("combobox").first()).toHaveValue(language);
    await page.keyboard.press("Escape");
    await page.locator(".compact-search input").fill("jsq");
    await page.keyboard.press("Enter");
    const input = page.locator("textarea");
    await input.fill("# My saved input\n1/0");
    const errors = {
      "zh-CN": "不能除以零",
      ja: "ゼロで除算できません",
      en: "Cannot divide by zero",
      "zh-TW": "不能除以零",
      es: "No se puede dividir entre cero",
    };
    await expect(page.locator(".notebook-results")).toContainText(
      errors[language],
    );
    await page.keyboard.press("Meta+,");
    await page
      .getByRole("combobox")
      .first()
      .selectOption(language === "en" ? "ja" : "en");
    await page.keyboard.press("Escape");
    await page.locator(".compact-search input").fill("jsq");
    await page.keyboard.press("Enter");
    await expect(input).toHaveValue("# My saved input\n1/0");
  });
}
test("shortcut modifiers are selectable, Space is fixed and saved", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".compact-search input").waitFor();
  await page.keyboard.press("Meta+,");
  const form = page.locator(".shortcut-picker");
  await expect(form.locator("input")).toHaveCount(0);
  await expect(form.locator("kbd")).toHaveText("Space");
  for (const button of await form.locator('[aria-pressed="true"]').all())
    await button.click();
  await expect(
    form.locator('button[type="submit"], button.primary'),
  ).toBeDisabled();
  await form.getByRole("button", { name: "⌃ Control", exact: true }).click();
  await form.getByRole("button", { name: "⇧ Shift", exact: true }).click();
  await form.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await page.locator(".compact-search input").waitFor();
  await page.keyboard.press("Meta+,");
  await expect(
    form.getByRole("button", { name: "⌃ Control", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    form.getByRole("button", { name: "⇧ Shift", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("quickdock-preview")!).shortcut,
  );
  expect(saved).toBe("Ctrl+Shift+Space");
});
