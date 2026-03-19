import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Alertas",
  description: "Reporte agil de incidencias universitarias",
  manifest: "/manifest.webmanifest",
  applicationName: "Campus Alertas",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <header className="border-b border-white/60 bg-white/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="font-heading text-lg font-semibold text-emerald-900">
              Campus Alertas
            </Link>
            <nav className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <Link className="rounded-full px-3 py-1.5 hover:bg-emerald-100" href="/">
                Reportar
              </Link>
              <Link
                className="rounded-full bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800"
                href="/dashboard"
              >
                Dashboard
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
