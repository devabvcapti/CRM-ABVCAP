import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { fetchEntityOrNull } from "@/lib/supabase/fetch-entity-or-not-found";
import { InteractionsTimeline, type InteractionRow } from "@/components/shared/interactions-timeline";
import { ContactLinks, type ContactLinkRow } from "../contact-links";
import { OrganizationEditDelete } from "./organization-edit-delete";
import type { Database } from "@/types/database";

type Organization = Database["crm_abvcap"]["Tables"]["organizations"]["Row"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function toPascalCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("OrganizationsPage");
  const supabase = await createClient();

  const organization = await fetchEntityOrNull<Organization>(supabase, "organizations", id);
  if (!organization) notFound();

  const [{ data: contactLinks }, { data: contacts }, { data: participantRows }] =
    await Promise.all([
      supabase
        .from("organization_contacts")
        .select("id, contact_id, role, start_date, end_date, contacts(full_name)")
        .eq("org_id", id)
        .order("start_date", { ascending: false }),
      supabase.from("contacts").select("id, full_name").order("full_name", { ascending: true }),
      supabase
        .from("interaction_participants")
        .select("interactions(id, type, occurred_at, summary, classification_level)")
        .eq("participant_type", "organization")
        .eq("participant_id", id),
    ]);

  const links: ContactLinkRow[] = (contactLinks ?? []).map((link) => ({
    id: link.id,
    contact_id: link.contact_id,
    contact_name: (link.contacts as { full_name: string } | null)?.full_name ?? "",
    role: link.role,
    start_date: link.start_date,
    end_date: link.end_date,
  }));

  const contactOptions = (contacts ?? []).map((contact) => ({
    id: contact.id,
    name: contact.full_name,
  }));

  const interactions: InteractionRow[] = (participantRows ?? [])
    .map((row) => row.interactions as InteractionRow | null)
    .filter((interaction): interaction is InteractionRow => Boolean(interaction))
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback>{initials(organization.name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{organization.name}</h1>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">{t(`type${toPascalCase(organization.org_type)}`)}</Badge>
              <Badge variant="outline">{organization.tier}</Badge>
              <Badge variant={organization.status === "ativo" ? "default" : "secondary"}>
                {t(`status${toPascalCase(organization.status)}`)}
              </Badge>
            </div>
          </div>
        </div>
        <OrganizationEditDelete organization={organization} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <InteractionsTimeline
            participantType="organization"
            participantId={id}
            interactions={interactions}
          />
        </div>
        <div className="flex w-full flex-col gap-6 lg:w-80">
          <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
            {organization.legal_name && (
              <>
                <h3 className="mb-1 text-sm font-medium text-foreground">
                  {t("fieldLegalName")}
                </h3>
                <span>{organization.legal_name}</span>
              </>
            )}
            <h3 className="mt-2 mb-1 text-sm font-medium text-foreground">
              {t("fieldSectors")}
            </h3>
            {organization.priority_sectors?.length ? (
              <div className="flex flex-wrap gap-1">
                {organization.priority_sectors.map((sector) => (
                  <Badge key={sector} variant="outline">
                    {sector}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>

          <ContactLinks orgId={id} links={links} contacts={contactOptions} />
        </div>
      </div>
    </div>
  );
}
