import { locale } from "next/root-params";
import type { PostgrestError } from "@supabase/supabase-js";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { ContactsTable, type ContactFilterState } from "./contacts-table";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Contact = Database["crm_abvcap"]["Tables"]["contacts"]["Row"];

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT = "full_name";
// Único campo ordenável em Contatos (ver spec — ordenação por E-mail
// removida, nunca substituída). `sort` vem da URL, então um valor fora desta
// lista (editado manualmente) cai no default em vez de virar um `.order()`
// com um nome de coluna arbitrário/inexistente.
const ALLOWED_SORT_COLUMNS = [DEFAULT_SORT] as const;
// Únicos valores que o seletor "itens por página" do `DataGridPagination`
// oferece (mesma allowlist de `entity-list-url-state.ts`, duplicada aqui de
// propósito — Server Component, não pode importar de um módulo "use
// client") — um `pageSize` de URL fora desta lista cai no default em vez de
// virar um `.range()` arbitrariamente grande.
const ALLOWED_PAGE_SIZES = [5, 10, 25, 50, 100] as const;
// Cap padrão do PostgREST (`max_rows`) por resposta — qualquer query SEM
// `.range()` sobre uma tabela/join que passe desse tamanho trunca
// silenciosamente. Usado como tamanho de lote pelo `fetchAllRows` abaixo
// (achado do code review final: catálogos de opção de filtro e a resolução
// de id de Tag liam no máximo 1000 linhas, undercount silencioso na escala
// alvo do projeto, ~5 mil contatos).
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
// helper de catálogo). IMPORTANTE: toda chamada de `fetchPage` precisa
// incluir um `.order()` determinístico (ex.: `id`) — sem ordem explícita,
// Postgres não garante que `.range()` particiona a tabela de forma estável
// entre chamadas sucessivas (mesmo risco do Fix 4, mas aqui entre lotes da
// MESMA leitura exaustiva, não entre páginas da UI — uma linha poderia ser
// pulada ou repetida entre lotes).

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

// entity_tags é polimórfico (entity_type/entity_id) — sem FK pro PostgREST
// inferir o relacionamento, então resolve em dois passos sequenciais (nome →
// id da tag, depois id da tag → entity_id): tag inexistente vira "nenhum
// contato bate", não um erro. O segundo passo pagina exaustivamente
// (`fetchAllRows`) — uma tag anexada a mais de 1000 contatos não pode
// truncar silenciosamente o resultado (Fix 2c do review final; permanece
// polimórfico de propósito, sem embedded-join — ver Fix 2b para o contraste
// com Empresa, que tem FK real).
async function resolveTagContactIds(supabase: SupabaseClient, tag: string): Promise<string[]> {
  const { data: tagRow, error: tagError } = await supabase
    .from("tags")
    .select("id")
    .eq("name", tag)
    .maybeSingle();
  if (tagError) throw tagError;
  if (!tagRow) return [];

  const rows = await fetchAllRows<{ entity_id: string }>((from, to) =>
    supabase
      .from("entity_tags")
      .select("entity_id")
      .eq("entity_type", "contact")
      .eq("tag_id", tagRow.id)
      .order("id", { ascending: true })
      .range(from, to),
  );
  return rows.map((row) => row.entity_id);
}

async function queryContacts(
  supabase: SupabaseClient,
  params: {
    search?: string;
    title?: string;
    orgId?: string;
    tag?: string;
    page: number;
    pageSize: number;
    sort: string;
    dir: "asc" | "desc";
  },
): Promise<{ contacts: Contact[]; totalCount: number }> {
  const tagContactIds = params.tag ? await resolveTagContactIds(supabase, params.tag) : undefined;

  // Tag resolvida e vazia (nenhum contato com essa tag) é uma resposta vazia
  // garantida — pula a query principal em vez de arriscar o comportamento de
  // `.in("id", [])` no PostgREST.
  if (tagContactIds !== undefined && tagContactIds.length === 0) {
    return { contacts: [], totalCount: 0 };
  }

  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  const ascending = params.dir === "asc";

  // Empresa: organization_contacts tem FK real pra contacts
  // (organization_contacts_contact_id_fkey) — filtro embutido via inner join
  // direto NESTA query (Fix 2b do review final), em vez de resolver uma
  // lista de ids antes (que caía no cap de 1000 linhas do PostgREST na
  // escala alvo do projeto, ~5 mil contatos, e gastava um round-trip
  // extra). `!inner` exclui contatos sem vínculo correspondente;
  // `.eq`/`.is` abaixo filtram pelas colunas do embed via dot-path —
  // sintaxe confirmada nos tipos desta versão do @supabase/postgrest-js
  // (exemplo "Querying referenced table with inner join" no pacote
  // instalado). Dois branches inteiros (em vez de um só `query` reatribuído
  // condicionalmente) porque o tipo de retorno de `.select()` muda com o
  // embed, e os filtros seguintes com dot-path só tipam no branch que tem o
  // embed — um único `let` de união quebraria a checagem de tipos do outro
  // branch.
  if (params.orgId) {
    let query = supabase
      .from("contacts")
      .select("*, organization_contacts!inner(org_id, end_date)", { count: "exact" })
      .eq("organization_contacts.org_id", params.orgId)
      .is("organization_contacts.end_date", null);
    if (params.search) query = query.ilike("full_name", `%${params.search}%`);
    if (params.title) query = query.eq("title", params.title);
    if (tagContactIds !== undefined) query = query.in("id", tagContactIds);
    // Fix 4 do review final: tie-breaker determinístico (`id`) depois do
    // sort pedido — sem ele, `.order(sort)` sozinho + `.range()` não é
    // estável quando `sort` tem empates (ex.: full_name duplicado), podendo
    // repetir ou pular linha entre páginas.
    query = query.order(params.sort, { ascending }).order("id", { ascending: true }).range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    return { contacts: data ?? [], totalCount: count ?? 0 };
  }

  let query = supabase.from("contacts").select("*", { count: "exact" });
  if (params.search) query = query.ilike("full_name", `%${params.search}%`);
  if (params.title) query = query.eq("title", params.title);
  if (tagContactIds !== undefined) query = query.in("id", tagContactIds);
  query = query.order(params.sort, { ascending }).order("id", { ascending: true }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;
  return { contacts: data ?? [], totalCount: count ?? 0 };
}

// Catálogo COMPLETO de nomes de Tag anexadas a pelo menos um contato — nunca
// derivado da página carregada (ver Review Focus da spec). Pagina
// exaustivamente (Fix 2a do review final): sem isso, truncaria em 1000
// vínculos contato-tag na escala alvo do projeto.
async function queryTagOptions(supabase: SupabaseClient): Promise<string[]> {
  const rows = await fetchAllRows<{ tags: { name: string } | null }>((from, to) =>
    supabase
      .from("entity_tags")
      .select("tags(name)")
      .eq("entity_type", "contact")
      .order("id", { ascending: true })
      .range(from, to),
  );
  return Array.from(
    new Set(
      rows
        .map((link) => (link.tags as { name: string } | null)?.name)
        .filter((name): name is string => !!name),
    ),
  ).sort();
}

// Catálogo COMPLETO de valores de Cargo (`title`, texto livre, sem tabela
// própria) — payload leve (uma coluna só). Pagina exaustivamente (Fix 2a):
// sem isso, truncaria em 1000 contatos na escala alvo do projeto.
async function queryTitleOptions(supabase: SupabaseClient): Promise<string[]> {
  const rows = await fetchAllRows<{ title: string | null }>((from, to) =>
    supabase.from("contacts").select("title").order("id", { ascending: true }).range(from, to),
  );
  return Array.from(
    new Set(rows.map((row) => row.title).filter((title): title is string => !!title)),
  ).sort();
}

// Catálogo COMPLETO de Empresas com pelo menos um vínculo institucional
// atual (end_date null) — dedupe por id, nunca escopado aos contatos da
// página carregada. Pagina exaustivamente (Fix 2a): sem isso, truncaria em
// 1000 vínculos contato-organização na escala alvo do projeto.
async function queryCompanyOptions(
  supabase: SupabaseClient,
): Promise<{ id: string; name: string }[]> {
  const rows = await fetchAllRows<{ organizations: { id: string; name: string } | null }>(
    (from, to) =>
      supabase
        .from("organization_contacts")
        .select("organizations(id, name)")
        .is("end_date", null)
        .order("id", { ascending: true })
        .range(from, to),
  );
  return Array.from(
    new Map(
      rows
        .map((link) => link.organizations as { id: string; name: string } | null)
        .filter((org): org is { id: string; name: string } => !!org)
        .map((org) => [org.id, org] as const),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = paramToString(params.search);
  const tag = paramToString(params.tag);
  const title = paramToString(params.title);
  const orgId = paramToString(params.orgId);
  const page = parsePositiveInt(paramToString(params.page), DEFAULT_PAGE);
  const pageSize = parsePageSize(paramToString(params.pageSize), DEFAULT_PAGE_SIZE);
  const rawSort = paramToString(params.sort);
  const sort = ALLOWED_SORT_COLUMNS.includes(rawSort as (typeof ALLOWED_SORT_COLUMNS)[number])
    ? (rawSort as (typeof ALLOWED_SORT_COLUMNS)[number])
    : DEFAULT_SORT;
  const dir = paramToString(params.dir) === "desc" ? "desc" : "asc";

  const supabase = await createClient();

  // Todas as queries abaixo são independentes entre si (a única dependência
  // real — resolver tagContactIds antes da query paginada — fica dentro de
  // `queryContacts`) — rodam em paralelo, não em série, pra não empilhar
  // latência de rede por query numa única carga de página.
  const [
    { contacts, totalCount },
    tagOptions,
    titleOptions,
    companyOptions,
    savedFiltersResult,
    organizationsResult,
  ] = await Promise.all([
    queryContacts(supabase, { search, title, orgId, tag, page, pageSize, sort, dir }),
    queryTagOptions(supabase),
    queryTitleOptions(supabase),
    queryCompanyOptions(supabase),
    // RLS de saved_filters já filtra por dono — não precisa de
    // .eq("user_profile_id", ...) aqui.
    supabase
      .from("saved_filters")
      .select("id, name, filter_state")
      .eq("entity_type", "contact")
      .order("name"),
    // Organizações existentes para o <Select> de Empresa do cadastro rápido
    // (ContactCreateForm) — nunca autocomplete com criação inline (spec,
    // "Fora de escopo").
    supabase.from("organizations").select("id, name").order("name", { ascending: true }),
  ]);

  // Fix 3 do review final: as duas queries acima (fora de `queryContacts`,
  // que já lança por conta própria) descartavam `error` silenciosamente —
  // uma falha virava "0 registros"/"sem filtros salvos" em vez de um erro
  // visível. O `error.tsx` mais próximo cuida de renderizar a falha.
  if (savedFiltersResult.error) throw savedFiltersResult.error;
  if (organizationsResult.error) throw organizationsResult.error;

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
      href: { pathname: "/contacts", query: { ...params, page: String(lastPage) } },
      locale: currentLocale,
    });
  }

  return (
    <ContactsTable
      contacts={contacts}
      totalCount={totalCount}
      tagOptions={tagOptions}
      titleOptions={titleOptions}
      companyOptions={companyOptions}
      organizations={organizationsResult.data ?? []}
      // filter_state é Json no schema (genérico pra qualquer entidade) — o
      // formato real sempre bate com ContactFilterState pra entity_type
      // "contact", já que é o próprio saveFilter desta página que grava esse
      // shape.
      savedFilters={(savedFiltersResult.data ?? []).map((filter) => ({
        ...filter,
        filter_state: filter.filter_state as ContactFilterState,
      }))}
    />
  );
}
