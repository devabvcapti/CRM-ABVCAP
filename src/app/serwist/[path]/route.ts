import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Revisão usada para versionar o precache; cai para um UUID se o git não
// estiver disponível no ambiente de build (ex.: alguns runners de CI).
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ??
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: "/pt-BR", revision }],
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  });
