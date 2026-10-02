import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Casa com todos os caminhos, exceto os que começam com
  // /api, /trpc, /_next, /_vercel, ou contêm um ponto (ex.: favicon.ico).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
