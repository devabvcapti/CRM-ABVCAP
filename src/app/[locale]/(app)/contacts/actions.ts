"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  full_name: z.string().min(1),
  emails: z.string().optional(),
  phones: z.string().optional(),
  languages: z.string().optional(),
  linkedin_url: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export type ContactFormState = {
  error: "required_name" | "generic" | null;
  success?: boolean;
};

function splitList(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseForm(formData: FormData) {
  return contactSchema.safeParse({
    full_name: formData.get("full_name"),
    emails: formData.get("emails") || undefined,
    phones: formData.get("phones") || undefined,
    languages: formData.get("languages") || undefined,
    linkedin_url: formData.get("linkedin_url") || undefined,
    notes: formData.get("notes") || undefined,
    tags: formData.get("tags") || undefined,
  });
}

async function syncTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string,
  tagNames: string[],
) {
  await supabase
    .from("entity_tags")
    .delete()
    .eq("entity_type", "contact")
    .eq("entity_id", contactId);

  const names = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return;

  const { data: tagRows } = await supabase
    .from("tags")
    .upsert(
      names.map((name) => ({ name })),
      { onConflict: "organization_id,name" },
    )
    .select("id");

  if (!tagRows?.length) return;

  await supabase.from("entity_tags").insert(
    tagRows.map((tag) => ({
      tag_id: tag.id,
      entity_type: "contact",
      entity_id: contactId,
    })),
  );
}

export async function createContact(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: "required_name" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      full_name: parsed.data.full_name,
      emails: splitList(parsed.data.emails),
      phones: splitList(parsed.data.phones),
      languages: splitList(parsed.data.languages),
      linkedin_url: parsed.data.linkedin_url || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "generic" };

  await syncTags(supabase, data.id, splitList(parsed.data.tags));

  revalidatePath("/[locale]/contacts", "page");
  return { error: null, success: true };
}

export async function updateContact(
  id: string,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: "required_name" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: parsed.data.full_name,
      emails: splitList(parsed.data.emails),
      phones: splitList(parsed.data.phones),
      languages: splitList(parsed.data.languages),
      linkedin_url: parsed.data.linkedin_url || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "generic" };

  await syncTags(supabase, id, splitList(parsed.data.tags));

  revalidatePath("/[locale]/contacts", "page");
  return { error: null, success: true };
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", id);
  revalidatePath("/[locale]/contacts", "page");
}
