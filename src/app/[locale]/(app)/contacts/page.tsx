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
// lista (editado manualmente) cai no default em vez de virar `.order()` com
// um nome de coluna arbitrário/inexistente.
const ALLOWED_SORT_COLUMNS = [DEFAULT_SORT] as const;

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

// Resolve os `contact_id` com vínculo ATUAL (end_date null) na Empresa dada
// — FK real (organization_contacts.org_id), sem passo de resolução prévia.
async function resolveOrgContactIds(supabase: SupabaseClient, orgId: string) {
  const { data } = await supabase
    .from("organization_contacts")
    .select("contact_id")
    .is("end_date", null)
    .eq("org_id", orgId);
  return (data ?? []).map((link) => link.contact_id);
}

// entity_tags é polimórfico (entity_type/entity_id) — sem FK pro PostgREST
// inferir o relacionamento, então resolve em dois passos sequenciais (nome →
// id da tag, depois id da tag → entity_id): tag inexistente vira "nenhum
// contato bate", não um erro.
async function resolveTagContactIds(supabase: SupabaseClient, tag: string) {
  const { data: tagRow } = await supabase
    .from("tags")
    .select("id")
    .eq("name", tag)
    .maybeSingle();
  if (!tagRow) return [];

  const { data } = await supabase
    .from("entity_tags")
    .select("entity_id")
    .eq("entity_type", "contact")
    .eq("tag_id", tagRow.id);
  return (data ?? []).map((link) => link.entity_id);
}

// Resolve a lista de `contact_id` candidatos ANTES da query paginada
// principal, combinando Empresa e Tag em AND (intersecção) entre si — mesma
// semântica client-side de hoje, só que como filtro de banco, nunca
// carregando a tabela inteira. `undefined` (nenhum dos dois filtros ativo)
// significa "sem filtro de id" — distinto de um array vazio, que significa
// "filtro ativo, zero contatos batem".
async function resolveContactIds(
  supabase: SupabaseClient,
  { orgId, tag }: { orgId?: string; tag?: string },
): Promise<string[] | undefined> {
  const [orgContactIds, tagContactIds] = await Promise.all([
    orgId ? resolveOrgContactIds(supabase, orgId) : Promise.resolve(undefined),
    tag ? resolveTagContactIds(supabase, tag) : Promise.resolve(undefined),
  ]);

  let ids: string[] | undefined;
  if (orgContactIds !== undefined) ids = orgContactIds;
  if (tagContactIds !== undefined) {
    ids = ids === undefined ? tagContactIds : ids.filter((id) => tagContactIds.includes(id));
  }
  return ids;
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
  const contactIds = await resolveContactIds(supabase, params);

  // `contactIds` resolvido e vazio (Empresa/Tag sem nenhum contato
  // correspondente) é uma resposta vazia garantida — pula a query principal
  // em vez de arriscar o comportamento de `.in("id", [])` no PostgREST.
  if (contactIds !== undefined && contactIds.length === 0) {
    return { contacts: [], totalCount: 0 };
  }

  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase.from("contacts").select("*", { count: "exact" });
  if (params.search) query = query.ilike("full_name", `%${params.search}%`);
  if (params.title) query = query.eq("title", params.title);
  if (contactIds !== undefined) query = query.in("id", contactIds);
  query = query.order(params.sort, { ascending: params.dir === "asc" }).range(from, to);

  const { data, count } = await query;
  return { contacts: data ?? [], totalCount: count ?? 0 };
}

// Catálogo COMPLETO de nomes de Tag anexadas a pelo menos um contato — nunca
// derivado da página carregada (ver Review Focus da spec).
async function queryTagOptions(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("entity_tags")
    .select("tags(name)")
    .eq("entity_type", "contact");
  return Array.from(
    new Set(
      (data ?? [])
        .map((link) => (link.tags as { name: string } | null)?.name)
        .filter((name): name is string => !!name),
    ),
  ).sort();
}

// Catálogo COMPLETO de valores de Cargo (`title`, texto livre, sem tabela
// própria) — payload leve (uma coluna só), sem paginação.
async function queryTitleOptions(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("contacts").select("title");
  return Array.from(
    new Set((data ?? []).map((row) => row.title).filter((title): title is string => !!title)),
  ).sort();
}

// Catálogo COMPLETO de Empresas com pelo menos um vínculo institucional
// atual (end_date null) — dedupe por id, nunca escopado aos contatos da
// página carregada.
async function queryCompanyOptions(
  supabase: SupabaseClient,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("organization_contacts")
    .select("organizations(id, name)")
    .is("end_date", null);
  return Array.from(
    new Map(
      (data ?? [])
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
  const pageSize = parsePositiveInt(paramToString(params.pageSize), DEFAULT_PAGE_SIZE);
  const rawSort = paramToString(params.sort);
  const sort = ALLOWED_SORT_COLUMNS.includes(rawSort as (typeof ALLOWED_SORT_COLUMNS)[number])
    ? (rawSort as (typeof ALLOWED_SORT_COLUMNS)[number])
    : DEFAULT_SORT;
  const dir = paramToString(params.dir) === "desc" ? "desc" : "asc";

  const supabase = await createClient();

  // Todas as queries abaixo são independentes entre si (a única dependência
  // real — resolver contactIds antes da query paginada — fica dentro de
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
