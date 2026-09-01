"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrentUser, UserRole, getCurrentUser, logout } from "@/lib/api-client";
import { StudentIncidentsFeed } from "@/components/student-incidents-feed";

export default function DashboardPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setRole(user.role);
        setUser(user);
        if (user.role === "STAFF") router.replace("/dashboard/staff");
        if (user.role === "ADMIN") router.replace("/dashboard/admin");
      })
      // Sin sesion valida no hay nada que mostrar aqui: el acceso vive en
      // /login, y `next` trae de vuelta a quien queria entrar al panel.
      .catch(() => router.replace("/login?next=/dashboard"));
  }, [router]);

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    router.replace("/login");
  };

  if (role === "STUDENT" && user) {
    return <StudentIncidentsFeed fullName={user.full_name} onLogout={handleLogout} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-12">
      <p className="text-sm text-slate-600">Abriendo tu panel…</p>
    </main>
  );
}
