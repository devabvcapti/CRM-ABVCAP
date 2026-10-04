// Cor de badge por nome de Tag — determinística (mesmo nome sempre cai na
// mesma cor em qualquer tela), sem coluna no banco nem UI de escolha (ver
// docs/superpowers specs/2026-10-03, decisão "automática por nome").
// Paleta de 8 cores do Tailwind já usado no projeto, deliberadamente SEM o
// verde (`--success`, já reservado pra indicar status "Ativo" em
// Organizações — uma tag verde seria lida como "ativo", não como categoria).
const TAG_COLOR_PALETTE = [
  "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300",
  "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300",
  "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-300",
  "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
] as const;

// FNV-1a (32-bit) — hash polinomial simples (hash*31+char) distribuía mal
// pra nomes com sufixo longo compartilhado (ex.: vários nomes terminando no
// mesmo timestamp em teste), colidindo a maioria num só índice da paleta.
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getTagColorClassName(name: string): string {
  const index = fnv1a(name) % TAG_COLOR_PALETTE.length;
  return TAG_COLOR_PALETTE[index];
}
