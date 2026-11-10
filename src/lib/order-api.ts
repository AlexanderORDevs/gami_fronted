import { adminRequest } from "./admin-api";

export type OrderRequest = <T>(
  path: string,
  method?: string,
  input?: object,
  signal?: AbortSignal,
) => Promise<T>;
export type OrderIncident = {
  id: string;
  type: string;
  description: string;
  affectedItems:
    | {
        orderItemId: string;
        quantity?: number;
        missingQuantity?: number;
        confirmedQuantity?: number;
      }[]
    | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  resolution: string | null;
  resolvedAt: string | null;
};
export type ManagedOrderItem = {
  id: string;
  productName: string;
  sizeLabel: string;
  color: string;
  quantity: number;
  confirmedQuantity: number | null;
  unitPriceInCents: number;
  totalInCents: number;
};
export type ManagedSuborder = {
  id: string;
  storeId: string;
  storeName: string;
  status: string;
  subtotalInCents: number;
  updatedAt: string;
  confirmedAt: string | null;
  rejectedAt: string | null;
  canConfirm: boolean;
  confirmationBlock: string | null;
  canReportIncident: boolean;
  items: ManagedOrderItem[];
  incidents: OrderIncident[];
};
export type ManagedOrder = {
  orderNumber: string;
  scope: "admin" | "store" | "customer";
  status: string | null;
  currency: string;
  createdAt: string;
  subtotalInCents: number;
  shippingInCents: number | null;
  discountInCents: number | null;
  totalInCents: number;
  paymentStatus: string | null;
  paymentVerified: boolean;
  customer: { fullName: string; phone: string; email: string | null } | null;
  shippingAddress: {
    recipientName: string;
    recipientPhone: string;
    zoneType: string;
    city: string;
    district: string | null;
    agency: string | null;
    line1: string;
    reference: string | null;
  } | null;
  suborders: ManagedSuborder[];
  timeline: {
    action: string;
    occurredAt: string;
    reason: string | null;
    channel: string;
  }[];
  canReviewIncidents: boolean;
};
export function staffOrderRequest(token: string): OrderRequest {
  return <T>(
    path: string,
    method = "GET",
    input?: object,
    signal?: AbortSignal,
  ) =>
    adminRequest<T>(token, path, {
      method,
      ...(input ? { body: JSON.stringify(input) } : {}),
      signal,
      cache: "no-store",
    });
}
export const orderPath = (orderNumber: string) =>
  `/order-management/orders/${encodeURIComponent(orderNumber)}`;
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagada",
  PARTIALLY_CONFIRMED: "Confirmada parcialmente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  FULFILLING: "En preparación",
  DELIVERED: "Entregada",
  CLOSED: "Cerrada",
  PENDING_CONFIRMATION: "Pendiente de confirmación",
  PRE_CONFIRMED: "Preconfirmada",
  REJECTED: "Rechazada",
  PICKED_UP: "Recogida",
  QUALITY_CONTROL: "Control de calidad",
  READY_FOR_SHIPMENT: "Lista para envío",
  EXCEPTION: "Con incidencia",
};
export const INCIDENT_LABELS: Record<string, string> = {
  OUT_OF_STOCK: "Falta de stock",
  ITEM_MISMATCH: "Prenda diferente",
  DAMAGED_ITEM: "Prenda dañada",
  OTHER: "Otra incidencia",
};
