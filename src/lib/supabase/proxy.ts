import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { routing } from "@/i18n/routing";

// Rotas acessíveis sem sessão. Tudo que não estiver aqui é protegido por
// padrão (default-deny) — mesma postura do resto do projeto (ADR-001).
const PUBLIC_PATHS = ["/", "/login"];

// Retorna o locale do prefixo da URL e o caminho sem ele, ou `null` se a URL
// não tiver prefixo de locale reconhecível (ex.: "/dashboard" direto, sem
// "/pt-BR" na frente). Isso só acontece em navegação externa/manual — o
// próprio next-intl redireciona para a versão prefixada logo em seguida, e
// cada página protegida já faz sua própria checagem de sessão (defesa em
// profundidade) — então é seguro simplesmente não aplicar o gate aqui nesse
// caso raro, em vez de arriscar um redirect para um "locale" inventado.
function splitLocale(pathname: string): { locale: string; path: string } | null {
  for (const loc of routing.locales) {
    if (pathname === `/${loc}`) return { locale: loc, path: "/" };
    if (pathname.startsWith(`/${loc}/`)) {
      return { locale: loc, path: pathname.slice(loc.length + 1) };
    }
  }
  return null;
}

// Renova a sessão a cada request (chamado a partir de src/proxy.ts, depois do
// middleware do next-intl). Escreve os cookies atualizados tanto no `request`
// (para o response já refletir a sessão renovada) quanto no `response` passado
// — nunca cria um NextResponse.next() novo aqui, para preservar o
// redirect/rewrite de locale que o next-intl já decidiu (exceto nos próprios
// redirects de autenticação abaixo, que substituem a decisão de locale por uma
// de acesso — copiando os cookies já renovados para a nova response).
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
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  const split = splitLocale(request.nextUrl.pathname);
  if (!split) {
    return response;
  }

  const isPublicPath = PUBLIC_PATHS.includes(split.path);
  const isLoginPath = split.path === "/login";

  if (!isAuthenticated && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = `/${split.locale}/login`;
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isLoginPath) {
    const url = request.nextUrl.clone();
    url.pathname = `/${split.locale}/dashboard`;
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
