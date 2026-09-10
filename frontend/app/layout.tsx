import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { PwaRegister } from "@/components/pwa-register";
import { AppHeader } from "@/components/app-header";
import { themeBootstrapScript } from "@/components/theme-toggle";
import "./globals.css";

/*
 * Tres cortes con un trabajo cada uno: Jakarta para titulares, Inter para
 * la interfaz y JetBrains para lo que se copia y se compara carácter a
 * carácter —identificadores de incidencia y coordenadas—. Las tres son
 * variables, así que pesan un archivo por familia y no uno por grosor.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
      className={`h-full ${inter.variable} ${jakarta.variable} ${jetbrains.variable}`}
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
        <AppHeader />
        <div id="contenido" className="flex flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
