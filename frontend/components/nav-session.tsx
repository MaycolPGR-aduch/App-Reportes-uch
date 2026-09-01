"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/api-client";

type Estado = "COMPROBANDO" | "CON_SESION" | "SIN_SESION";

/**
 * Enlace de acceso en la barra superior.
 *
 * Hasta ahora la única forma de descubrir que el sistema tiene cuentas era
 * toparse con el selector dentro del formulario de reporte. Este enlace es la
 * señal que faltaba.
 *
 * Se oculta mientras se comprueba, en vez de mostrar "Iniciar sesion" por
 * omisión: aparecerlo y quitarlo un instante después es peor que esperar.
 */
export function NavSession() {
  const [estado, setEstado] = useState<Estado>("COMPROBANDO");
  const pathname = usePathname();

  useEffect(() => {
    let vigente = true;
    getCurrentUser()
      .then(() => vigente && setEstado("CON_SESION"))
      .catch(() => vigente && setEstado("SIN_SESION"));
    return () => {
      vigente = false;
    };
    // Se reevalúa al cambiar de página: así el enlace desaparece tras entrar
    // y vuelve tras cerrar sesión, sin recargar.
  }, [pathname]);

  // En las propias pantallas de acceso el enlace sobra.
  const enPantallaDeAcceso =
    pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";

  if (estado !== "SIN_SESION" || enPantallaDeAcceso) return null;

  return (
    <Link className="rounded-full px-3 py-1.5 hover:bg-emerald-100" href="/login">
      Iniciar sesion
    </Link>
  );
}
