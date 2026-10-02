import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// Server Components, Server Actions e Route Handlers. ADR-006: schema dedicado explícito.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "crm_abvcap">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "crm_abvcap" },
      // supabase-js usa o fetch global se nenhum for passado — em Server
      // Components/Actions isso é o fetch do próprio Next.js, que cacheia
      // GET por padrão (Data Cache) a menos que a chamada opte por não
      // cachear. Toda query do PostgREST é um GET simples sem esse opt-out,
      // então sem isto aqui uma leitura logo após um insert/update pode
      // servir uma resposta cacheada de antes da escrita — causa real de
      // "PGRST116 (0 rows)" intermitente numa página de detalhe recém-criada
      // (achado via systematic-debugging, 2026-10-02, ver docs/roadmap.md).
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll chamado a partir de um Server Component — seguro ignorar
            // porque o proxy (src/proxy.ts) já renova a sessão a cada request.
          }
        },
      },
    },
  );
}
