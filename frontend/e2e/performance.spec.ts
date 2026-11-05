import { test, expect } from "@playwright/test";
test("warm search latency on a 150-app index", async ({ page }) => {
  await page.goto("/");
  const measurement = await page.evaluate(async () => {
    // Vite serves the same search module used by the shipped frontend.
    const { searchEntries } = await import(/* @vite-ignore */ "/src/search.ts");
    const data = {
      apps: Array.from({ length: 150 }, (_, i) => ({
        id: `app-${i}`,
        name: `应用程序 ${i}`,
        path: `/Applications/${i}.app`,
        bundleId: `test.${i}`,
      })),
      settings: {
        version: 1,
        theme: "system",
        shortcut: "Option+Space",
        disabledTools: [],
        bookmarks: [],
      },
      usage: {},
      indexing: false,
      error: "",
      shortcutError: "",
    };
    searchEntries("yy", data);
    const durations = [];
    for (let i = 0; i < 200; i++) {
      const start = performance.now();
      searchEntries(["应用", "yingyong", "yy", "json", "2*(3+4)"][i % 5], data);
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    return {
      apps: 150,
      iterations: 200,
      p50: durations[100],
      p95: durations[190],
      max: durations[199],
    };
  });
  console.log("SEARCH_LATENCY_MS", JSON.stringify(measurement));
  expect(measurement.p95).toBeLessThan(100);
});
