import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Client privilegiado (service role — ignora RLS). Nunca importar fora de
// Server Actions/Route Handlers; `server-only` quebra o build se vazar para
// um Client Component. ADR-006: schema dedicado explícito, como todo client.
export function createAdminClient() {
  return createSupabaseClient<Database, "crm_abvcap">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "crm_abvcap" },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
