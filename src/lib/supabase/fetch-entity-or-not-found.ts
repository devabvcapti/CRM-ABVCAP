import "server-only";
import type { createClient } from "./server";

// Achado real em CI (nunca reproduziu localmente, mesmo depois de dezenas
// de execuções): logo após um insert/update, um select imediato pelo
// mesmo id às vezes retorna "PGRST116 — 0 rows" (não um erro de conexão,
// um 0-rows de verdade) — janela real de inconsistência eventual entre
// escrita e leitura seguinte, que só aparece sob a CPU/rede mais
// restrita do runner de CI, nunca local. Páginas de detalhe chamando
// notFound() só com base em `!data` tratam essa janela transitória igual
// a "a linha nunca existiu". Duas tentativas extras com um pequeno atraso
// cobrem essa janela sem mascarar o caso genuíno (linha realmente ausente
// continua null nas três tentativas).
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchEntityOrNull<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "organizations" | "contacts",
  id: string,
): Promise<T | null> {
  const delaysMs = [0, 150, 400];
  let lastError: unknown = null;

  for (const delay of delaysMs) {
    if (delay > 0) await sleep(delay);
    const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
    if (data) return data as T;
    lastError = error;
  }

  console.error(`[fetchEntityOrNull] gave up after retries table=${table} id=${id}`, lastError);
  return null;
}
