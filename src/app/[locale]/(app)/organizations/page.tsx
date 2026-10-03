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
  query = query.order(params.sort, { ascending: params.dir === "asc" }).range(from, to);

  const { data, count } = await query;
  return { organizations: data ?? [], totalCount: count ?? 0 };
}

// Catálogo COMPLETO de valores de Setor (`priority_sectors`, array de texto
// livre, sem tabela própria) — payload leve (uma coluna só), sem paginação —
// nunca derivado da página carregada (mesmo raciocínio de `titleOptions` em
// Contatos, Tarefa 1). Tipo/Tier/Status não precisam de catálogo próprio:
// são enums fixos (ORG_TYPES/TIERS/STATUSES em constants.ts), não dados.
async function querySectorOptions(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("organizations").select("priority_sectors");
  return Array.from(new Set((data ?? []).flatMap((row) => row.priority_sectors))).sort();
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
