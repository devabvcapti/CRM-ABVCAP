import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRM ABVCAP",
    short_name: "CRM ABVCAP",
    description:
      "CRM de inteligência de relacionamento institucional da ABVCAP.",
    start_url: "/pt-BR",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#112468",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
