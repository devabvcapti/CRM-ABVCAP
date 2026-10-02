import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Wrappers de navegação do Next.js que já consideram o locale ativo.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
