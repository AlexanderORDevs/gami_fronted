"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Percent, Save, X } from "lucide-react";
import { getAdminInformation, setAgencyCommissionRate } from "@/lib/admin-api";

const SETTING_KEY = "commission_rate_basis_points_agency";

export function CommissionConfiguration({
  accessToken,
  revision,
  onSaved,
}: Readonly<{
  accessToken: string;
  revision: number;
  onSaved: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [rate, setRate] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void getAdminInformation(accessToken, "settings", 1, "", controller.signal)
      .then((page) => {
        const row = page.data.find((item) => item.key === SETTING_KEY);
        setCurrentRate(typeof row?.value === "number" ? row.value : null);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("No se pudo consultar la tasa vigente.");
      });
    return () => controller.abort();
  }, [accessToken, revision]);

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
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const percentage = Number(form.get("rate"));
    const reasonValue = form.get("reason");
    const reason = typeof reasonValue === "string" ? reasonValue.trim() : "";
    const rateBasisPoints = Math.round(percentage * 100);
    if (
      !Number.isFinite(percentage) ||
      rateBasisPoints / 100 !== percentage ||
      rateBasisPoints < 0 ||
      rateBasisPoints > 10000
    ) {
      setError("Ingresa una tasa entre 0% y 100%, con hasta dos decimales.");
      return;
    }
    if (reason.length < 3) {
      setError("Registra el motivo de la aprobación de Finanzas.");
      return;
    }
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await setAgencyCommissionRate(accessToken, { rateBasisPoints, reason });
      setCurrentRate(rateBasisPoints);
      setRate("");
      setOpen(false);
      setSuccess("Tasa de comisión guardada y auditada.");
      onSaved();
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "No se pudo guardar la tasa de comisión.",
      );
    } finally {
      setPending(false);
    }
  }

  const currentRateLabel =
    currentRate === null
      ? "Sin configurar"
      : `${(currentRate / 100).toLocaleString("es-PE", { maximumFractionDigits: 2 })}%`;

  return (
    <div className="commission-configuration">
      <div className="commission-current" aria-live="polite">
        <Percent size={17} />
        <span>Comisión AGENCY: {currentRateLabel}</span>
      </div>
      <button
        type="button"
        className="primary-button"
        onClick={() => {
          setError("");
          setSuccess("");
          setOpen(true);
        }}
      >
        <Percent size={17} />
        Configurar comisión
      </button>
      {success && <output>{success}</output>}
      {error && !open && <p role="alert">{error}</p>}
      <dialog
        ref={dialog}
        className="information-dialog commission-dialog"
        aria-labelledby="commission-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
      >
        <header>
          <div>
            <p className="eyebrow">Configuración financiera</p>
            <h2 id="commission-dialog-title">Comisión de agencia</h2>
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
        <form onSubmit={submit}>
          <fieldset disabled={pending} className="commission-fields">
            <p className="commission-scope-note">
              La clienta mantiene el precio publicado. La comisión se descuenta
              del subtotal que corresponde a la tienda y se guarda como tasa en
              cada nueva orden. Los pedidos existentes no se recalculan.
            </p>
            <label className="field" htmlFor="agency-commission-rate">
              <span>Tasa aprobada (%)</span>
              <input
                id="agency-commission-rate"
                name="rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={rate}
                onChange={(event) => setRate(event.currentTarget.value)}
                required
              />
            </label>
            <label className="field" htmlFor="agency-commission-reason">
              <span>Motivo de aprobación</span>
              <textarea
                id="agency-commission-reason"
                name="reason"
                minLength={3}
                maxLength={255}
                rows={3}
                required
              />
            </label>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <footer>
            <button
              type="button"
              className="secondary-button"
              disabled={pending}
              onClick={close}
            >
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={pending}>
              <Save size={16} />
              Guardar tasa
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
