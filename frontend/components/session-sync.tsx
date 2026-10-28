"use client";

import { useEffect } from "react";

/** Otra pestaña cambió la cookie compartida: no conservar datos del usuario anterior. */
export function SessionSync() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "campus-session-change") window.location.reload();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
  return null;
}
