import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PwaRegister } from "@/components/pwa-register";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { SessionSync } from "@/components/session-sync";
import { themeBootstrapScript } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Alertas",
  description: "Reporta y sigue incidencias del campus en menos de 30 segundos.",
  manifest: "/manifest.webmanifest",
  applicationName: "Campus Alertas",
};

export const viewport: Viewport = {
  // Un color por tema: la barra del navegador acompaña a la aplicación en vez
  // de quedarse en verde sobre una interfaz oscura.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a101c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className="h-full"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* `beforeInteractive` lo inyecta en el HTML inicial y lo ejecuta antes
            que cualquier módulo de Next, que es justo lo que hace falta para
            que el tema oscuro no pase por un fogonazo blanco. Un <script>
            suelto haría lo mismo, pero React avisa de que no se ejecuta al
            renderizar en cliente. */}
        <Script
          id="tema-inicial"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <PwaRegister />
        <SessionSync />
        <AppHeader />
        <div id="contenido" className="flex flex-1 flex-col">
          {children}
        </div>
        <AppFooter />
      </body>
    </html>
  );
}
