import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/proxy";

const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // next-intl decide primeiro (redirect/rewrite de locale); a sessão do
  // Supabase é renovada escrevendo cookies nessa MESMA response, nunca
  // substituindo-a, para não perder a decisão de locale.
  const response = intlMiddleware(request);
  return updateSession(request, response);
}

export const config = {
  // Casa com todos os caminhos, exceto os que começam com
  // /api, /trpc, /_next, /_vercel, ou contêm um ponto (ex.: favicon.ico).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
