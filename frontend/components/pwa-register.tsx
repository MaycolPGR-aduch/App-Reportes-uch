"use client";

import { useEffect } from "react";

/**
 * Registra el service worker que da soporte sin conexión.
 *
 * En desarrollo no se registra, y además se retira el que hubiera quedado de
 * una sesión anterior: su caché responde antes que la red a los chunks de
 * `/_next/`, así que un cambio en el código se ve en el editor y no en el
 * navegador, con la página sirviendo la versión anterior sin avisar.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registros) => Promise.all(registros.map((registro) => registro.unregister())))
        .catch(() => undefined);
      return;
    }

    const onLoad = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Entornos sin soporte: la aplicación funciona igual, sin modo offline.
      }
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
