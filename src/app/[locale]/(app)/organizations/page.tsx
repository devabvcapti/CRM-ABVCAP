import { locale } from "next/root-params";
import type { PostgrestError } from "@supabase/supabase-js";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { OrganizationsTable, type OrganizationFilterState } from "./organizations-table";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Organization = Database["crm_abvcap"]["Tables"]["organizations"]["Row"];

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT = "name";
// Colunas ordenáveis em Organizações (ver organizations-table.tsx — os ids de
// coluna batem 1:1 com o nome da coluna no banco, mesmo raciocínio de
// `full_name` em Contatos: sem isso, `sort` da URL não poderia virar
// `.order()` direto). `sort` vem da URL, então um valor fora desta lista
// (editado manualmente) cai no default em vez de virar um `.order()` com um
// nome de coluna arbitrário/inexistente.
const ALLOWED_SORT_COLUMNS = ["name", "org_type", "tier", "status"] as const;
// Únicos valores que o seletor "itens por página" do `DataGridPagination`
// oferece (mesma allowlist de `entity-list-url-state.ts`, duplicada aqui de
// propósito — Server Component, não pode importar de um módulo "use
// client") — um `pageSize` de URL fora desta lista cai no default em vez de
// virar um `.range()` arbitrariamente grande.
const ALLOWED_PAGE_SIZES = [5, 10, 25, 50, 100] as const;
// Cap padrão do PostgREST (`max_rows`) por resposta — qualquer query SEM
// `.range()` sobre uma tabela que passe desse tamanho trunca silenciosamente.
// Usado como tamanho de lote pelo `fetchAllRows` abaixo (achado do code
// review final: o catálogo de Setor lia no máximo 1000 organizações,
// undercount silencioso na escala alvo do projeto, ~5 mil organizações).
const CATALOG_BATCH_SIZE = 1000;

// `searchParams` pode vir array se a mesma chave repetir na URL — só o
// primeiro valor importa aqui (mesmo comportamento de `useEntityListUrlState`
// no cliente, que também normaliza pra um valor só).
function paramToString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : fallback;
}

// Pagina exaustivamente sobre uma query que devolve no máximo
// `CATALOG_BATCH_SIZE` linhas por chamada (cap padrão do PostgREST) —
// `fetchPage` recebe o range de cada lote e deve devolver uma query NOVA a
// cada chamada (o query builder do supabase-js não é reutilizável depois de
// `await`); repete até um lote vir com menos linhas que o tamanho do lote
// (sinal de que chegou ao fim). Lança se qualquer lote vier com erro (Fix 3
// do review final — nunca engolir erro do Supabase, mesmo dentro de um
// helper de catálogo). Mesmo helper de contacts/page.tsx (Fix 2a/Tarefa 1),
// duplicado aqui de propósito — Server Component local, sem módulo
// compartilhado dedicado só pra isso. IMPORTANTE: toda chamada de
// `fetchPage` precisa incluir um `.order()` determinístico (ex.: `id`) —
// sem ordem explícita, Postgres não garante que `.range()` particiona a
// tabela de forma estável entre chamadas sucessivas (mesmo risco do Fix 4,
// mas aqui entre lotes da MESMA leitura exaustiva).
async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + CATALOG_BATCH_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < CATALOG_BATCH_SIZE) break;
    offset += CATALOG_BATCH_SIZE;
  }
  return rows;
}

async function queryOrganizations(
  supabase: SupabaseClient,
  params: {
    search?: string;
    orgType?: string;
    tier?: string;
    status?: string;
    sector?: string;
    page: number;
    pageSize: number;
    sort: (typeof ALLOWED_SORT_COLUMNS)[number];
    dir: "asc" | "desc";
  },
): Promise<{ organizations: Organization[]; totalCount: number }> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase.from("organizations").select("*", { count: "exact" });
  if (params.search) query = query.ilike("name", `%${params.search}%`);
  if (params.orgType) query = query.eq("org_type", params.orgType);
  if (params.tier) query = query.eq("tier", params.tier);
  if (params.status) query = query.eq("status", params.status);
  // `priority_sectors` é array nativo (text[]) — `.contains` com um array de
  // um elemento é a forma do PostgREST de perguntar "este array contém este
  // valor", sem precisar de coluna/view computada à parte.
  if (params.sector) query = query.contains("priority_sectors", [params.sector]);
  // Fix 4 do review final: tie-breaker determinístico (`id`) depois do sort
  // pedido — sem ele, `.order(sort)` sozinho + `.range()` não é estável
  // quando `sort` tem empates (ex.: muitas organizações com o mesmo
  // tier/status/org_type), podendo repetir ou pular linha entre páginas.
  query = query
    .order(params.sort, { ascending: params.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;
  return { organizations: data ?? [], totalCount: count ?? 0 };
}

// Catálogo COMPLETO de valores de Setor (`priority_sectors`, array de texto
// livre, sem tabela própria) — payload leve (uma coluna só) — nunca derivado
// da página carregada (mesmo raciocínio de `titleOptions` em Contatos,
// Tarefa 1). Pagina exaustivamente (Fix 2a do review final): sem isso,
// truncaria em 1000 organizações na escala alvo do projeto. Tipo/Tier/Status
// não precisam de catálogo próprio: são enums fixos (ORG_TYPES/TIERS/
// STATUSES em constants.ts), não dados.
async function querySectorOptions(supabase: SupabaseClient): Promise<string[]> {
  const rows = await fetchAllRows<{ priority_sectors: string[] }>((from, to) =>
    supabase
      .from("organizations")
      .select("priority_sectors")
      .order("id", { ascending: true })
      .range(from, to),
  );
  return Array.from(new Set(rows.flatMap((row) => row.priority_sectors))).sort();
}

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = paramToString(params.search);
  const orgType = paramToString(params.orgType);
  const tier = paramToString(params.tier);
  const status = paramToString(params.status);
  const sector = paramToString(params.sector);
  const page = parsePositiveInt(paramToString(params.page), DEFAULT_PAGE);
  const pageSize = parsePageSize(paramToString(params.pageSize), DEFAULT_PAGE_SIZE);
  const rawSort = paramToString(params.sort);
  const sort = (ALLOWED_SORT_COLUMNS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as (typeof ALLOWED_SORT_COLUMNS)[number])
    : DEFAULT_SORT;
  const dir = paramToString(params.dir) === "desc" ? "desc" : "asc";

  const supabase = await createClient();

  // Independentes entre si — rodam em paralelo, não em série, pra não
  // empilhar latência de rede por query numa única carga de página (mesmo
  // padrão de contacts/page.tsx, Tarefa 1).
  const [{ organizations, totalCount }, sectorOptions, savedFiltersResult] = await Promise.all([
    queryOrganizations(supabase, { search, orgType, tier, status, sector, page, pageSize, sort, dir }),
    querySectorOptions(supabase),
    // RLS de saved_filters já filtra por dono — não precisa de
    // .eq("user_profile_id", ...) aqui.
    supabase
      .from("saved_filters")
      .select("id, name, filter_state")
      .eq("entity_type", "organization")
      .order("name"),
  ]);

  // Fix 3 do review final: a query acima (fora de `queryOrganizations`, que
  // já lança por conta própria) descartava `error` silenciosamente — uma
  // falha virava "sem filtros salvos" em vez de um erro visível. O
  // `error.tsx` mais próximo cuida de renderizar a falha.
  if (savedFiltersResult.error) throw savedFiltersResult.error;

  // Fix 5 do review final: `page` fora do intervalo válido (URL
  // favoritada/compartilhada, ou um filtro que reduziu o total depois que a
  // URL foi montada) — redireciona pra última página válida em vez de
  // renderizar uma lista vazia sem explicação. `totalCount === 0` nunca cai
  // aqui (nenhuma página é "válida" quando não há nenhum registro).
  const from = (page - 1) * pageSize;
  if (totalCount > 0 && from >= totalCount) {
    const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentLocale = await locale();
    redirect({
      href: { pathname: "/organizations", query: { ...params, page: String(lastPage) } },
      locale: currentLocale,
    });
  }

  return (
    <OrganizationsTable
      organizations={organizations}
      totalCount={totalCount}
      sectorOptions={sectorOptions}
      // filter_state é Json no schema (genérico pra qualquer entidade) — o
      // formato real sempre bate com OrganizationFilterState pra
      // entity_type "organization", já que é o próprio saveFilter desta
      // página que grava esse shape.
      savedFilters={(savedFiltersResult.data ?? []).map((filter) => ({
        ...filter,
        filter_state: filter.filter_state as OrganizationFilterState,
      }))}
    />
  );
}
