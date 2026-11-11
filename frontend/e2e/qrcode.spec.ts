import { test, expect } from "@playwright/test";
import jsQR from "jsqr";
import { readFile } from "node:fs/promises";

test("QR search, Unicode scan, exports, errors and session state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value: string) => {
          (window as any).copiedQR = value;
        },
      },
    });
  });
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent =
      "*,*::before,*::after { transition: none !important; animation: none !important; }";
    document.addEventListener("DOMContentLoaded", () =>
      document.head.append(style),
    );
  });
  await page.setViewportSize({ width: 960, height: 660 });
  await page.goto("/");
  const search = page.getByRole("textbox", { name: "搜索应用和工具" });
  await search.fill("ewm");
  await expect(page.getByRole("option").first()).toContainText("二维码生成器");
  await search.press("Enter");
  const input = page.getByLabel("二维码内容");
  const png = page.getByRole("button", { name: "导出 PNG", exact: true });
  await expect(png).toBeDisabled();
  const content = "https://example.com/?q=你好😀&x=1#test";
  await input.fill(content);
  await expect(page.getByRole("img", { name: "二维码预览" })).toBeVisible();
  await page.getByLabel("容错级别").selectOption("H");
  await page.getByLabel("图片尺寸").selectOption("1024");
  await page.getByRole("button", { name: "复制 SVG", exact: true }).click();
  expect(await page.evaluate(() => (window as any).copiedQR)).toContain(
    "<svg xmlns=",
  );
  const exported = page.waitForEvent("download");
  await png.click();
  const file = await exported;
  expect(file.suggestedFilename()).toBe("QuickDock-QR.png");
  const bytes = await readFile((await file.path())!);
  const decoded = await page.evaluate(async (base64) => {
    const image = await createImageBitmap(
      await (await fetch("data:image/png;base64," + base64)).blob(),
    );
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    return {
      pixels: Array.from(
        ctx.getImageData(0, 0, image.width, image.height).data,
      ),
      width: image.width,
      height: image.height,
    };
  }, bytes.toString("base64"));
  expect(
    jsQR(new Uint8ClampedArray(decoded.pixels), decoded.width, decoded.height)
      ?.data,
  ).toBe(content);
  expect(decoded.width).toBeLessThanOrEqual(1024);
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 SVG", exact: true }).click();
  const svg = await svgDownload;
  expect(await readFile((await svg.path())!, "utf8")).toContain('width="1024"');
  await page.keyboard.press("Escape");
  await search.fill("qr");
  await search.press("Enter");
  await expect(input).toHaveValue(content);
  await expect(page.getByLabel("容错级别")).toHaveValue("H");
  await input.fill("a".repeat(2400));
  await expect(page.getByRole("alert").first()).toContainText("内容过长");
  await expect(png).toBeDisabled();
  await expect(page.getByRole("img", { name: "二维码预览" })).toHaveCount(0);
  await page.getByRole("button", { name: "清空输入", exact: true }).click();
  await expect(input).toHaveValue("");
  await page.screenshot({ path: "../docs/screenshots/16-qrcode-empty.png" });
  await input.fill(content);
  await page.screenshot({ path: "../docs/screenshots/17-qrcode.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(png).toBeInViewport();
  await page.screenshot({ path: "../docs/screenshots/18-qrcode-dark.png" });
});

test("independent QR window persists content and options across close/reopen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("搜索应用和工具").fill("二维码");
  await page.getByLabel("搜索应用和工具").press("Enter");
  await page.getByLabel("二维码内容").fill("独立窗口 😀");
  await page.getByLabel("容错级别").selectOption("Q");
  const opening = page.waitForEvent("popup");
  await page.getByRole("button", { name: "独立窗口", exact: true }).click();
  const popup = await opening;
  await expect(popup.getByLabel("二维码内容")).toHaveValue("独立窗口 😀");
  await popup.getByLabel("二维码内容").fill("最后输入 saved");
  await popup.getByLabel("图片尺寸").selectOption("256");
  await popup.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  await expect.poll(() => popup.isClosed()).toBe(true);
  const stored = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("quickdock-preview-window-qrcode")!)
        .session,
  );
  expect(JSON.parse(stored).draft).toMatchObject({
    input: "最后输入 saved",
    mode: "Q",
    count: 256,
  });
  const restored = await page.context().newPage();
  await restored.goto("/?tool=qrcode");
  await expect(restored.getByLabel("二维码内容")).toHaveValue("最后输入 saved");
  await expect(restored.getByLabel("容错级别")).toHaveValue("Q");
  await expect(restored.getByLabel("图片尺寸")).toHaveValue("256");
});
