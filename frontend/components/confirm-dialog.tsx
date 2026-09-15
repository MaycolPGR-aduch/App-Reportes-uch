"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";

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
 *
 * Se apoya en `<dialog>` con `showModal()`, que trae de serie lo que la
 * versión anterior —un `div` con `role="dialog"`— tenía que imitar y no
 * imitaba del todo: retiene el tabulador dentro, cierra con Escape desde
 * cualquier punto y devuelve el foco a donde estaba al terminar.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const confirm = useCallback(
    (request: ConfirmRequest) =>
      new Promise<boolean>((resolve) => setPending({ ...request, resolve })),
    [],
  );

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (pending && !element.open) element.showModal();
    if (!pending && element.open) element.close();
  }, [pending]);

  // Se recrea en cada render junto con el diálogo, así que no necesita ser
  // estable y puede leer `pending` directamente.
  const settle = (accepted: boolean) => {
    pending?.resolve(accepted);
    setPending(null);
  };

  const dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-title"
      // Escape dispara `cancel`; se trata como una negativa, igual que pulsar
      // «Cancelar», para que la promesa nunca se quede sin resolver.
      onCancel={(event) => {
        event.preventDefault();
        settle(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) settle(false);
      }}
      className="m-auto w-[min(100%-2rem,28rem)] rounded-card border border-line bg-overlay p-0 text-body shadow-lg backdrop:bg-[var(--scrim)]"
    >
      {pending ? (
        <div className="grid gap-3 p-5">
          <h2 id="confirm-title" className="font-display text-lg font-bold text-ink">
            {pending.title}
          </h2>
          <p className="text-sm text-body">{pending.message}</p>
          {pending.warning ? <Alert tone="warning">{pending.warning}</Alert> : null}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => settle(false)}>
              Cancelar
            </Button>
            <Button
              autoFocus
              variant={pending.danger ? "danger" : "primary"}
              onClick={() => settle(true)}
            >
              {pending.confirmLabel ?? "Confirmar"}
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );

  return { confirm, dialog };
}
