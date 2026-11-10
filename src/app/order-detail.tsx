"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  RefreshCw,
  Save,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  INCIDENT_LABELS,
  ORDER_STATUS_LABELS,
  orderPath,
  staffOrderRequest,
  type ManagedOrder,
  type ManagedSuborder,
  type OrderIncident,
  type OrderRequest,
} from "@/lib/order-api";
import "./order-detail.css";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operación.";
const date = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(
    cents / 100,
  );
const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "Orden registrada",
  CHECKOUT_ORDER_CREATED: "Orden registrada desde el catálogo",
  STORE_ORDER_CONFIRMED: "Disponibilidad de la tienda confirmada",
  ORDER_INCIDENT_REPORTED: "Incidencia reportada",
  ORDER_INCIDENT_REVIEWED: "Incidencia revisada por administración",
};

export function OrderDetailDialog({
  accessToken,
  orderNumber,
  onClose,
  onChanged,
}: Readonly<{
  accessToken: string;
  orderNumber: string;
  onClose: () => void;
  onChanged: () => void;
}>) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="order-detail-dialog"
      aria-labelledby="managed-order-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">Seguimiento de orden</p>
          <h2 id="managed-order-title">{orderNumber}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Cerrar orden"
          aria-label="Cerrar orden"
          disabled={pending}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <OrderDetailPanel
        orderNumber={orderNumber}
        request={staffOrderRequest(accessToken)}
        onChanged={onChanged}
        onPending={setPending}
      />
    </dialog>
  );
}

export function OrderDetailPanel({
  orderNumber,
  request,
  onBack,
  onChanged,
  onPending,
}: Readonly<{
  orderNumber: string;
  request: OrderRequest;
  onBack?: () => void;
  onChanged?: () => void;
  onPending?: (pending: boolean) => void;
}>) {
  const [detail, setDetail] = useState<ManagedOrder | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  const load = useEffectEvent((signal: AbortSignal) =>
    request<ManagedOrder>(orderPath(orderNumber), "GET", undefined, signal),
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setDetail(result);
          setError("");
        }
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(message(error_));
      });
    return () => controller.abort();
  }, [orderNumber, revision]);
  async function change(
    path: string,
    input: object,
    resultMessage: string,
    method = "POST",
  ) {
    if (pending) return false;
    setPending(true);
    onPending?.(true);
    setError("");
    setSuccess("");
    try {
      await request(path, method, input);
      const next = await request<ManagedOrder>(orderPath(orderNumber));
      setDetail(next);
      setSuccess(resultMessage);
      onChanged?.();
      return true;
    } catch (error_) {
      setError(message(error_));
      return false;
    } finally {
      setPending(false);
      onPending?.(false);
    }
  }
  return (
    <section
      className="order-detail-panel"
      aria-label={`Detalle de ${orderNumber}`}
    >
      <div className="order-detail-toolbar">
        {onBack && (
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={onBack}
          >
            <ArrowLeft size={17} />
            Mis órdenes
          </button>
        )}
        <button
          type="button"
          className="icon-button bordered"
          title="Actualizar orden"
          aria-label="Actualizar orden"
          disabled={pending}
          onClick={() => {
            setError("");
            setRevision((value) => value + 1);
          }}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {error && (
        <p role="alert" className="order-detail-error">
          {error}
        </p>
      )}
      {success && <output className="order-detail-success">{success}</output>}
      {!detail && !error && <output>Cargando detalle de orden...</output>}
      {detail && (
        <>
          <div className="order-detail-summary">
            <div>
              <h3>{detail.orderNumber}</h3>
              {detail.status && (
                <p className="order-state">
                  {ORDER_STATUS_LABELS[detail.status] ?? detail.status}
                </p>
              )}
              <p>{date(detail.createdAt)}</p>
              <p>
                {detail.paymentVerified
                  ? "Pago verificado"
                  : "Pendiente de pago verificado"}
              </p>
            </div>
            <dl>
              <div>
                <dt>
                  {detail.scope === "store"
                    ? "Subtotal de tu tienda"
                    : "Prendas"}
                </dt>
                <dd>{money(detail.subtotalInCents, detail.currency)}</dd>
              </div>
              {detail.shippingInCents !== null && (
                <div>
                  <dt>Envío</dt>
                  <dd>{money(detail.shippingInCents, detail.currency)}</dd>
                </div>
              )}
              {detail.discountInCents !== null &&
                detail.discountInCents > 0 && (
                  <div>
                    <dt>Descuento</dt>
                    <dd>{money(detail.discountInCents, detail.currency)}</dd>
                  </div>
                )}
              {detail.scope !== "store" && (
                <div>
                  <dt>Importe original</dt>
                  <dd>{money(detail.totalInCents, detail.currency)}</dd>
                </div>
              )}
            </dl>
          </div>
          {detail.customer && detail.shippingAddress && (
            <section className="order-delivery">
              <h3>Contacto y entrega</h3>
              <div>
                <p>
                  <strong>{detail.customer.fullName}</strong>
                  <br />
                  {detail.customer.phone}
                  <br />
                  {detail.customer.email}
                </p>
                <p>
                  <strong>{detail.shippingAddress.recipientName}</strong>
                  <br />
                  {detail.shippingAddress.recipientPhone}
                  <br />
                  {detail.shippingAddress.line1}
                  <br />
                  {[
                    detail.shippingAddress.district,
                    detail.shippingAddress.city,
                    detail.shippingAddress.agency,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {detail.shippingAddress.reference && (
                    <>
                      <br />
                      {detail.shippingAddress.reference}
                    </>
                  )}
                </p>
              </div>
            </section>
          )}
          {detail.suborders.map((suborder) => (
            <Suborder
              key={suborder.id}
              suborder={suborder}
              detail={detail}
              pending={pending}
              change={change}
            />
          ))}
          <section className="order-timeline">
            <h3>Historial</h3>
            {!detail.timeline.length && <p>Sin eventos registrados.</p>}
            <ol>
              {detail.timeline.map((event, index) => (
                <li key={`${event.occurredAt}:${index}`}>
                  <strong>{EVENT_LABELS[event.action] ?? event.action}</strong>
                  <time dateTime={event.occurredAt}>
                    {date(event.occurredAt)}
                  </time>
                  {event.reason && <p>{event.reason}</p>}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </section>
  );
}

type ChangeOrder = (
  path: string,
  input: object,
  resultMessage: string,
  method?: string,
) => Promise<boolean>;
function Suborder({
  suborder,
  detail,
  pending,
  change,
}: Readonly<{
  suborder: ManagedSuborder;
  detail: ManagedOrder;
  pending: boolean;
  change: ChangeOrder;
}>) {
  const [action, setAction] = useState<"confirm" | "incident" | null>(null);
  return (
    <section className="order-suborder">
      <header>
        <div>
          <h3>{suborder.storeName}</h3>
          <p className="order-state">
            {ORDER_STATUS_LABELS[suborder.status] ?? suborder.status}
          </p>
        </div>
        <strong>{money(suborder.subtotalInCents, detail.currency)}</strong>
      </header>
      <section
        className="order-items"
        aria-label={`Prendas de ${suborder.storeName}`}
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Prenda</th>
              <th>Talla / color</th>
              <th>Solicitadas</th>
              <th>Confirmadas</th>
              <th>Precio unitario</th>
            </tr>
          </thead>
          <tbody>
            {suborder.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}</td>
                <td>
                  {item.sizeLabel} / {item.color}
                </td>
                <td>{item.quantity}</td>
                <td>{item.confirmedQuantity ?? "Pendiente"}</td>
                <td>{money(item.unitPriceInCents, detail.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {detail.scope !== "customer" && (
        <>
          <div className="order-action-row">
            <button
              type="button"
              className="primary-button"
              disabled={pending || !suborder.canConfirm}
              title={suborder.confirmationBlock ?? "Confirmar disponibilidad"}
              onClick={() => setAction("confirm")}
            >
              <ClipboardCheck size={17} />
              Confirmar prendas
            </button>
            {suborder.canReportIncident && (
              <button
                type="button"
                className="secondary-button"
                disabled={pending}
                onClick={() => setAction("incident")}
              >
                <TriangleAlert size={17} />
                Reportar incidencia
              </button>
            )}
          </div>
          {suborder.confirmationBlock && (
            <p className="order-block-reason">{suborder.confirmationBlock}</p>
          )}
        </>
      )}
      {action && (
        <DecisionForm
          key={`${suborder.id}:${suborder.updatedAt}:${action}`}
          kind={action}
          suborder={suborder}
          pending={pending}
          onCancel={() => setAction(null)}
          onSubmit={async (input) => {
            if (
              await change(
                `/order-management/store-orders/${suborder.id}/${action === "confirm" ? "confirm" : "incidents"}`,
                input,
                action === "confirm"
                  ? "Disponibilidad registrada."
                  : "Incidencia registrada para revisión.",
              )
            )
              setAction(null);
          }}
        />
      )}
      <div className="order-incidents">
        <h4>Incidencias</h4>
        {!suborder.incidents.length && <p>Sin incidencias registradas.</p>}
        {suborder.incidents.map((incident) => (
          <Incident
            key={incident.id}
            incident={incident}
            suborder={suborder}
            canReview={detail.canReviewIncidents}
            pending={pending}
            change={change}
          />
        ))}
      </div>
    </section>
  );
}

function DecisionForm({
  kind,
  suborder,
  pending,
  onCancel,
  onSubmit,
}: Readonly<{
  kind: "confirm" | "incident";
  suborder: ManagedSuborder;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: object) => Promise<void>;
}>) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      suborder.items.map((item) => [
        item.id,
        kind === "confirm" ? item.quantity : 0,
      ]),
    ),
  );
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const missing = suborder.items.reduce(
    (total, item) => total + item.quantity - quantities[item.id],
    0,
  );
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reason = data.get("reason");
    const type = data.get("type");
    const base = {
      expectedUpdatedAt: suborder.updatedAt,
      reason: typeof reason === "string" ? reason.trim() : "",
    };
    if (kind === "confirm")
      void onSubmit({
        ...base,
        items: suborder.items.map((item) => ({
          orderItemId: item.id,
          confirmedQuantity: quantities[item.id],
        })),
      });
    else {
      const items = suborder.items
        .filter((item) => quantities[item.id] > 0)
        .map((item) => ({
          orderItemId: item.id,
          quantity: quantities[item.id],
        }));
      if (!items.length) {
        setError("Indica al menos una unidad afectada.");
        return;
      }
      setError("");
      void onSubmit({ ...base, requestId: requestId.current, type, items });
    }
  }
  return (
    <form onSubmit={submit} className="order-decision-form">
      <fieldset disabled={pending}>
        <legend>
          {kind === "confirm"
            ? "Disponibilidad por prenda"
            : "Nueva incidencia"}
        </legend>
        {kind === "incident" && (
          <label className="field">
            <span>Tipo de incidencia</span>
            <select name="type" required defaultValue="OUT_OF_STOCK">
              {Object.entries(INCIDENT_LABELS).map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>
        )}
        {suborder.items.map((item) => (
          <label key={item.id} className="field order-item-quantity">
            <span>
              {item.productName} · {item.sizeLabel} / {item.color}
              <small>
                {kind === "confirm"
                  ? "Unidades disponibles"
                  : "Unidades afectadas"}{" "}
                de {item.quantity}
              </small>
            </span>
            <input
              type="number"
              min={0}
              max={item.quantity}
              step={1}
              required
              value={quantities[item.id]}
              aria-label={`${kind === "confirm" ? "Confirmar" : "Afectadas"} ${item.productName}`}
              onChange={(event) =>
                setQuantities((current) => ({
                  ...current,
                  [item.id]: Number(event.target.value),
                }))
              }
            />
          </label>
        ))}
        {kind === "confirm" && missing > 0 && (
          <output className="order-missing">
            Faltantes: {missing} unidades
          </output>
        )}
        <label className="field">
          <span>
            {kind === "confirm"
              ? "Motivo de la confirmación"
              : "Descripción de la incidencia"}
          </span>
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={255}
            rows={3}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="order-action-row">
          <button type="submit" className="primary-button">
            <Save size={17} />
            {pending ? "Guardando..." : "Registrar"}
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function Incident({
  incident,
  suborder,
  canReview,
  pending,
  change,
}: Readonly<{
  incident: OrderIncident;
  suborder: ManagedSuborder;
  canReview: boolean;
  pending: boolean;
  change: ChangeOrder;
}>) {
  const [review, setReview] = useState(false);
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = new FormData(event.currentTarget).get("note");
    void change(
      `/order-management/incidents/${incident.id}/review`,
      {
        expectedUpdatedAt: incident.updatedAt,
        note: typeof note === "string" ? note.trim() : "",
      },
      "Revisión registrada; la incidencia permanece abierta.",
      "PATCH",
    ).then((saved) => {
      if (saved) setReview(false);
    });
  }
  let state = "Abierta · Pendiente de revisión";
  if (incident.reviewedAt) state = "Abierta · Revisada por administración";
  if (incident.resolvedAt) state = "Resuelta";
  return (
    <article className="order-incident">
      <header>
        <strong>
          <TriangleAlert size={16} />
          {INCIDENT_LABELS[incident.type] ?? incident.type}
        </strong>
        <span>{state}</span>
      </header>
      <time dateTime={incident.createdAt}>{date(incident.createdAt)}</time>
      <p>{incident.description}</p>
      {Array.isArray(incident.affectedItems) &&
        incident.affectedItems.map((item, index) => (
          <p key={`${item.orderItemId}:${index}`}>
            {suborder.items.find((record) => record.id === item.orderItemId)
              ?.productName ?? "Prenda"}{" "}
            · {item.missingQuantity ?? item.quantity ?? 0} unidades afectadas
          </p>
        ))}
      {incident.reviewNote && (
        <div className="order-review">
          <strong>Revisión administrativa</strong>
          <p>{incident.reviewNote}</p>
        </div>
      )}
      {canReview && !incident.resolvedAt && !review && (
        <button
          type="button"
          className="secondary-button"
          disabled={pending}
          onClick={() => setReview(true)}
        >
          <Check size={16} />
          Registrar revisión
        </button>
      )}
      {review && (
        <form onSubmit={submit}>
          <fieldset disabled={pending}>
            <label className="field">
              <span>Nota de revisión</span>
              <textarea
                name="note"
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                defaultValue={incident.reviewNote ?? ""}
              />
            </label>
            <div className="order-action-row">
              <button type="submit" className="primary-button">
                <Save size={17} />
                {pending ? "Guardando..." : "Guardar revisión"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReview(false)}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </article>
  );
}
