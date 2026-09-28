"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  RefreshCw,
  Search,
  Settings,
  Shirt,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  getAdminInformation,
  type InformationPage,
  type InformationResource,
  type InformationRow,
} from "@/lib/admin-api";
import "./admin-information.css";
import { getStoreInformation, type WorkspaceStore } from "@/lib/store-api";
import { OperationStoreSelect, OperationToolbar } from "./store-operations";

export const ADMIN_SECTIONS = [
  { id: "users", label: "Usuarios y accesos", icon: Users },
  { id: "stores", label: "Tiendas", icon: Store },
  { id: "products", label: "Catálogo interno", icon: Shirt },
  { id: "orders", label: "Órdenes", icon: ShoppingBag },
  { id: "warehouse", label: "Almacén", icon: Package },
  { id: "finance", label: "Finanzas", icon: Wallet },
  { id: "configuration", label: "Configuración", icon: Settings },
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number]["id"];
type InformationSection = Exclude<AdminSection, "users">;

function subscribeSection(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function sectionSnapshot(): AdminSection {
  const hash = location.hash.slice(1);
  return ADMIN_SECTIONS.find((section) => section.id === hash)?.id ?? "users";
}
export function useAdminSection() {
  return useSyncExternalStore(
    subscribeSection,
    sectionSnapshot,
    () => "users" as AdminSection,
  );
}

type Column = {
  key: string;
  label: string;
  format?: "money" | "date" | "day" | "status" | "boolean" | "setting";
  detailOnly?: boolean;
};
type ResourceDefinition = {
  label: string;
  searchLabel: string;
  columns: Column[];
};
const created: Column = {
  key: "createdAt",
  label: "Fecha de registro",
  format: "date",
};
const status: Column = { key: "status", label: "Estado", format: "status" };
const store: Column = { key: "store", label: "Tienda" };
const amount: Column = {
  key: "amountInCents",
  label: "Importe",
  format: "money",
};

const RESOURCES: Record<InformationResource, ResourceDefinition> = {
  inventory: {
    label: "Inventario",
    searchLabel: "Buscar prenda o SKU",
    columns: [
      { key: "productName", label: "Prenda" },
      { key: "sku", label: "SKU" },
      { key: "sizeLabel", label: "Talla" },
      { key: "color", label: "Color" },
      { key: "quantity", label: "Stock" },
      { key: "stockUpdatedAt", label: "Actualización", format: "date" },
    ],
  },
  stores: {
    label: "Tiendas",
    searchLabel: "Buscar por nombre de tienda",
    columns: [
      { key: "displayName", label: "Tienda" },
      status,
      { key: "gallery", label: "Galería" },
      { key: "products", label: "Prendas" },
      { key: "members", label: "Integrantes" },
      { ...created, detailOnly: true },
      { key: "legalName", label: "Razón social", detailOnly: true },
      { key: "standNumber", label: "Puesto", detailOnly: true },
      {
        key: "whatsappVerifiedAt",
        label: "Verificación de WhatsApp",
        format: "date",
        detailOnly: true,
      },
    ],
  },
  products: {
    label: "Prendas",
    searchLabel: "Buscar por nombre de prenda",
    columns: [
      { key: "name", label: "Prenda" },
      store,
      status,
      { key: "category", label: "Categoría" },
      { key: "unitPriceInCents", label: "Precio unitario", format: "money" },
      { key: "variants", label: "Variantes activas", detailOnly: true },
      { key: "garmentType", label: "Tipo de prenda", detailOnly: true },
      { key: "description", label: "Descripción", detailOnly: true },
      {
        key: "wholesalePriceInCents",
        label: "Precio por mayor",
        format: "money",
        detailOnly: true,
      },
      { key: "wholesaleMinimum", label: "Mínimo por mayor", detailOnly: true },
      {
        key: "updatedAt",
        label: "Actualización",
        format: "date",
        detailOnly: true,
      },
    ],
  },
  orders: {
    label: "Órdenes",
    searchLabel: "Buscar por número de orden",
    columns: [
      { key: "orderNumber", label: "Orden" },
      status,
      { key: "stores", label: "Tiendas" },
      { key: "totalInCents", label: "Total", format: "money" },
      created,
      {
        key: "subtotalInCents",
        label: "Subtotal",
        format: "money",
        detailOnly: true,
      },
      {
        key: "shippingInCents",
        label: "Envío",
        format: "money",
        detailOnly: true,
      },
      {
        key: "discountInCents",
        label: "Descuento",
        format: "money",
        detailOnly: true,
      },
      {
        key: "promisedDeliveryStartAt",
        label: "Inicio de entrega prevista",
        format: "date",
        detailOnly: true,
      },
      {
        key: "promisedDeliveryEndAt",
        label: "Fin de entrega prevista",
        format: "date",
        detailOnly: true,
      },
    ],
  },
  shipments: {
    label: "Envíos",
    searchLabel: "Buscar por número de orden",
    columns: [
      { key: "orderNumber", label: "Orden" },
      status,
      { key: "provider", label: "Transportista" },
      { key: "trackingCode", label: "Seguimiento" },
      { key: "pickupScheduledAt", label: "Recojo programado", format: "date" },
      { key: "method", label: "Método de envío", detailOnly: true },
      {
        key: "pickedUpAt",
        label: "Recogido",
        format: "date",
        detailOnly: true,
      },
      {
        key: "dispatchedAt",
        label: "Despachado",
        format: "date",
        detailOnly: true,
      },
      {
        key: "deliveredAt",
        label: "Entregado",
        format: "date",
        detailOnly: true,
      },
      { ...created, detailOnly: true },
    ],
  },
  payouts: {
    label: "Liquidaciones",
    searchLabel: "Buscar por nombre de tienda",
    columns: [
      store,
      status,
      amount,
      { key: "scheduledAt", label: "Fecha programada", format: "date" },
      { key: "paidAt", label: "Fecha de pago", format: "date" },
      { ...created, detailOnly: true },
    ],
  },
  ledger: {
    label: "Libro mayor",
    searchLabel: "Buscar por nombre de tienda",
    columns: [
      store,
      { key: "type", label: "Movimiento", format: "status" },
      amount,
      created,
      { key: "description", label: "Descripción", detailOnly: true },
    ],
  },
  settings: {
    label: "Parámetros",
    searchLabel: "Buscar por clave del parámetro",
    columns: [
      { key: "key", label: "Parámetro", format: "setting" },
      { key: "value", label: "Valor" },
      { key: "updatedAt", label: "Actualización", format: "date" },
    ],
  },
  calendar: {
    label: "Calendario",
    searchLabel: "Buscar por descripción del día",
    columns: [
      { key: "date", label: "Fecha", format: "day" },
      { key: "isWorkingDay", label: "Día laborable", format: "boolean" },
      { key: "description", label: "Descripción" },
    ],
  },
  "shipping-rates": {
    label: "Tarifas de envío",
    searchLabel: "Buscar por distrito",
    columns: [
      { key: "district", label: "Distrito" },
      { key: "zoneType", label: "Zona", format: "status" },
      { key: "rateInCents", label: "Tarifa", format: "money" },
      { key: "active", label: "Activa", format: "boolean" },
      { key: "minItems", label: "Mínimo de prendas", detailOnly: true },
      { key: "maxItems", label: "Máximo de prendas", detailOnly: true },
      {
        key: "effectiveFrom",
        label: "Vigente desde",
        format: "date",
        detailOnly: true,
      },
      {
        key: "effectiveTo",
        label: "Vigente hasta",
        format: "date",
        detailOnly: true,
      },
    ],
  },
};

const SECTION_RESOURCES: Record<InformationSection, InformationResource[]> = {
  stores: ["stores"],
  products: ["products"],
  orders: ["orders"],
  warehouse: ["inventory", "shipments"],
  finance: ["payouts", "ledger"],
  configuration: ["settings", "calendar", "shipping-rates"],
};
const SECTION_DESCRIPTIONS: Record<InformationSection, string> = {
  stores: "Directorio de tiendas y situación comercial.",
  products: "Prendas registradas y estado de publicación.",
  orders: "Órdenes registradas y fechas de entrega previstas.",
  warehouse: "Envíos, recojos y seguimiento logístico.",
  finance: "Liquidaciones registradas y movimientos contables.",
  configuration: "Parámetros operativos, calendario y tarifas vigentes.",
};
const LABELS: Record<string, string> = {
  APPLIED: "Solicitud recibida",
  UNDER_REVIEW: "En revisión",
  PENDING_DOCUMENTS: "Documentos pendientes",
  ACTIVE: "Activa",
  SUSPENDED: "Suspendida",
  REJECTED: "Rechazada",
  CLOSED: "Cerrada",
  DRAFT: "Borrador",
  CHANGES_REQUESTED: "Cambios solicitados",
  APPROVED: "Aprobada",
  PUBLISHED: "Publicada",
  UNPUBLISHED: "No publicada",
  UNPUBLISHED_BY_SUSPENSION: "Retirada por suspensión",
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagada",
  PARTIALLY_CONFIRMED: "Confirmación parcial",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  FULFILLING: "En preparación",
  DELIVERED: "Entregada",
  PENDING: "Pendiente",
  READY_FOR_PICKUP: "Lista para recojo",
  PICKED_UP: "Recogida",
  CONSOLIDATING: "En consolidación",
  DISPATCHED: "Despachada",
  IN_TRANSIT: "En tránsito",
  FAILED: "Fallida",
  RETURNED: "Devuelta",
  PROCESSING: "En proceso",
  SALE: "Venta",
  COMMISSION: "Comisión",
  PAYOUT: "Liquidación",
  REFUND: "Reembolso",
  COMPENSATION: "Compensación",
  ADJUSTMENT: "Ajuste",
  LIMA: "Lima",
  PROVINCE: "Provincia",
  AGENCY: "Agencia",
  stock_hold_ttl_minutes: "Vencimiento de reserva (minutos)",
  confirmation_sla_minutes: "Plazo de confirmación (minutos)",
  whatsapp_delivery_tolerance_minutes: "Tolerancia de WhatsApp (minutos)",
  active_strike_limit: "Límite de sanciones activas",
  strike_expiration_days: "Vigencia de sanción (días)",
  appeal_window_days: "Plazo de apelación (días)",
};

function formatValue(row: InformationRow, column: Column): string {
  const value = row[column.key];
  if (value === null || value === undefined || value === "")
    return "Sin registrar";
  if (column.format === "money")
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: String(row.currency ?? "PEN"),
    }).format(Number(value) / 100);
  if (column.format === "date")
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(String(value)));
  if (column.format === "day")
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(String(value)));
  if (column.format === "boolean") return value ? "Sí" : "No";
  if (column.format === "status" || column.format === "setting")
    return LABELS[String(value)] ?? String(value);
  return String(value);
}

function RecordDetail({
  row,
  definition,
  onClose,
}: Readonly<{
  row: InformationRow;
  definition: ResourceDefinition;
  onClose: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="information-dialog"
      aria-labelledby="information-detail-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header>
        <div>
          <p className="eyebrow">{definition.label}</p>
          <h2 id="information-detail-title">Detalle del registro</h2>
        </div>
        <button
          className="icon-button bordered"
          onClick={onClose}
          title="Cerrar detalle"
          aria-label="Cerrar detalle"
        >
          <X size={18} />
        </button>
      </header>
      <dl>
        {definition.columns.map((column) => (
          <div key={column.key}>
            <dt>{column.label}</dt>
            <dd>{formatValue(row, column)}</dd>
          </div>
        ))}
        <div>
          <dt>Identificador</dt>
          <dd className="record-id">{row.id}</dd>
        </div>
      </dl>
    </dialog>
  );
}

const EMPTY_PAGE: InformationPage = { data: [], total: 0, page: 1, pages: 0 };

export function InformationTable({
  accessToken,
  resource,
  onOpen,
  revision = 0,
  storeId,
}: Readonly<{
  accessToken: string;
  resource: InformationResource;
  onOpen?: (id: string) => void;
  revision?: number;
  storeId?: string;
}>) {
  const definition =
    storeId && resource === "orders"
      ? {
          label: "Atención y órdenes",
          searchLabel: "Buscar por número de orden",
          columns: [
            { key: "orderNumber", label: "Orden" },
            status,
            {
              key: "subtotalInCents",
              label: "Importe de tu tienda",
              format: "money" as const,
            },
            {
              key: "confirmationDueAt",
              label: "Plazo de atención",
              format: "date" as const,
            },
            { key: "items", label: "Prendas", detailOnly: true },
            created,
          ],
        }
      : RESOURCES[resource];
  const detailDefinition =
    storeId && resource === "products"
      ? {
          ...definition,
          columns: [
            ...definition.columns,
            {
              key: "variantSummary",
              label: "Tallas, colores y stock",
              detailOnly: true,
            },
          ],
        }
      : definition;
  const columns = definition.columns.filter((column) => !column.detailOnly);
  const [query, setQuery] = useState({ page: 1, search: "" });
  const [input, setInput] = useState("");
  const [result, setResult] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<InformationRow | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = storeId
          ? await getStoreInformation(
              accessToken,
              storeId,
              resource,
              query.page,
              query.search,
              controller.signal,
            )
          : await getAdminInformation(
              accessToken,
              resource,
              query.page,
              query.search,
              controller.signal,
            );
        if (!controller.signal.aborted) setResult(data);
      } catch (error_: unknown) {
        if (!controller.signal.aborted) {
          setResult(EMPTY_PAGE);
          setError(
            error_ instanceof Error
              ? error_.message
              : "No se pudo cargar la información.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [accessToken, resource, query, retry, revision, storeId]);
  function search(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery({ page: 1, search: input.trim() });
  }

  return (
    <>
      <div className="admin-toolbar information-toolbar">
        <form className="search-form" role="search" onSubmit={search}>
          <Search size={18} />
          <input
            aria-label={definition.searchLabel}
            placeholder={definition.searchLabel}
            maxLength={120}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" title="Buscar" aria-label="Buscar">
            <Search size={17} />
          </button>
        </form>
        <button
          className="icon-button bordered"
          onClick={() => setRetry((value) => value + 1)}
          disabled={loading}
          title="Actualizar información"
          aria-label="Actualizar información"
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {error && (
        <div className="information-error" role="alert">
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      )}
      {!error && (
        <>
          <section
            className="information-table-wrap"
            tabIndex={0}
            aria-label={definition.label}
            aria-busy={loading}
          >
            <table className="information-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} scope="col">
                      {column.label}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  result.data.map((row) => (
                    <tr key={row.id}>
                      {columns.map((column) => (
                        <td key={column.key}>
                          {column.format === "status" ? (
                            <span className="information-status">
                              {formatValue(row, column)}
                            </span>
                          ) : (
                            formatValue(row, column)
                          )}
                        </td>
                      ))}
                      <td>
                        <button
                          className="icon-button bordered"
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${formatValue(row, columns[0])}`}
                          onClick={() =>
                            onOpen ? onOpen(row.id) : setSelected(row)
                          }
                        >
                          <Eye size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {loading && (
              <div className="information-empty">
                <output>Cargando información...</output>
              </div>
            )}
            {!loading && !result.data.length && (
              <div className="information-empty">
                <Package size={28} strokeWidth={1} />
                <h2>Sin registros</h2>
                <p>
                  {query.search
                    ? "No hay coincidencias con esta búsqueda."
                    : "Todavía no hay información registrada."}
                </p>
                {query.search && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setInput("");
                      setQuery({ page: 1, search: "" });
                    }}
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
            )}
          </section>
          <footer className="table-footer">
            <output>
              {result.total} registros · Página {query.page} de{" "}
              {Math.max(result.pages, query.page)}
            </output>
            <div>
              <button
                className="icon-button bordered"
                disabled={loading || query.page <= 1}
                aria-label="Página anterior"
                title="Página anterior"
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button bordered"
                disabled={loading || query.page >= result.pages}
                aria-label="Página siguiente"
                title="Página siguiente"
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        </>
      )}
      {selected && (
        <RecordDetail
          row={selected}
          definition={detailDefinition}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

export function AdminInformation({
  accessToken,
  section,
}: Readonly<{ accessToken: string; section: InformationSection }>) {
  const resources = SECTION_RESOURCES[section];
  const [resource, setResource] = useState(resources[0]);
  const [selectedStore, setSelectedStore] = useState<WorkspaceStore | null>(
    null,
  );
  const [revision, setRevision] = useState(0);
  const operational = ["products", "orders", "inventory", "shipments"].includes(
    resource,
  );
  const label = ADMIN_SECTIONS.find((item) => item.id === section)!.label;
  return (
    <section
      className="admin-shell information-shell"
      aria-labelledby="information-title"
    >
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1 id="information-title">{label}</h1>
          <p>{SECTION_DESCRIPTIONS[section]}</p>
        </div>
        {!operational && (
          <span className="information-mode">
            <Eye size={15} /> Solo consulta
          </span>
        )}
      </div>
      <nav className="information-tabs" aria-label={`Secciones de ${label}`}>
        {resources.map((item) => (
          <button
            key={item}
            aria-current={item === resource ? "page" : undefined}
            onClick={() => setResource(item)}
          >
            {RESOURCES[item].label}
          </button>
        ))}
      </nav>
      {operational && (
        <>
          <OperationStoreSelect
            token={accessToken}
            value={selectedStore?.id ?? ""}
            onChange={setSelectedStore}
          />
          <OperationToolbar
            key={`${resource}:${selectedStore?.id ?? ""}`}
            token={accessToken}
            store={selectedStore}
            resource={resource}
            onSaved={() => setRevision((current) => current + 1)}
          />
        </>
      )}
      {resource === "inventory" && !selectedStore ? (
        <p>Sin tienda seleccionada.</p>
      ) : (
        <InformationTable
          key={`${resource}:${selectedStore?.id ?? ""}:${accessToken}`}
          accessToken={accessToken}
          resource={resource}
          storeId={operational ? selectedStore?.id : undefined}
          revision={revision}
        />
      )}
    </section>
  );
}
