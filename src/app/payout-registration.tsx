"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Plus, Save, X } from "lucide-react";
import { registerPayout } from "@/lib/admin-api";
import type { WorkspaceStore } from "@/lib/store-api";

export function PayoutRegistration({
  accessToken,
  store,
  onSaved,
}: Readonly<{
  accessToken: string;
  store: WorkspaceStore | null;
  onSaved: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  function close() {
    if (pending) return;
    setOpen(false);
    setError("");
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!store || pending) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const formText = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    const amountText = formText("amount");
    const amountParts = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amountText);
    const reason = formText("reason").trim();
    const localDate = formText("scheduledAt");
    if (!amountParts) {
      setError("Ingresa un monto válido con hasta dos decimales.");
      return;
    }
    const amountInCents =
      Number(amountParts[1]) * 100 +
      Number((amountParts[2] ?? "").padEnd(2, "0"));
    if (
      !Number.isSafeInteger(amountInCents) ||
      amountInCents < 1 ||
      amountInCents > 2147483647
    ) {
      setError("El monto está fuera del rango permitido.");
      return;
    }
    setPending(true);
    setError("");
    setSuccess("");
    requestId.current ??= crypto.randomUUID();
    try {
      await registerPayout(accessToken, {
        requestId: requestId.current,
        storeId: store.id,
        amountInCents,
        ...(localDate
          ? { scheduledAt: new Date(localDate).toISOString() }
          : {}),
        reason,
      });
      requestId.current = null;
      formElement.reset();
      setOpen(false);
      setSuccess("Borrador de liquidación registrado.");
      onSaved();
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "No se pudo registrar el borrador.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="payout-registration">
      <button
        type="button"
        className="primary-button"
        disabled={!store}
        title={store ? "Registrar borrador" : "Selecciona una tienda"}
        onClick={() => {
          setError("");
          setSuccess("");
          setOpen(true);
        }}
      >
        <Plus size={17} /> Registrar liquidación
      </button>
      {success && <output>{success}</output>}
      <dialog
        ref={dialog}
        className="information-dialog payout-dialog"
        aria-labelledby="payout-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
      >
        <header>
          <div>
            <p className="eyebrow">Finanzas · {store?.displayName}</p>
            <h2 id="payout-dialog-title">Nueva liquidación</h2>
          </div>
          <button
            type="button"
            className="icon-button bordered"
            aria-label="Cerrar formulario"
            title="Cerrar"
            disabled={pending}
            onClick={close}
          >
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit} onInput={() => (requestId.current = null)}>
          <fieldset disabled={pending} className="payout-fields">
            <p className="payout-scope-note">
              Se guardará como borrador. No ejecuta transferencias ni calcula
              saldos.
            </p>
            <label className="field" htmlFor="payout-amount">
              <span>Monto (PEN)</span>
              <input
                id="payout-amount"
                name="amount"
                type="number"
                min="0.01"
                max="21474836.47"
                step="0.01"
                inputMode="decimal"
                required
              />
            </label>
            <label className="field" htmlFor="payout-scheduled-at">
              <span>Fecha programada (opcional)</span>
              <input
                id="payout-scheduled-at"
                name="scheduledAt"
                type="datetime-local"
              />
            </label>
            <label className="field" htmlFor="payout-reason">
              <span>Motivo</span>
              <textarea
                id="payout-reason"
                name="reason"
                required
                minLength={3}
                maxLength={255}
                rows={3}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="primary-button">
              <Save size={17} />
              {pending ? "Guardando..." : "Guardar borrador"}
            </button>
          </fieldset>
        </form>
      </dialog>
    </div>
  );
}
