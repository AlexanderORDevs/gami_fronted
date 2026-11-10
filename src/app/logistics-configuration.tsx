"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { CalendarDays, Plus, Save, X } from "lucide-react";
import {
  createShippingRate,
  upsertCalendarDay,
  type CreateShippingRateInput,
  type InformationResource,
  type UpsertCalendarDayInput,
} from "@/lib/admin-api";

type ConfigurationResource = Extract<
  InformationResource,
  "calendar" | "shipping-rates"
>;

const formText = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

function calendarInput(form: FormData): UpsertCalendarDayInput {
  const description = formText(form, "description");
  return {
    date: formText(form, "date"),
    isWorkingDay: formText(form, "isWorkingDay") === "true",
    ...(description ? { description } : {}),
    reason: formText(form, "reason"),
  };
}

function shippingRateInput(form: FormData): CreateShippingRateInput {
  const amount = decimalToCents(formText(form, "rate"));
  if (amount === null)
    throw new Error("Ingresa una tarifa válida con hasta dos decimales.");
  const district = formText(form, "district");
  const maxItems = formText(form, "maxItems");
  const effectiveTo = formText(form, "effectiveTo");
  return {
    zoneType: formText(form, "zoneType") as CreateShippingRateInput["zoneType"],
    ...(district ? { district } : {}),
    minItems: Number(formText(form, "minItems")),
    ...(maxItems ? { maxItems: Number(maxItems) } : {}),
    rateInCents: amount,
    effectiveFrom: new Date(formText(form, "effectiveFrom")).toISOString(),
    ...(effectiveTo
      ? { effectiveTo: new Date(effectiveTo).toISOString() }
      : {}),
    reason: formText(form, "reason"),
  };
}

export function LogisticsConfiguration({
  accessToken,
  resource,
  onSaved,
}: Readonly<{
  accessToken: string;
  resource: ConfigurationResource;
  onSaved: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isCalendar = resource === "calendar";

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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError("");
    setSuccess("");
    try {
      if (isCalendar) {
        await upsertCalendarDay(accessToken, calendarInput(form));
      } else {
        await createShippingRate(accessToken, shippingRateInput(form));
      }
      formElement.reset();
      setOpen(false);
      setSuccess(
        isCalendar
          ? "Día de calendario guardado."
          : "Tarifa de envío registrada.",
      );
      onSaved();
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "No se pudo guardar la configuración.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="logistics-configuration">
      <button
        type="button"
        className="primary-button"
        onClick={() => {
          setError("");
          setSuccess("");
          setOpen(true);
        }}
      >
        {isCalendar ? <CalendarDays size={17} /> : <Plus size={17} />}
        {isCalendar ? "Registrar día" : "Registrar tarifa"}
      </button>
      {success && <output>{success}</output>}
      <dialog
        ref={dialog}
        className="information-dialog logistics-dialog"
        aria-labelledby="logistics-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
      >
        <header>
          <div>
            <p className="eyebrow">Configuración logística</p>
            <h2 id="logistics-dialog-title">
              {isCalendar ? "Calendario operativo" : "Tarifa de envío"}
            </h2>
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
          <fieldset disabled={pending} className="logistics-fields">
            {isCalendar ? (
              <>
                <label className="field" htmlFor="calendar-date">
                  <span>Fecha</span>
                  <input id="calendar-date" name="date" type="date" required />
                </label>
                <label className="field" htmlFor="calendar-working-day">
                  <span>Jornada</span>
                  <select
                    id="calendar-working-day"
                    name="isWorkingDay"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Selecciona la jornada
                    </option>
                    <option value="true">Día laborable</option>
                    <option value="false">Día no laborable</option>
                  </select>
                </label>
                <label className="field" htmlFor="calendar-description">
                  <span>Descripción (opcional)</span>
                  <input
                    id="calendar-description"
                    name="description"
                    maxLength={180}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="field" htmlFor="rate-zone">
                  <span>Zona</span>
                  <select id="rate-zone" name="zoneType" defaultValue="LIMA">
                    <option value="LIMA">Lima</option>
                    <option value="PROVINCE">Provincia</option>
                    <option value="AGENCY">Agencia</option>
                  </select>
                </label>
                <label className="field" htmlFor="rate-district">
                  <span>Distrito (opcional)</span>
                  <input
                    id="rate-district"
                    name="district"
                    minLength={2}
                    maxLength={100}
                    placeholder="Vacío para toda la zona"
                  />
                </label>
                <div className="logistics-range">
                  <label className="field" htmlFor="rate-min-items">
                    <span>Mínimo de prendas</span>
                    <input
                      id="rate-min-items"
                      name="minItems"
                      type="number"
                      min={1}
                      max={1000000}
                      step={1}
                      defaultValue={1}
                      required
                    />
                  </label>
                  <label className="field" htmlFor="rate-max-items">
                    <span>Máximo (opcional)</span>
                    <input
                      id="rate-max-items"
                      name="maxItems"
                      type="number"
                      min={1}
                      max={1000000}
                      step={1}
                    />
                  </label>
                </div>
                <label className="field" htmlFor="rate-amount">
                  <span>Tarifa (PEN)</span>
                  <input
                    id="rate-amount"
                    name="rate"
                    type="number"
                    min="0.01"
                    max="21474836.47"
                    step="0.01"
                    inputMode="decimal"
                    required
                  />
                </label>
                <div className="logistics-range">
                  <label className="field" htmlFor="rate-from">
                    <span>Vigente desde</span>
                    <input
                      id="rate-from"
                      name="effectiveFrom"
                      type="datetime-local"
                      required
                    />
                  </label>
                  <label className="field" htmlFor="rate-to">
                    <span>Vigente hasta (opcional)</span>
                    <input
                      id="rate-to"
                      name="effectiveTo"
                      type="datetime-local"
                    />
                  </label>
                </div>
              </>
            )}
            <label className="field" htmlFor="logistics-reason">
              <span>Motivo del cambio</span>
              <textarea
                id="logistics-reason"
                name="reason"
                minLength={3}
                maxLength={255}
                rows={3}
                required
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="primary-button">
              <Save size={17} /> {pending ? "Guardando..." : "Guardar"}
            </button>
          </fieldset>
        </form>
      </dialog>
    </div>
  );
}

function decimalToCents(value: string) {
  const parts = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!parts) return null;
  const amount =
    Number(parts[1]) * 100 + Number((parts[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 2147483647
    ? amount
    : null;
}
