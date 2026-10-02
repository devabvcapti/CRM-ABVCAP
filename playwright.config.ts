import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serial sempre: todo teste autenticado usa a MESMA conta de teste (QA), e
  // logins concorrentes para o mesmo usuário colidem na rotação de refresh
  // token do Supabase Auth — descoberto rodando em paralelo (workers
  // default), virou ERR_TOO_MANY_REDIRECTS numa sessão invalidada por outra.
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm run build && pnpm run start",
    url: "http://127.0.0.1:3000",
    timeout: 180 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
