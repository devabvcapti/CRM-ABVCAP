"use client";

import { useCallback, useMemo } from "react";
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

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  const sort = searchParams.get("sort") ?? defaults.sort;
  const dir = parseDir(searchParams.get("dir"));

  // Navegação rasa (sem reload de documento completo) pra URL nova — base
  // para todos os setters abaixo. Omite do querystring qualquer valor que
  // caia no respectivo default (undefined ou ""), pra manter a URL limpa no
  // caso comum (sem filtro, página 1, ordenação padrão).
  const navigate = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const query = next.toString();
      router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
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

  const setPage = useCallback(
    (nextPage: number) => {
      navigate({ page: nextPage === DEFAULT_PAGE ? undefined : String(nextPage) });
    },
    [navigate],
  );

  const setPageSize = useCallback(
    (size: number) => {
      navigate({
        pageSize: size === DEFAULT_PAGE_SIZE ? undefined : String(size),
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
    setPage,
    setPageSize,
    setSorting,
  };
}
