import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

// Renova a sessão a cada request (chamado a partir de src/proxy.ts, depois do
// middleware do next-intl). Escreve os cookies atualizados tanto no `request`
// (para o response já refletir a sessão renovada) quanto no `response` passado
// — nunca cria um NextResponse.next() novo aqui, para preservar o
// redirect/rewrite de locale que o next-intl já decidiu.
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createServerClient<Database, "crm_abvcap">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "crm_abvcap" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Não rodar código entre createServerClient e getClaims(): é isso que
  // efetivamente renova a sessão antes do restante do request continuar.
  await supabase.auth.getClaims();

  return response;
}
