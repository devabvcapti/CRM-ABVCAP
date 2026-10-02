import { test, expect } from "@playwright/test";
import { loginAsQa } from "./helpers";

test.describe("autenticação", () => {
  test("acesso não autenticado a rota protegida redireciona para /login", async ({ page }) => {
    await page.goto("/pt-BR/dashboard");
    await expect(page).toHaveURL(/\/pt-BR\/login$/);
  });

  test("credenciais inválidas mostram erro, sem navegar", async ({ page }) => {
    await page.goto("/pt-BR/login");
    await page.locator("#email").fill("naoexiste@example.invalid");
    await page.locator("#password").fill("senhaerrada");
    await page.getByRole("button", { name: "Entrar" }).click();

    // getByRole("alert") também casa com o route-announcer do Next.js — o
    // erro de verdade é o único com este data-slot (ver src/components/ui/field.tsx).
    await expect(page.locator('[data-slot="field-error"]')).toContainText(
      "E-mail ou senha incorretos",
    );
    await expect(page).toHaveURL(/\/pt-BR\/login$/);
  });

  test("login com a conta de teste chega ao dashboard", async ({ page }) => {
    await loginAsQa(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading")).toContainText("QA Playwright");
  });

  test("logout volta para /login", async ({ page }) => {
    await loginAsQa(page);

    // Em viewport mobile a sidebar some atrás de um Sheet off-canvas (ADR-003) —
    // precisa abrir pelo "Toggle Sidebar" antes de alcançar o "Sair". Em
    // desktop a sidebar já está visível, então o botão já aparece direto.
    const logoutButton = page.getByRole("button", { name: "Sair" });
    if (!(await logoutButton.isVisible())) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    }
    await logoutButton.click();

    await expect(page).toHaveURL(/\/login$/);
  });
});
