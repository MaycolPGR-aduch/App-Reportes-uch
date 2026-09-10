"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, type UserRole } from "@/lib/api-client";
import { roleLabels } from "@/lib/labels";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClasses, cx } from "@/components/ui";

type Session = { role: UserRole; name: string } | null;
type State = "CHECKING" | "READY";

/** A dónde lleva «Mi panel» según quién ha entrado. */
const PANEL_HREF: Record<UserRole, string> = {
  STUDENT: "/dashboard",
  STAFF: "/dashboard/staff",
  ADMIN: "/dashboard/admin",
};

/**
 * Barra superior.
 *
 * Antes mostraba «Dashboard» a todo el mundo, incluso sin sesión, y llevaba a
 * una pantalla que rebotaba al login. Ahora los enlaces dependen del rol, y
 * mientras se comprueba la sesión no se enseña ninguno: un enlace que aparece
 * y desaparece medio segundo después despista más que esperar.
 */
export function AppHeader() {
  const [session, setSession] = useState<Session>(null);
  const [state, setState] = useState<State>("CHECKING");
  const pathname = usePathname();

  useEffect(() => {
    let current = true;
    getCurrentUser()
      .then((user) => {
        if (!current) return;
        setSession({ role: user.role, name: user.full_name });
        setState("READY");
      })
      .catch(() => {
        if (!current) return;
        setSession(null);
        setState("READY");
      });
    return () => {
      current = false;
    };
    // Se reevalúa al navegar: así la barra refleja el login o el cierre de
    // sesión sin necesidad de recargar la página.
  }, [pathname]);

  const onAuthScreen = ["/login", "/register", "/forgot-password", "/reset-password"].includes(
    pathname,
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display font-semibold text-ink">
          <Logo />
          <span className="hidden sm:inline">Campus Alertas</span>
        </Link>

        <nav aria-label="Principal" className="ml-auto flex items-center gap-1">
          <NavLink href="/" active={pathname === "/"}>
            Reportar
          </NavLink>

          {state === "READY" && session ? (
            <>
              <NavLink
                href={PANEL_HREF[session.role]}
                active={pathname.startsWith("/dashboard")}
              >
                Mi panel
              </NavLink>
              <NavLink href="/profile" active={pathname === "/profile"}>
                <span className="sm:hidden">Cuenta</span>
                <span className="hidden sm:inline">Mi cuenta</span>
              </NavLink>
              <span className="ml-1 hidden rounded-full bg-sunken px-2.5 py-1 text-[0.7rem] font-semibold text-muted lg:inline">
                {roleLabels[session.role]}
              </span>
            </>
          ) : null}

          {state === "READY" && !session && !onAuthScreen ? (
            <Link href="/login" className={buttonClasses("primary", "sm", "ml-1")}>
              Iniciar sesión
            </Link>
          ) : null}
        </nav>

        <div className="ml-1 border-l border-line pl-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand-soft text-brand-text" : "text-muted hover:bg-sunken hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-brand" aria-hidden="true" fill="none">
      <path
        d="M12 2.6 3.4 6.4v5.9c0 4.6 3.4 8.3 8.6 9.1 5.2-.8 8.6-4.5 8.6-9.1V6.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 7.8v4.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="15.7" r="1.05" fill="currentColor" />
    </svg>
  );
}
