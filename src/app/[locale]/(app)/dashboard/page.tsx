import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/supabase/current-profile";

export default async function DashboardPage() {
  const t = await getTranslations("DashboardPage");
  const profile = await getCurrentProfile();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        {t("welcome", { email: profile?.name ?? "" })}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("placeholder")}</p>
    </div>
  );
}
