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
