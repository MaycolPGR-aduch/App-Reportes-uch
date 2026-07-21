"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void }) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    const render = () => {
      if (!containerRef.current || !window.turnstile || containerRef.current.childElementCount) return;
      window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (existing) {
      existing.addEventListener("load", render);
      render();
      return () => existing.removeEventListener("load", render);
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "true";
    script.addEventListener("load", render);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", render);
  }, [onToken, siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} aria-label="Verificación antiabuso" />;
}
