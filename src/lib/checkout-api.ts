export type CartItem = {
  variantId: string;
  productId: string;
  name: string;
  storeName: string;
  imageUrl: string | null;
  size: string;
  color: string;
  unitPriceInCents: number;
  quantity: number;
  availableStock: number;
};
export type DeliveryDestination = {
  zoneType: "LIMA" | "PROVINCE" | "AGENCY";
  district: string | null;
};
export type CheckoutQuoteInput = {
  items: { variantId: string; quantity: number }[];
  zoneType: DeliveryDestination["zoneType"];
  district?: string;
};
export type CheckoutQuote = {
  subtotalInCents: number;
  shippingInCents: number;
  totalInCents: number;
  currency: "PEN";
  lines: {
    variantId: string;
    productName: string;
    storeName: string;
    size: string;
    color: string;
    quantity: number;
    unitPriceInCents: number;
    totalInCents: number;
  }[];
};
export type CheckoutOrderInput = CheckoutQuoteInput & {
  requestId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  recipientName: string;
  recipientPhone: string;
  city: string;
  agency?: string;
  line1: string;
  reference?: string;
  expectedSubtotalInCents: number;
  expectedShippingInCents: number;
};
export type CheckoutReceipt = {
  orderNumber: string;
  status: "PENDING_PAYMENT";
  subtotalInCents: number;
  shippingInCents: number;
  totalInCents: number;
  stockReservedUntil: string;
};
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

export async function checkoutRequest<T>(
  path: string,
  input?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_URL}/checkout/${path}`, {
    method: input ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(input ? { body: JSON.stringify(input) } : {}),
    signal,
    cache: "no-store",
  }).catch(() => {
    throw new Error(
      "No pudimos conectar con Gami. Reintenta sin cerrar esta ventana.",
    );
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    if (response.status === 429)
      throw new Error(
        "Demasiados intentos. Espera un minuto antes de volver a intentar.",
      );
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Revisa los datos de entrega y las cantidades.",
    );
  }
  return response.json() as Promise<T>;
}
