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
  // Em CI, "github" (anotações no Actions) + "html" (artefato de depuração,
  // ver upload no workflow) — localmente só "html".
  reporter: process.env.CI ? [["github"], ["html"]] : "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    // Trace desligado de propósito: o repositório é público e a conta de
    // teste (QA_EMAIL/QA_PASSWORD) tem papel admin — o DOM snapshot de um
    // trace não é garantidamente mascarado para valores de <input
    // type="password">, diferente de um screenshot (que só mostra os pontos
    // visuais). Não arriscar a senha de uma conta admin num artefato público
    // de 14 dias de retenção só pra ganhar trace em retry.
    trace: "off",
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
