import type { Metadata } from "next";
import { Montserrat, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Fonte oficial da marca ABVCAP para mídia digital (guia de identidade visual
// autoriza Montserrat/Arial como substituto de Museo/Museo Sans na web).
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM ABVCAP",
  description: "CRM de inteligência de relacionamento institucional da ABVCAP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
