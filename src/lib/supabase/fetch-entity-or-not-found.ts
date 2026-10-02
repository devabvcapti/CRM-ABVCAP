import "server-only";
import type { createClient } from "./server";

// Achado real em CI (nunca reproduziu localmente): Supabase retorna
// data=null tanto para "a linha não existe" quanto para uma falha
// transiente de conexão/query — páginas de detalhe chamando notFound() só
// com base em `!data` tratam as duas situações como a mesma coisa,
// produzindo um 404 falso numa instabilidade de rede momentânea. Uma
// segunda tentativa resolve o caso transiente sem mascarar o caso real
// (linha genuinamente ausente continua null nas duas tentativas).
export async function fetchEntityOrNull<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "organizations" | "contacts",
  id: string,
): Promise<T | null> {
  const first = await supabase.from(table).select("*").eq("id", id).single();
  if (first.data) return first.data as T;
  console.error(`[fetchEntityOrNull] first attempt failed table=${table} id=${id}`, first.error);

  const retry = await supabase.from(table).select("*").eq("id", id).single();
  if (!retry.data) {
    console.error(`[fetchEntityOrNull] retry also failed table=${table} id=${id}`, retry.error);
  }
  return (retry.data as T) ?? null;
}
