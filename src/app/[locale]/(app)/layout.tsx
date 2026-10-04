import { getTranslations } from "next-intl/server";
import { locale } from "next/root-params";
import { redirect } from "@/i18n/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentProfile } from "@/lib/supabase/current-profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currentLocale = await locale();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect({ href: "/login", locale: currentLocale });
  }

  const t = await getTranslations("AppShell");

  return (
    <SidebarProvider>
      <AppSidebar
        locale={currentLocale}
        navLabels={{
          dashboard: t("navDashboard"),
          organizations: t("navOrganizations"),
          contacts: t("navContacts"),
          tasks: t("navTasks"),
        }}
        profileName={profile?.name ?? ""}
        logoutLabel={t("logout")}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
