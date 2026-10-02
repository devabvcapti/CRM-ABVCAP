import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// ADR-006: schema dedicado — nunca assumir o `public` implícito do client padrão.
export function createClient() {
  return createBrowserClient<Database, "crm_abvcap">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "crm_abvcap" } },
  );
}
