// Compartilhado entre actions.ts ("use server", só pode exportar funções
// async) e o form (client component) — por isso fica num arquivo à parte.
export const ORG_TYPES = [
  "fundo_pe",
  "fundo_vc",
  "investidor_institucional",
  "family_office",
  "orgao_regulador",
  "assessoria_parceira",
] as const;

export const TIERS = ["A", "B", "C"] as const;

export const STATUSES = ["ativo", "inativo"] as const;
