// Run with Vite on :3415. Isolated Chrome context; never operates the native app.
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
page.setDefaultTimeout(60000);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const measurements = [];
async function measure(stage, extra = {}) {
  const natural = await cdp.send("Runtime.getHeapUsage");
  await cdp.send("HeapProfiler.collectGarbage");
  const retained = await cdp.send("Runtime.getHeapUsage");
  const metrics = await cdp.send("Performance.getMetrics");
  measurements.push({
    stage,
    ...extra,
    naturalHeapMiB: natural.usedSize / 1048576,
    retainedHeapMiB: retained.usedSize / 1048576,
    taskSeconds: metrics.metrics.find((x) => x.name === "TaskDuration").value,
  });
  console.log(JSON.stringify(measurements.at(-1)));
}
async function openJSON() {
  await page.getByRole("textbox", { name: "搜索应用和工具" }).fill("json");
  await page.getByRole("textbox", { name: "搜索应用和工具" }).press("Enter");
  await page
    .getByRole("heading", { name: "JSON 格式化", exact: true })
    .waitFor();
}
async function fillMiB(mib, cycle) {
  const start = Date.now();
  await page.getByLabel("工具输入").evaluate(
    (el, { mib, cycle }) => {
      const row = JSON.stringify({
        id: 9007199254740993,
        name: "memory-test",
        value: "x".repeat(120),
      });
      const value =
        '{"cycle":' +
        cycle +
        ',"items":[' +
        Array(Math.ceil((mib * 1048576) / (row.length + 1)))
          .fill(row)
          .join(",") +
        "]}";
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { mib, cycle },
  );
  await page.waitForFunction(
    (cycle) =>
      document
        .querySelector('[aria-label="工具结果"]')
        ?.textContent.includes('"cycle": ' + cycle),
    cycle,
  );
  await measure(`${mib}MiB-cycle-${cycle}`, { elapsedMs: Date.now() - start });
}
try {
  await page.goto("http://127.0.0.1:3415");
  await page.getByRole("textbox", { name: "搜索应用和工具" }).waitFor();
  await measure("launcher-baseline");
  await openJSON();
  for (let i = 1; i <= 5; i++) {
    await fillMiB(1, i);
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await measure(`leave-cycle-${i}`);
    await openJSON();
  }
  await fillMiB(5, 6);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: false }),
    ),
  );
  await page.waitForTimeout(1000);
  await measure("hidden-5MiB");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("quickdock-visibility", { detail: true }),
    ),
  );
  await page.getByLabel("工具输入").waitFor();
  await page.getByLabel("工具输入").fill("");
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.waitForTimeout(1000);
  await measure("cleared-and-left");
  await writeFile(
    process.argv[2] || "../docs/validation/resources.json",
    JSON.stringify(
      {
        engine: "Chrome headless (not native WebKit)",
        forcedGC: "retainedHeapMiB only; diagnostic, not production behaviour",
        measurements,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
