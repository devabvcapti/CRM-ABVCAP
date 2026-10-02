import { getTranslations } from "next-intl/server";
import { locale } from "next/root-params";
import { redirect } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export default async function DashboardPage() {
  const currentLocale = await locale();
  const t = await getTranslations("DashboardPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale: currentLocale });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        {t("welcome", { email: user?.email ?? "" })}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("placeholder")}</p>
      <form action={logout.bind(null, currentLocale)}>
        <Button type="submit" variant="outline">
          {t("logout")}
        </Button>
      </form>
    </div>
  );
}
