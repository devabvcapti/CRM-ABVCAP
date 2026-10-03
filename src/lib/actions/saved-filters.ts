"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-profile";

const saveFilterSchema = z.object({ name: z.string().min(1) });

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
  const parsed = saveFilterSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "required_name" };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.from("saved_filters").insert({
    user_profile_id: profile.id,
    entity_type: entityType,
    name: parsed.data.name,
    filter_state: filterState,
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
