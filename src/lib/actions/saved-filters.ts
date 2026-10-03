"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-profile";

const saveFilterSchema = z.object({ name: z.string().trim().min(1).max(100) });

// entityType/filterState chegam via .bind() num client component
// (SavedFiltersControl) — client-originado, então revalidado aqui mesmo sem
// vir de FormData: um valor fora de "contact"/"organization", ou um
// filter_state com shape inesperado (ex.: valor não-string), não deve virar
// erro em runtime só na hora de reaplicar o filtro salvo.
const entityTypeSchema = z.enum(["contact", "organization"]);
const filterStateSchema = z.record(z.string(), z.string().max(200).optional());

export type SaveFilterState = {
  error: "required_name" | "duplicate_name" | "generic" | null;
  success?: boolean;
};

export async function saveFilter(
  entityType: "contact" | "organization",
  filterState: Record<string, string | undefined>,
  _prevState: SaveFilterState,
  formData: FormData,
): Promise<SaveFilterState> {
  const entityTypeParsed = entityTypeSchema.safeParse(entityType);
  const filterStateParsed = filterStateSchema.safeParse(filterState);
  if (!entityTypeParsed.success || !filterStateParsed.success) return { error: "generic" };

  const parsed = saveFilterSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "required_name" };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.from("saved_filters").insert({
    user_profile_id: profile.id,
    entity_type: entityTypeParsed.data,
    name: parsed.data.name,
    filter_state: filterStateParsed.data,
  });

  if (error?.code === "23505") return { error: "duplicate_name" };
  if (error) return { error: "generic" };

  revalidatePath("/[locale]/organizations", "page");
  revalidatePath("/[locale]/contacts", "page");
  return { error: null, success: true };
}

export async function deleteFilter(id: string): Promise<{ error: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from("saved_filters").delete().eq("id", id);
  if (error) return { error: true };
  revalidatePath("/[locale]/organizations", "page");
  revalidatePath("/[locale]/contacts", "page");
  return { error: false };
}
