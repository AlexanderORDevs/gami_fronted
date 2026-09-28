"use client";

import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  getOperationOptions,
  getOperationRecords,
  listWorkspaceStores,
  saveStoreOperation,
  type OperationOptions,
  type OperationPage,
  type OperationVariant,
  type ShipmentOrderOption,
  type StoreOperation,
  type WorkspaceStore,
} from "@/lib/store-api";
import "./store-operations.css";

const TITLES: Record<StoreOperation, string> = {
  products: "Nuevo producto",
  orders: "Crear orden",
  inventory: "Ajustar inventario",
  shipments: "Registrar envío",
};
const ICONS = {
  products: PackagePlus,
  orders: Plus,
  inventory: SlidersHorizontal,
  shipments: Truck,
};
const failureMessage = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo guardar el registro.";
const money = (cents: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    cents / 100,
  );
const text = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
};
const cents = (data: FormData, name: string) =>
  Math.round(Number(text(data, name)) * 100);
const labels: Record<string, string> = {
  pantalon_recto: "Pantalón recto",
  pantalon_wide: "Pantalón wide",
  navy: "Azul marino",
  marron: "Marrón",
};
const label = (value: string) =>
  labels[value] ??
  value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");

function Field({
  label: title,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{title}</span>
      <span className="input-shell">
        <input {...props} />
      </span>
    </label>
  );
}
function SelectField({
  title,
  name,
  options,
  value,
  onChange,
  required = true,
}: Readonly<{
  title: string;
  name: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}>) {
  return (
    <label className="field">
      <span>{title}</span>
      <select
        name={name}
        required={required}
        value={value}
        defaultValue={value === undefined ? "" : undefined}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OperationStoreSelect({
  token,
  value,
  onChange,
}: Readonly<{
  token: string;
  value: string;
  onChange: (store: WorkspaceStore | null) => void;
}>) {
  const [stores, setStores] = useState<WorkspaceStore[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    listWorkspaceStores(token, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setStores(result);
          setError("");
        }
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(failureMessage(error_));
      });
    return () => controller.abort();
  }, [token, revision]);
  return (
    <div className="operation-store-select">
      <label className="field">
        <span>Tienda</span>
        <select
          value={value}
          onChange={(event) =>
            onChange(
              stores.find((store) => store.id === event.target.value) ?? null,
            )
          }
        >
          <option value="">Todas las tiendas</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.displayName}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            type="button"
            className="icon-button bordered"
            title="Reintentar tiendas"
            aria-label="Reintentar tiendas"
            onClick={() => setRevision((current) => current + 1)}
          >
            <RefreshCw size={18} />
          </button>
        </>
      )}
    </div>
  );
}

export function OperationToolbar({
  token,
  store,
  resource,
  onSaved,
}: Readonly<{
  token: string;
  store: WorkspaceStore | null;
  resource: string;
  onSaved: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState("");
  if (!(resource in TITLES)) return null;
  const operation = resource as StoreOperation;
  if (store && !store.writePermissions?.includes(operation)) return null;
  const Icon = ICONS[operation];
  return (
    <div className="operation-toolbar">
      <button
        type="button"
        className="primary-button"
        disabled={!store}
        title={!store ? "Selecciona una tienda" : TITLES[operation]}
        onClick={() => {
          setSuccess("");
          setOpen(true);
        }}
      >
        <Icon size={18} />
        {TITLES[operation]}
      </button>
      {success && <output>{success}</output>}
      {open && store && (
        <OperationDialog
          key={`${store.id}:${operation}`}
          token={token}
          store={store}
          operation={operation}
          onClose={() => setOpen(false)}
          onSaved={(message) => {
            setSuccess(message);
            setOpen(false);
            onSaved();
          }}
        />
      )}
    </div>
  );
}

type SaveOperation = (input: object, variantId?: string) => Promise<void>;
type FormProps = Readonly<{
  token: string;
  storeId: string;
  pending: boolean;
  save: SaveOperation;
}>;

function OperationDialog({
  token,
  store,
  operation,
  onClose,
  onSaved,
}: Readonly<{
  token: string;
  store: WorkspaceStore;
  operation: StoreOperation;
  onClose: () => void;
  onSaved: (message: string) => void;
}>) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const save: SaveOperation = async (input, variantId) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await saveStoreOperation(
        token,
        store.id,
        operation,
        input,
        variantId,
      );
      const messages = {
        products: "Producto creado. En revisión.",
        orders: `Orden ${result.orderNumber ?? ""} creada. Pendiente de pago.`,
        inventory: "Inventario actualizado.",
        shipments: "Envío registrado. Pendiente.",
      };
      onSaved(messages[operation]);
    } catch (error_: unknown) {
      setError(failureMessage(error_));
    } finally {
      setPending(false);
    }
  };
  const props = { token, storeId: store.id, pending, save };
  return (
    <dialog
      ref={ref}
      className="admin-modal operation-dialog"
      aria-labelledby="operation-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">{store.displayName}</p>
          <h2 id="operation-title">{TITLES[operation]}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Cerrar"
          aria-label="Cerrar"
          disabled={pending}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="operation-body">
        {error && (
          <p role="alert" className="operation-error">
            {error}
          </p>
        )}
        {operation === "products" && <ProductForm {...props} />}
        {operation === "orders" && <OrderForm {...props} />}
        {operation === "inventory" && <InventoryForm {...props} />}
        {operation === "shipments" && <ShipmentForm {...props} />}
      </div>
    </dialog>
  );
}

function Submit({
  pending,
  disabled = false,
  children = "Guardar",
}: Readonly<{ pending: boolean; disabled?: boolean; children?: ReactNode }>) {
  return (
    <button
      type="submit"
      className="primary-button"
      disabled={pending || disabled}
    >
      <Save size={18} />
      {pending ? "Guardando..." : children}
    </button>
  );
}

function ProductForm({ token, storeId, pending, save }: FormProps) {
  const [options, setOptions] = useState<OperationOptions | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [variants, setVariants] = useState([crypto.randomUUID()]);
  const [photos, setPhotos] = useState([{ id: crypto.randomUUID(), url: "" }]);
  const [wholesale, setWholesale] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getOperationOptions(token, storeId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setOptions(result);
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(failureMessage(error_));
      });
    return () => controller.abort();
  }, [token, storeId]);
  if (error) return <p role="alert">{error}</p>;
  if (!options) return <output>Cargando opciones...</output>;
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void save({
      name: text(data, "name"),
      description: text(data, "description"),
      category,
      garmentType: text(data, "garmentType"),
      gender: text(data, "gender"),
      mainColor: text(data, "mainColor"),
      pattern: text(data, "pattern"),
      fit: text(data, "fit"),
      ...(text(data, "length") ? { length: text(data, "length") } : {}),
      unitPriceInCents: cents(data, "unitPrice"),
      ...(wholesale
        ? {
            wholesalePriceInCents: cents(data, "wholesalePrice"),
            wholesaleMinimum: Number(text(data, "wholesaleMinimum")),
          }
        : {}),
      imageUrls: photos.map((photo) => photo.url.trim()),
      variants: variants.map((id) => ({
        sizeLabel: text(data, `size-${id}`),
        color: text(data, `color-${id}`),
        quantity: Number(text(data, `quantity-${id}`)),
      })),
    });
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="operation-fields">
        <Field
          label="Nombre del producto"
          name="name"
          required
          minLength={3}
          maxLength={180}
        />
        <label className="field">
          <span>Descripción</span>
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={5000}
            rows={3}
          />
        </label>
        <div className="operation-grid">
          <SelectField title="Género" name="gender" options={options.genders} />
          <SelectField
            title="Categoría"
            name="category"
            options={Object.keys(options.types)}
            value={category}
            onChange={setCategory}
          />
          <SelectField
            key={category}
            title="Tipo de prenda"
            name="garmentType"
            options={options.types[category] ?? []}
          />
          <SelectField
            title="Color principal"
            name="mainColor"
            options={options.colors}
          />
          <SelectField
            title="Patrón"
            name="pattern"
            options={options.patterns}
          />
          <SelectField title="Ajuste" name="fit" options={options.fits} />
          {["inferior", "vestido"].includes(category) && (
            <SelectField
              title="Largo"
              name="length"
              options={options.lengths}
            />
          )}
          <Field
            label="Precio unitario (S/)"
            name="unitPrice"
            type="number"
            required
            min="0.01"
            max="1000000"
            step="0.01"
          />
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={wholesale}
            onChange={(event) => setWholesale(event.target.checked)}
          />
          <span>Precio por mayor</span>
        </label>
        {wholesale && (
          <div className="operation-grid">
            <Field
              label="Precio por mayor (S/)"
              name="wholesalePrice"
              type="number"
              required
              min="0.01"
              max="1000000"
              step="0.01"
            />
            <Field
              label="Mínimo por mayor"
              name="wholesaleMinimum"
              type="number"
              required
              min={2}
              max={1000000}
              step={1}
            />
          </div>
        )}
        <fieldset className="operation-group">
          <legend>Fotografías</legend>
          {photos.map((photo, index) => (
            <div className="operation-photo" key={photo.id}>
              <Field
                label={`Foto ${index + 1} · URL HTTPS`}
                type="url"
                value={photo.url}
                required
                pattern="https://.*"
                maxLength={180}
                onChange={(event) =>
                  setPhotos((current) =>
                    current.map((item) =>
                      item.id === photo.id
                        ? { ...item, url: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              {photo.url.startsWith("https://") && (
                <Image
                  src={photo.url}
                  alt={`Foto ${index + 1}`}
                  width={64}
                  height={64}
                  unoptimized
                />
              )}
              <button
                type="button"
                className="icon-button bordered"
                disabled={photos.length === 1}
                title={`Quitar foto ${index + 1}`}
                aria-label={`Quitar foto ${index + 1}`}
                onClick={() =>
                  setPhotos((current) =>
                    current.filter((item) => item.id !== photo.id),
                  )
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            disabled={photos.length >= 8}
            onClick={() =>
              setPhotos((current) => [
                ...current,
                { id: crypto.randomUUID(), url: "" },
              ])
            }
          >
            <Plus size={17} />
            Agregar foto
          </button>
        </fieldset>
        <fieldset className="operation-group">
          <legend>Variantes y stock inicial</legend>
          {variants.map((id, index) => (
            <div className="operation-variant" key={id}>
              <Field
                label={`Talla ${index + 1}`}
                name={`size-${id}`}
                required
                maxLength={30}
              />
              <SelectField
                title={`Color ${index + 1}`}
                name={`color-${id}`}
                options={options.colors}
              />
              <Field
                label={`Stock ${index + 1}`}
                name={`quantity-${id}`}
                required
                type="number"
                min={0}
                max={1000000}
                step={1}
                defaultValue={0}
              />
              <button
                type="button"
                className="icon-button bordered"
                title={`Quitar variante ${index + 1}`}
                aria-label={`Quitar variante ${index + 1}`}
                disabled={variants.length === 1}
                onClick={() =>
                  setVariants((current) =>
                    current.filter((item) => item !== id),
                  )
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            disabled={variants.length >= 100}
            onClick={() =>
              setVariants((current) => [...current, crypto.randomUUID()])
            }
          >
            <Plus size={17} />
            Agregar variante
          </button>
        </fieldset>
        <Submit pending={pending}>Enviar a revisión</Submit>
      </fieldset>
    </form>
  );
}

function RecordPicker<T extends { id: string }>({
  token,
  storeId,
  resource,
  title,
  describe,
  onSelect,
  unavailable,
}: Readonly<{
  token: string;
  storeId: string;
  resource: "inventory-variants" | "order-variants" | "shipment-orders";
  title: string;
  describe: (record: T) => string;
  onSelect: (record: T) => void;
  unavailable?: (record: T) => boolean;
}>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<OperationPage<T>>({
    data: [],
    total: 0,
    page: 1,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getOperationRecords<T>(
      token,
      storeId,
      resource,
      search,
      page,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data);
          setError("");
        }
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) {
          setError(failureMessage(error_));
          setResult({ data: [], total: 0, page: 1, pages: 0 });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, storeId, resource, search, page, revision]);
  return (
    <div className="operation-picker">
      <label className="field">
        <span>Buscar {title.toLowerCase()}</span>
        <span className="input-shell">
          <Search size={16} />
          <input
            value={search}
            maxLength={120}
            onChange={(event) => {
              setLoading(true);
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </span>
      </label>
      <label className="field">
        <span>{title}</span>
        <select
          value=""
          disabled={loading}
          onChange={(event) => {
            const record = result.data.find(
              (item) => item.id === event.target.value,
            );
            if (record) onSelect(record);
          }}
        >
          <option value="">{loading ? "Cargando..." : "Seleccionar"}</option>
          {result.data.map((record) => (
            <option
              key={record.id}
              value={record.id}
              disabled={unavailable?.(record)}
            >
              {describe(record)}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {!loading && !result.data.length && !error && (
        <output>Sin registros disponibles.</output>
      )}
      <div className="operation-pagination">
        <output>
          {result.total} registros · {page} / {Math.max(1, result.pages)}
        </output>
        <div>
          <button
            type="button"
            className="icon-button bordered"
            title="Actualizar opciones"
            aria-label="Actualizar opciones"
            onClick={() => {
              setLoading(true);
              setRevision((current) => current + 1);
            }}
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="icon-button bordered"
            title="Opciones anteriores"
            aria-label="Opciones anteriores"
            disabled={loading || page <= 1}
            onClick={() => {
              setLoading(true);
              setPage((current) => current - 1);
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="icon-button bordered"
            title="Opciones siguientes"
            aria-label="Opciones siguientes"
            disabled={loading || page >= result.pages}
            onClick={() => {
              setLoading(true);
              setPage((current) => current + 1);
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
const variantDescription = (variant: OperationVariant) =>
  `${variant.productName} · ${variant.sizeLabel} / ${label(variant.color)} · ${variant.available ?? "?"} disponibles`;

function InventoryForm({ token, storeId, pending, save }: FormProps) {
  const [variant, setVariant] = useState<OperationVariant | null>(null);
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!variant) return;
    const data = new FormData(event.currentTarget);
    void save(
      {
        quantity: Number(text(data, "quantity")),
        expectedQuantity: variant.quantity,
        reason: text(data, "reason"),
      },
      variant.id,
    );
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="operation-fields">
        <RecordPicker<OperationVariant>
          token={token}
          storeId={storeId}
          resource="inventory-variants"
          title="Variante"
          describe={variantDescription}
          onSelect={setVariant}
        />
        {variant && (
          <div
            key={`${variant.id}:${variant.quantity}`}
            className="operation-fields"
          >
            <strong>
              {variant.productName} · {variant.sizeLabel} /{" "}
              {label(variant.color)}
            </strong>
            <output>
              Stock actual: {variant.quantity ?? "Sin registrar"} · Disponible:{" "}
              {variant.available ?? "Sin registrar"}
            </output>
            <Field
              label="Nuevo stock total"
              name="quantity"
              type="number"
              min={0}
              max={1000000}
              step={1}
              required
              defaultValue={variant.quantity ?? 0}
            />
            <Field
              label="Motivo del ajuste"
              name="reason"
              minLength={3}
              maxLength={255}
              required
            />
          </div>
        )}
        <Submit pending={pending} disabled={!variant}>
          Guardar ajuste
        </Submit>
      </fieldset>
    </form>
  );
}

function OrderForm({ token, storeId, pending, save }: FormProps) {
  const [items, setItems] = useState<(OperationVariant & { units: number })[]>(
    [],
  );
  const [sameRecipient, setSameRecipient] = useState(true);
  const [zone, setZone] = useState("LIMA");
  const [shipping, setShipping] = useState("0");
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void save({
      customerName: text(data, "customerName"),
      customerPhone: text(data, "customerPhone"),
      ...(text(data, "customerEmail")
        ? { customerEmail: text(data, "customerEmail") }
        : {}),
      recipientName: text(
        data,
        sameRecipient ? "customerName" : "recipientName",
      ),
      recipientPhone: text(
        data,
        sameRecipient ? "customerPhone" : "recipientPhone",
      ),
      zoneType: zone,
      city: text(data, "city"),
      ...(text(data, "district") ? { district: text(data, "district") } : {}),
      ...(text(data, "agency") ? { agency: text(data, "agency") } : {}),
      line1: text(data, "line1"),
      ...(text(data, "reference")
        ? { reference: text(data, "reference") }
        : {}),
      shippingInCents: cents(data, "shipping"),
      items: items.map((item) => ({
        variantId: item.id,
        quantity: item.units,
      })),
    });
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="operation-fields">
        <fieldset className="operation-group">
          <legend>Cliente</legend>
          <div className="operation-grid">
            <Field
              label="Nombre del cliente"
              name="customerName"
              required
              minLength={3}
              maxLength={150}
            />
            <Field
              label="Teléfono del cliente"
              name="customerPhone"
              type="tel"
              required
              pattern="\+?[0-9]{7,15}"
              maxLength={16}
            />
            <Field
              label="Correo (opcional)"
              name="customerEmail"
              type="email"
              maxLength={180}
            />
          </div>
        </fieldset>
        <fieldset className="operation-group">
          <legend>Destino</legend>
          <label className="check-field">
            <input
              type="checkbox"
              checked={sameRecipient}
              onChange={(event) => setSameRecipient(event.target.checked)}
            />
            <span>El cliente recibe la orden</span>
          </label>
          <div className="operation-grid">
            {!sameRecipient && (
              <>
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
                  type="tel"
                  required
                  pattern="\+?[0-9]{7,15}"
                  maxLength={16}
                />
              </>
            )}
            <label className="field">
              <span>Zona de entrega</span>
              <select
                value={zone}
                onChange={(event) => setZone(event.target.value)}
              >
                <option value="LIMA">Lima</option>
                <option value="PROVINCE">Provincia</option>
                <option value="AGENCY">Agencia</option>
              </select>
            </label>
            <Field
              label="Ciudad"
              name="city"
              required
              minLength={2}
              maxLength={100}
              defaultValue="Lima"
            />
            <Field
              label={zone === "LIMA" ? "Distrito" : "Distrito (opcional)"}
              name="district"
              required={zone === "LIMA"}
              minLength={2}
              maxLength={100}
            />
            {zone === "AGENCY" && (
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
            />
            <Field
              label="Referencia (opcional)"
              name="reference"
              minLength={3}
              maxLength={255}
            />
          </div>
        </fieldset>
        <fieldset className="operation-group">
          <legend>Prendas</legend>
          <RecordPicker<OperationVariant>
            token={token}
            storeId={storeId}
            resource="order-variants"
            title="Prenda publicada"
            describe={variantDescription}
            unavailable={(variant) =>
              !variant.available || items.some((item) => item.id === variant.id)
            }
            onSelect={(variant) =>
              setItems((current) =>
                current.some((item) => item.id === variant.id)
                  ? current
                  : [...current, { ...variant, units: 1 }],
              )
            }
          />
          {items.map((item) => (
            <div className="operation-order-item" key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <span>
                  {item.sizeLabel} / {label(item.color)} ·{" "}
                  {money(item.unitPriceInCents)}
                </span>
              </div>
              <Field
                label={`Cantidad de ${item.productName}`}
                type="number"
                required
                min={1}
                max={item.available ?? 0}
                step={1}
                value={item.units || ""}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((row) =>
                      row.id === item.id
                        ? { ...row, units: Number(event.target.value) }
                        : row,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="icon-button bordered"
                title={`Quitar ${item.productName}`}
                aria-label={`Quitar ${item.productName}`}
                onClick={() =>
                  setItems((current) =>
                    current.filter((row) => row.id !== item.id),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </fieldset>
        <Field
          label="Costo de envío (S/)"
          name="shipping"
          type="number"
          min={0}
          max={1000000}
          step="0.01"
          required
          value={shipping}
          onChange={(event) => setShipping(event.target.value)}
        />
        <output className="operation-total">
          Total:{" "}
          {money(
            items.reduce(
              (total, item) => total + item.unitPriceInCents * item.units,
              0,
            ) + Math.round(Number(shipping || 0) * 100),
          )}
        </output>
        <Submit pending={pending} disabled={!items.length}>
          Crear orden
        </Submit>
      </fieldset>
    </form>
  );
}

function ShipmentForm({ token, storeId, pending, save }: FormProps) {
  const [order, setOrder] = useState<ShipmentOrderOption | null>(null);
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    const data = new FormData(event.currentTarget);
    void save({
      orderId: order.id,
      method: text(data, "method"),
      provider: text(data, "provider"),
      ...(text(data, "trackingCode")
        ? { trackingCode: text(data, "trackingCode") }
        : {}),
      ...(text(data, "pickup")
        ? { pickupScheduledAt: new Date(text(data, "pickup")).toISOString() }
        : {}),
    });
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="operation-fields">
        <RecordPicker<ShipmentOrderOption>
          token={token}
          storeId={storeId}
          resource="shipment-orders"
          title="Orden sin envío"
          describe={(record) =>
            `${record.orderNumber} · ${money(record.shippingInCents)}`
          }
          onSelect={setOrder}
        />
        {order && (
          <output>
            {order.orderNumber} · Costo de envío: {money(order.shippingInCents)}
          </output>
        )}
        <SelectField
          title="Método de envío"
          name="method"
          options={["Courier", "Agencia", "Reparto Gami"]}
        />
        <Field
          label="Proveedor de transporte"
          name="provider"
          minLength={2}
          maxLength={80}
          required
        />
        <Field
          label="Código de seguimiento (opcional)"
          name="trackingCode"
          minLength={2}
          maxLength={120}
        />
        <Field
          label="Recojo programado (opcional)"
          name="pickup"
          type="datetime-local"
        />
        <Submit pending={pending} disabled={!order}>
          Registrar envío
        </Submit>
      </fieldset>
    </form>
  );
}
