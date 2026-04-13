import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
  },
});
