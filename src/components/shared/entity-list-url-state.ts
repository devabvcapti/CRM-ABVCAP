"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

// Contrato compartilhado entre Contatos e Organizações (Task 1/Task 2, ver
// docs/superpowers/specs/2026-10-03-server-side-list-pagination-design.md):
// filtro/busca/ordenação/paginação vivem na URL (searchParams), nunca em
// useState local — aplicar um filtro salvo ou trocar de página é só navegar
// pra uma URL nova. `page`/`pageSize` default fixos (1/10) porque são
// genéricos a qualquer lista; só `sort` varia por entidade (nome da coluna
// padrão), daí o parâmetro `defaults`.
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_DIR: "asc" | "desc" = "asc";
// Únicos valores que o seletor "itens por página" do `DataGridPagination`
// oferece (ver data-grid-pagination.tsx, `sizes` default) — qualquer outro
// valor de URL (editado à mão) cai no default em vez de virar um `.range()`
// arbitrariamente grande no servidor.
const ALLOWED_PAGE_SIZES: readonly number[] = [5, 10, 25, 50, 100];

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return ALLOWED_PAGE_SIZES.includes(parsed) ? parsed : fallback;
}

function parseDir(value: string | null): "asc" | "desc" {
  return value === "asc" || value === "desc" ? value : DEFAULT_DIR;
}

export function useEntityListUrlState<
  TFilterState extends Record<string, string | undefined>,
>(filterKeys: (keyof TFilterState & string)[], defaults: { sort: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Dependência por string (não pela referência do array) — quem chama
  // normalmente passa um array literal novo a cada render, o que recriaria
  // este useMemo sem necessidade a cada vez se dependêssemos da referência.
  const filterKeysKey = filterKeys.join(",");
  const filterState = useMemo(() => {
    const next = {} as TFilterState;
    for (const key of filterKeys) {
      const value = searchParams.get(key);
      // Ausente vira undefined, nunca string vazia — distingue "sem filtro"
      // de um filtro com valor "" (que não deveria existir, mas não é este
      // hook que decide isso).
      next[key] = (value === null ? undefined : value) as TFilterState[typeof key];
    }
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, filterKeysKey]);

  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const pageSize = parsePageSize(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  const sort = searchParams.get("sort") ?? defaults.sort;
  const dir = parseDir(searchParams.get("dir"));

  // "Latest known params" — espelha `searchParams` a cada render (via
  // effect, nunca lido durante o render) MAS é atualizado de forma
  // OTIMISTA e SÍNCRONA dentro do próprio `navigate` abaixo, logo depois de
  // montar `next`. Existe porque `searchParams` (via useSearchParams) só
  // reflete uma navegação DEPOIS que o Next confirma essa navegação (o que,
  // nesta página, exige um round-trip de Server Component/Supabase) — não
  // no mesmo tick do `router.push`. Sem esse ref, dois ou mais `navigate()`
  // disparados em sucessão rápida (ex.: dois cliques em <Select>s diferentes
  // antes do primeiro `router.push` comitar) construiriam `next` a partir do
  // MESMO `searchParams` desatualizado, e o último a comitar venceria
  // sozinho — apagando silenciosamente as mudanças dos que vieram antes.
  // Reproduzido em e2e/organizations.spec.ts ("filtros de tipo/tier/status/
  // setor combinam em AND..."): mesmo depois de updateFilterKey parar de
  // espalhar `filterState` (closure do COMPONENTE), três cliques rápidos em
  // três <Select>s ainda perdiam o do meio, porque a staleness também existe
  // um nível abaixo, no `searchParams` do PRÓPRIO hook. Usar este ref em vez
  // de `searchParams` resolve isso: cada chamada de `navigate` compõe sobre
  // o resultado da chamada ANTERIOR (que já atualizou o ref de forma
  // síncrona), não sobre a última URL confirmada pelo Next.
  const latestParamsRef = useRef<URLSearchParams>(new URLSearchParams(searchParams.toString()));
  useEffect(() => {
    latestParamsRef.current = new URLSearchParams(searchParams.toString());
  }, [searchParams]);

  // Navegação rasa (sem reload de documento completo) pra URL nova — base
  // para todos os setters abaixo. Omite do querystring qualquer valor que
  // caia no respectivo default (undefined ou ""), pra manter a URL limpa no
  // caso comum (sem filtro, página 1, ordenação padrão).
  const navigate = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(latestParamsRef.current.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      // Atualiza o ref JÁ AQUI (antes do `router.push`, que é assíncrono) —
      // é isso que faz a PRÓXIMA chamada de `navigate` (mesmo que dispare
      // antes desta navegação comitar) compor sobre este resultado, não
      // sobre o `searchParams` antigo. Ver comentário do ref acima.
      latestParamsRef.current = next;
      const query = next.toString();
      router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [pathname, router],
  );

  const setFilterState = useCallback(
    (next: TFilterState) => {
      const updates: Record<string, string | undefined> = { page: undefined };
      for (const key of filterKeys) {
        updates[key] = next[key];
      }
      navigate(updates);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKeysKey, navigate],
  );

  // Atualiza UM único filtro, navegando direto via `navigate` (URL viva via
  // `searchParams` reativo) em vez de passar por `setFilterState` com um
  // objeto `filterState` inteiro — que, se montado a partir de uma closure
  // obsoleta (ex.: handler de outro <Select> redefinido num render anterior),
  // sobrescreveria toda a URL com valores antigos pros demais filtros. Ver
  // bug reproduzido em e2e/organizations.spec.ts ("filtros de tipo/tier/
  // status/setor combinam em AND..."): dois cliques rápidos em dropdowns
  // diferentes, sem esperar o re-render entre eles, faziam o segundo clique
  // reverter o primeiro. `navigate` nunca lê/espalha esse snapshot — só o
  // key single passado aqui — então nunca pode regredir os outros filtros.
  const updateFilterKey = useCallback(
    (key: keyof TFilterState & string, value: string | undefined) => {
      navigate({ [key]: value, page: undefined });
    },
    [navigate],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      navigate({ page: nextPage === DEFAULT_PAGE ? undefined : String(nextPage) });
    },
    [navigate],
  );

  const setPageSize = useCallback(
    (size: number) => {
      // Defesa em profundidade: quem chama hoje só repassa um dos valores do
      // seletor (sempre válido), mas não custa não confiar cegamente.
      const validSize = ALLOWED_PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE;
      navigate({
        pageSize: validSize === DEFAULT_PAGE_SIZE ? undefined : String(validSize),
        page: undefined,
      });
    },
    [navigate],
  );

  const setSorting = useCallback(
    (nextSort: string, nextDir: "asc" | "desc") => {
      navigate({
        sort: nextSort === defaults.sort ? undefined : nextSort,
        dir: nextDir === DEFAULT_DIR ? undefined : nextDir,
        page: undefined,
      });
    },
    [defaults.sort, navigate],
  );

  return {
    filterState,
    page,
    pageSize,
    sort,
    dir,
    setFilterState,
    updateFilterKey,
    setPage,
    setPageSize,
    setSorting,
  };
}
