"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cleanupPolymorphicReferences } from "@/lib/supabase/polymorphic-cleanup";
import { ORG_TYPES, TIERS, STATUSES } from "./constants";

const organizationSchema = z.object({
  name: z.string().min(1),
  legal_name: z.string().optional(),
  org_type: z.enum(ORG_TYPES),
  tier: z.enum(TIERS),
  priority_sectors: z.string().optional(),
  status: z.enum(STATUSES),
});

export type OrganizationFormState = {
  error: "required_name" | "required_type" | "required_tier" | "generic" | null;
  success?: boolean;
};

function parseForm(formData: FormData) {
  return organizationSchema.safeParse({
    name: formData.get("name"),
    legal_name: formData.get("legal_name") || undefined,
    org_type: formData.get("org_type"),
    tier: formData.get("tier"),
    priority_sectors: formData.get("priority_sectors") || undefined,
    status: formData.get("status") || "ativo",
  });
}

function toErrorState(
  error: ReturnType<typeof organizationSchema.safeParse>["error"],
): OrganizationFormState {
  const fieldErrors = error?.flatten().fieldErrors;
  if (fieldErrors?.name) return { error: "required_name" };
  if (fieldErrors?.org_type) return { error: "required_type" };
  if (fieldErrors?.tier) return { error: "required_tier" };
  return { error: "generic" };
}

function splitSectors(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((sector) => sector.trim())
    .filter(Boolean);
}

export async function createOrganization(
  _prevState: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return toErrorState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").insert({
    name: parsed.data.name,
    legal_name: parsed.data.legal_name ?? null,
    org_type: parsed.data.org_type,
    tier: parsed.data.tier,
    priority_sectors: splitSectors(parsed.data.priority_sectors),
    status: parsed.data.status,
  });

  if (error) return { error: "generic" };

  revalidatePath("/[locale]/organizations", "page");
  return { error: null, success: true };
}

export async function updateOrganization(
  id: string,
  _prevState: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return toErrorState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legal_name ?? null,
      org_type: parsed.data.org_type,
      tier: parsed.data.tier,
      priority_sectors: splitSectors(parsed.data.priority_sectors),
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) return { error: "generic" };

  revalidatePath("/[locale]/organizations", "page");
  return { error: null, success: true };
}

export async function deleteOrganization(id: string) {
  const supabase = await createClient();
  // organization_contacts.org_id tem FK real com ON DELETE CASCADE, mas
  // entity_tags/interaction_participants são polimórficos (sem FK) — ver
  // ai-context/skills/02-data-modeling.md.
  await cleanupPolymorphicReferences(supabase, "organization", id);
  await supabase.from("organizations").delete().eq("id", id);
  revalidatePath("/[locale]/organizations", "page");
}
