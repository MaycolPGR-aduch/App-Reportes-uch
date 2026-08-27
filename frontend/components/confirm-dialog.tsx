"use client";

import { useCallback, useState } from "react";

export type ConfirmRequest = {
  title: string;
  /** Qué se va a hacer exactamente, en una frase. */
  message: string;
  /** Consecuencia que el usuario debería conocer antes de aceptar. */
  warning?: string;
  confirmLabel?: string;
  /** Marca la acción como destructiva o difícil de revertir. */
  danger?: boolean;
};

type PendingConfirm = ConfirmRequest & { resolve: (accepted: boolean) => void };

/**
 * Confirmación en forma de promesa: `if (!(await confirm({...}))) return;`
 *
 * Se prefiere a `window.confirm` porque el diálogo nativo no admite formato,
 * no distingue una acción destructiva de una rutinaria y algunos navegadores
 * lo suprimen tras varios usos seguidos.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (request: ConfirmRequest) =>
      new Promise<boolean>((resolve) => setPending({ ...request, resolve })),
    [],
  );

  // Se recrea en cada render junto con el diálogo, así que no necesita ser
  // estable y puede leer `pending` directamente.
  const settle = (accepted: boolean) => {
    pending?.resolve(accepted);
    setPending(null);
  };

  const dialog = pending ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) settle(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") settle(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl">
        <h2 id="confirm-title" className="font-heading text-lg font-semibold text-emerald-950">
          {pending.title}
        </h2>
        <p className="mt-2 text-sm text-slate-700">{pending.message}</p>
        {pending.warning ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {pending.warning}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => settle(false)}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => settle(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              pending.danger ? "bg-red-700 hover:bg-red-800" : "bg-emerald-700 hover:bg-emerald-800"
            }`}
          >
            {pending.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
