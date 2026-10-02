import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { locale } from "next/root-params";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const currentLocale = await locale();
  const t = await getTranslations("LoginPage");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border bg-card p-8 shadow-sm">
        <Image src="/logo.png" alt={t("title")} width={176} height={74} priority />
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="w-full">
          <LoginForm locale={currentLocale} />
        </div>
      </div>
    </div>
  );
}
