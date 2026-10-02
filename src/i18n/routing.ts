import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // pt-BR / en-US — ver ai-context/skills/05-i18n.md e ADR relacionados.
  locales: ["pt-BR", "en-US"],
  defaultLocale: "pt-BR",
});
