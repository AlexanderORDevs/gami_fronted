"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type SyntheticEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { parseCart, useCart } from "@/lib/cart";
import { formatPrice, getCatalogProduct } from "@/lib/catalog-api";
import {
  checkoutRequest,
  type CheckoutQuote,
  type CheckoutQuoteInput,
  type CheckoutOrderInput,
  type CheckoutReceipt,
  type CartItem,
  type DeliveryDestination,
} from "@/lib/checkout-api";
import "./checkout.css";
import { useCustomer } from "@/lib/customer-session";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "No pudimos completar la operación.";

export function CheckoutDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cart = useCart();
  const [stage, setStage] = useState<"cart" | "delivery">("cart");
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);
  const [refreshed, setRefreshed] = useState<{
    raw: string;
    items: CartItem[];
    unavailable: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const original = parseCart(cart.raw);
    const products = [...new Set(original.map((item) => item.productId))];
    Promise.all(
      products.map(async (id) => {
        try {
          return await getCatalogProduct(id, controller.signal);
        } catch (error_) {
          if (
            error_ instanceof Error &&
            error_.message === "Esta prenda ya no está disponible."
          )
            return null;
          throw error_;
        }
      }),
    )
      .then((records) => {
        if (controller.signal.aborted) return;
        const unavailable: string[] = [];
        const items = original.map((item) => {
          const product = records.find(
            (record) => record?.id === item.productId,
          );
          const variant = product?.variants.find(
            (record) => record.id === item.variantId,
          );
          if (!product || !variant || product.stockKnown === false) {
            unavailable.push(item.variantId);
            return { ...item, availableStock: 0 };
          }
          return {
            ...item,
            name: product.name,
            storeName: product.store.displayName,
            imageUrl: product.imageUrl,
            unitPriceInCents: product.unitPriceInCents,
            availableStock: variant.availableStock,
            size: variant.size,
            color: variant.color,
          };
        });
        setRefreshed({ raw: cart.raw, items, unavailable });
        setError("");
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(message(error_));
      });
    return () => controller.abort();
  }, [cart.raw, revision]);
  const items = refreshed?.raw === cart.raw ? refreshed.items : cart.items;
  const ready = refreshed?.raw === cart.raw && !error && !cart.loading;
  const invalid =
    !items.length ||
    items.some((item) => item.quantity > item.availableStock) ||
    !!refreshed?.unavailable.length;
  const subtotal = items.reduce(
    (total, item) => total + item.quantity * item.unitPriceInCents,
    0,
  );
  const title = receipt
    ? "Orden registrada"
    : { cart: "Tu carrito", delivery: "Datos de entrega" }[stage];
  async function change(operation: () => Promise<unknown>) {
    try {
      await operation();
      setError("");
    } catch (error_) {
      setError(message(error_));
    }
  }
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog"
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
    >
      <header className="checkout-header">
        <div>
          <p className="eyebrow">gami.</p>
          <h2 id="checkout-title">{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Cerrar carrito"
          aria-label="Cerrar carrito"
          disabled={submitting}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="checkout-body">
        {receipt ? (
          <Receipt receipt={receipt} onClose={onClose} />
        ) : (
          <>
            {error && (
              <p role="alert" className="checkout-error">
                {error}
              </p>
            )}
            {stage === "cart" ? (
              <>
                {!items.length && (
                  <div className="checkout-empty">
                    <ShoppingBag size={30} />
                    <h3>Tu carrito está vacío</h3>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={onClose}
                    >
                      Volver al catálogo
                    </button>
                  </div>
                )}
                {items.map((item) => (
                  <article className="checkout-line" key={item.variantId}>
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={90}
                        height={110}
                        unoptimized
                      />
                    ) : (
                      <div className="checkout-image-empty">
                        <ShoppingBag size={22} />
                      </div>
                    )}
                    <div className="checkout-line-copy">
                      <p>{item.storeName}</p>
                      <h3>{item.name}</h3>
                      <span>
                        {item.size} / {item.color}
                      </span>
                      <strong>{formatPrice(item.unitPriceInCents)}</strong>
                      {item.quantity > item.availableStock && (
                        <p role="alert">
                          {item.availableStock > 0
                            ? `Solo quedan ${item.availableStock} unidades.`
                            : "No disponible para compra."}
                        </p>
                      )}
                      <div className="checkout-quantity">
                        <button
                          type="button"
                          className="icon-button bordered"
                          title={`Reducir ${item.name}`}
                          aria-label={`Reducir ${item.name}`}
                          disabled={item.quantity <= 1}
                          onClick={() =>
                            change(() =>
                              cart.change(item.variantId, item.quantity - 1),
                            )
                          }
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          aria-label={`Cantidad de ${item.name}`}
                          min={1}
                          max={item.availableStock}
                          step={1}
                          value={item.quantity}
                          onChange={(event) =>
                            change(() =>
                              cart.change(
                                item.variantId,
                                Number(event.target.value),
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          className="icon-button bordered"
                          title={`Aumentar ${item.name}`}
                          aria-label={`Aumentar ${item.name}`}
                          disabled={item.quantity >= item.availableStock}
                          onClick={() =>
                            change(() =>
                              cart.change(item.variantId, item.quantity + 1),
                            )
                          }
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title={`Quitar ${item.name}`}
                          aria-label={`Quitar ${item.name}`}
                          onClick={() =>
                            change(() => cart.remove(item.variantId))
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    <strong className="checkout-line-total">
                      {formatPrice(item.unitPriceInCents * item.quantity)}
                    </strong>
                  </article>
                ))}
                {!!items.length && (
                  <>
                    <div className="checkout-totals">
                      <span>Subtotal de prendas</span>
                      <strong>{formatPrice(subtotal)}</strong>
                    </div>
                    <div className="checkout-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setRefreshed(null);
                          setRevision((value) => value + 1);
                        }}
                      >
                        <RefreshCw size={17} />
                        Actualizar stock
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={!ready || invalid}
                        onClick={() => setStage("delivery")}
                      >
                        Continuar <ArrowRight size={17} />
                      </button>
                    </div>
                    {!ready && !error && (
                      <output>Actualizando precios y stock...</output>
                    )}
                  </>
                )}
              </>
            ) : (
              <DeliveryForm
                key={cart.raw}
                items={items}
                ready={ready && !invalid}
                onBack={() => setStage("cart")}
                onPending={setSubmitting}
                onComplete={(result) => {
                  setReceipt(result);
                  change(() => cart.clear());
                }}
              />
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-shell">
        <input {...props} />
      </span>
    </label>
  );
}

function DeliveryForm({
  items,
  ready,
  onBack,
  onPending,
  onComplete,
}: Readonly<{
  items: CartItem[];
  ready: boolean;
  onBack: () => void;
  onPending: (pending: boolean) => void;
  onComplete: (receipt: CheckoutReceipt) => void;
}>) {
  const account = useCustomer();
  const [destinations, setDestinations] = useState<DeliveryDestination[]>([]);
  const [destinationIndex, setDestinationIndex] = useState("");
  const [district, setDistrict] = useState("");
  const [sameRecipient, setSameRecipient] = useState(true);
  const [quote, setQuote] = useState<{
    input: string;
    value: CheckoutQuote;
  } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [revision, setRevision] = useState(0);
  const attempt = useRef<{ input: string; requestId: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    checkoutRequest<{ destinations: DeliveryDestination[] }>(
      "destinations",
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setDestinations(result.destinations);
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(message(error_));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDestinations(false);
      });
    return () => controller.abort();
  }, [revision]);
  const destination = destinations[Number(destinationIndex)];
  const quoteInput: CheckoutQuoteInput = {
    items: items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    })),
    zoneType: destination?.zoneType ?? "LIMA",
    ...((destination?.district ?? district.trim())
      ? { district: destination?.district ?? district.trim() }
      : {}),
  };
  const signature = JSON.stringify(quoteInput);
  const currentQuote = quote?.input === signature ? quote.value : null;
  async function calculate() {
    if (!destination || destinationIndex === "") return;
    setLoadingQuote(true);
    setError("");
    setQuote(null);
    try {
      setQuote({
        input: signature,
        value: await checkoutRequest<CheckoutQuote>("quote", quoteInput),
      });
    } catch (error_) {
      setError(message(error_));
    } finally {
      setLoadingQuote(false);
    }
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentQuote || pending || !ready || !destination) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => {
      const result = data.get(name);
      return typeof result === "string" ? result.trim() : "";
    };
    const input = {
      ...quoteInput,
      customerName: value("customerName"),
      customerPhone: value("customerPhone"),
      ...(value("email") ? { customerEmail: value("email") } : {}),
      recipientName: value(sameRecipient ? "customerName" : "recipientName"),
      recipientPhone: value(sameRecipient ? "customerPhone" : "recipientPhone"),
      city: value("city"),
      line1: value("line1"),
      ...(value("agency") ? { agency: value("agency") } : {}),
      ...(value("reference") ? { reference: value("reference") } : {}),
      expectedSubtotalInCents: currentQuote.subtotalInCents,
      expectedShippingInCents: currentQuote.shippingInCents,
    };
    setPending(true);
    onPending(true);
    setError("");
    try {
      const serialized = JSON.stringify(input);
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(serialized),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      let saved: { input: string; requestId: string } | null = attempt.current;
      try {
        saved = JSON.parse(
          sessionStorage.getItem(
            `gami.checkout.attempt:${account.session?.user.id}`,
          ) ?? "null",
        ) as typeof saved;
      } catch {}
      const requestId =
        saved?.input === fingerprint && typeof saved.requestId === "string"
          ? saved.requestId
          : crypto.randomUUID();
      attempt.current = { input: fingerprint, requestId };
      try {
        sessionStorage.setItem(
          `gami.checkout.attempt:${account.session?.user.id}`,
          JSON.stringify(attempt.current),
        );
      } catch {}
      const result = await account.api<CheckoutReceipt>(
        "/checkout/orders",
        "POST",
        {
          ...input,
          requestId,
        } satisfies CheckoutOrderInput,
      );
      try {
        sessionStorage.removeItem(
          `gami.checkout.attempt:${account.session?.user.id}`,
        );
      } catch {}
      attempt.current = null;
      onComplete(result);
    } catch (error_) {
      setError(message(error_));
    } finally {
      setPending(false);
      onPending(false);
    }
  }
  const noRates = !loadingDestinations && !destinations.length;
  return (
    <form onSubmit={submit} className="checkout-form">
      <fieldset disabled={pending} className="checkout-fields">
        <button
          type="button"
          className="secondary-button checkout-back"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          Volver al carrito
        </button>
        <fieldset className="checkout-section">
          <legend>Contacto</legend>
          <div className="checkout-grid">
            <Field
              label="Nombre completo"
              name="customerName"
              required
              minLength={3}
              maxLength={150}
              autoComplete="name"
              defaultValue={account.profile?.fullName ?? ""}
            />
            <Field
              label="Teléfono"
              name="customerPhone"
              required
              type="tel"
              pattern="\+?[0-9]{7,15}"
              maxLength={16}
              autoComplete="tel"
              defaultValue={account.profile?.phone ?? ""}
            />
            <Field
              label="Correo electrónico (opcional)"
              name="email"
              type="email"
              maxLength={180}
              autoComplete="email"
              defaultValue={account.profile?.email ?? ""}
            />
          </div>
        </fieldset>
        <fieldset className="checkout-section">
          <legend>Entrega</legend>
          {noRates && (
            <p role="alert">
              Tarifa de envío no disponible. No se puede confirmar la orden por
              ahora.
            </p>
          )}
          <label className="field">
            <span>Destino</span>
            <select
              required
              value={destinationIndex}
              onChange={(event) => {
                setDestinationIndex(event.target.value);
                setQuote(null);
                setDistrict("");
              }}
              disabled={loadingDestinations || noRates}
            >
              <option value="">
                {loadingDestinations
                  ? "Cargando destinos..."
                  : "Selecciona un destino"}
              </option>
              {destinations.map((item, index) => (
                <option key={`${item.zoneType}:${item.district}`} value={index}>
                  {
                    { LIMA: "Lima", PROVINCE: "Provincia", AGENCY: "Agencia" }[
                      item.zoneType
                    ]
                  }
                  {item.district ? ` · ${item.district}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="checkout-grid">
            <Field
              label="Ciudad"
              name="city"
              required
              minLength={2}
              maxLength={100}
              autoComplete="address-level2"
            />
            {destination && !destination.district && (
              <Field
                label={
                  destination.zoneType === "LIMA"
                    ? "Distrito"
                    : "Distrito (opcional)"
                }
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                required={destination.zoneType === "LIMA"}
                minLength={2}
                maxLength={100}
                autoComplete="address-level3"
              />
            )}
            {destination?.zoneType === "AGENCY" && (
              <Field
                label="Agencia de destino"
                name="agency"
                required
                minLength={2}
                maxLength={150}
              />
            )}
            <Field
              label="Dirección"
              name="line1"
              required
              minLength={5}
              maxLength={255}
              autoComplete="street-address"
            />
            <Field
              label="Referencia (opcional)"
              name="reference"
              minLength={3}
              maxLength={255}
            />
          </div>
          <label className="checkout-check">
            <input
              type="checkbox"
              checked={sameRecipient}
              onChange={(event) => setSameRecipient(event.target.checked)}
            />
            <span>Yo recibo la orden</span>
          </label>
          {!sameRecipient && (
            <div className="checkout-grid">
              <Field
                label="Nombre del destinatario"
                name="recipientName"
                required
                minLength={3}
                maxLength={150}
              />
              <Field
                label="Teléfono del destinatario"
                name="recipientPhone"
                required
                type="tel"
                pattern="\+?[0-9]{7,15}"
                maxLength={16}
              />
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="checkout-error">
            {error}
          </p>
        )}
        <div className="checkout-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setLoadingDestinations(true);
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            <RefreshCw size={16} />
            Actualizar destinos
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={
              destinationIndex === "" ||
              !destination ||
              loadingQuote ||
              !ready ||
              (destination.zoneType === "LIMA" && !quoteInput.district)
            }
            onClick={() => void calculate()}
          >
            {loadingQuote ? "Calculando..." : "Calcular total"}
          </button>
        </div>
        {currentQuote && (
          <section
            className="checkout-summary"
            aria-label="Resumen de la orden"
          >
            <h3>Resumen</h3>
            {currentQuote.lines.map((line) => (
              <div key={line.variantId} className="checkout-summary-line">
                <span>
                  {line.storeName} · {line.productName}
                  <small>
                    {line.size} / {line.color} × {line.quantity}
                  </small>
                </span>
                <strong>{formatPrice(line.totalInCents)}</strong>
              </div>
            ))}
            <dl>
              <div>
                <dt>Prendas</dt>
                <dd>{formatPrice(currentQuote.subtotalInCents)}</dd>
              </div>
              <div>
                <dt>Envío</dt>
                <dd>{formatPrice(currentQuote.shippingInCents)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatPrice(currentQuote.totalInCents)}</dd>
              </div>
            </dl>
          </section>
        )}
        <button
          type="submit"
          className="primary-button"
          disabled={
            !currentQuote || !ready || loadingQuote || pending || noRates
          }
        >
          {pending ? "Registrando..." : "Crear orden pendiente de pago"}
          <ArrowRight size={17} />
        </button>
      </fieldset>
    </form>
  );
}

function Receipt({
  receipt,
  onClose,
}: Readonly<{ receipt: CheckoutReceipt; onClose: () => void }>) {
  return (
    <section className="checkout-receipt">
      <Check size={30} />
      <h3>{receipt.orderNumber}</h3>
      <p className="checkout-pending">Pendiente de pago</p>
      <p>No se realizó ningún cobro.</p>
      <dl>
        <div>
          <dt>Prendas</dt>
          <dd>{formatPrice(receipt.subtotalInCents)}</dd>
        </div>
        <div>
          <dt>Envío</dt>
          <dd>{formatPrice(receipt.shippingInCents)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatPrice(receipt.totalInCents)}</dd>
        </div>
      </dl>
      <p>
        Reserva de stock hasta el{" "}
        {new Intl.DateTimeFormat("es-PE", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Lima",
        }).format(new Date(receipt.stockReservedUntil))}{" "}
        (Lima).
      </p>
      <button type="button" className="primary-button" onClick={onClose}>
        Volver al catálogo
      </button>
    </section>
  );
}
