import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  webServer: {
    command: "npm run dev -- --port 4173",
    url: "http://127.0.0.1:4173/examples/basic.html",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: "chrome",
  },
});
