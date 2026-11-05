import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: {
    locale: "zh-CN",
    baseURL: "http://127.0.0.1:3415",
    viewport: { width: 1200, height: 850 },
    launchOptions: {
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3415",
    reuseExistingServer: true,
  },
  workers: 1,
});
