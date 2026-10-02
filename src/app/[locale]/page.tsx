import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function HomePage() {
  const t = useTranslations("HomePage");
  const target = t("switchLocaleTarget") as "pt-BR" | "en-US";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {t("title")}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("tagline")}</p>
      <p className="text-sm text-muted-foreground">{t("status")}</p>
      <Link
        href="/"
        locale={target}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("switchLocale")}
      </Link>
    </div>
  );
}
