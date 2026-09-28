import {
  adminRequest,
  type CreateUserInput,
  type InformationPage,
} from "./admin-api";

export const STORE_ROLE_LABELS = {
  STORE_ADMIN: "Administrador de tienda",
  STORE_OPERATOR: "Operador de tienda",
  STORE_CATALOG: "Catálogo",
  STORE_ATTENTION: "Atención y órdenes",
  STORE_LOGISTICS: "Inventario y envíos",
  STORE_FINANCE: "Finanzas",
} as const;
export type StoreRole = keyof typeof STORE_ROLE_LABELS;
export type StoreResource =
  | "products"
  | "inventory"
  | "orders"
  | "shipments"
  | "payouts"
  | "ledger"
  | "members"
  | "profile";
export type WorkspaceStore = {
  id: string;
  displayName: string;
  status: string;
  role: StoreRole;
  permissions: StoreResource[];
  writePermissions: StoreOperation[];
};
export type StoreOperation = "products" | "orders" | "inventory" | "shipments";
export type OperationOptions = {
  types: Record<string, string[]>;
  colors: string[];
  genders: string[];
  patterns: string[];
  fits: string[];
  lengths: string[];
};
export type OperationVariant = {
  id: string;
  sku: string;
  productName: string;
  sizeLabel: string;
  color: string;
  unitPriceInCents: number;
  quantity: number | null;
  available: number | null;
};
export type ShipmentOrderOption = {
  id: string;
  orderNumber: string;
  status: string;
  shippingInCents: number;
};
export type OperationPage<T> = {
  data: T[];
  page: number;
  pages: number;
  total: number;
};
export type StoreMember = {
  userId: string;
  username: string;
  displayName: string;
  email: string | null;
  status: string;
  role: StoreRole;
  active: boolean;
  isOwner: boolean;
};
export type StoreTeamPage = {
  data: StoreMember[];
  total: number;
  page: number;
  pages: number;
};
export type StoreProfile = {
  id: string;
  displayName: string;
  legalName: string | null;
  gallery: string | null;
  standNumber: string | null;
  whatsappNumber: string;
  status: string;
};

const base = (storeId: string) =>
  `/store-workspace/stores/${encodeURIComponent(storeId)}`;

export function getOperationOptions(
  token: string,
  storeId: string,
  signal: AbortSignal,
) {
  return adminRequest<OperationOptions>(
    token,
    `${base(storeId)}/operation-options`,
    { signal },
  );
}
export function getOperationRecords<T>(
  token: string,
  storeId: string,
  resource: "order-variants" | "inventory-variants" | "shipment-orders",
  search: string,
  page: number,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ search, page: String(page) });
  return adminRequest<OperationPage<T>>(
    token,
    `${base(storeId)}/${resource}?${query}`,
    { signal, cache: "no-store" },
  );
}
export function saveStoreOperation(
  token: string,
  storeId: string,
  operation: StoreOperation,
  input: object,
  variantId?: string,
) {
  const suffix =
    operation === "inventory"
      ? `/inventory/${encodeURIComponent(variantId ?? "")}`
      : `/${operation}`;
  return adminRequest<{
    id?: string;
    orderNumber?: string;
    status?: string;
    quantity?: number;
  }>(token, `${base(storeId)}${suffix}`, {
    method: operation === "inventory" ? "PATCH" : "POST",
    body: JSON.stringify(input),
  });
}
export function listWorkspaceStores(token: string, signal?: AbortSignal) {
  return adminRequest<WorkspaceStore[]>(token, "/store-workspace/stores", {
    signal,
    cache: "no-store",
  });
}
export function getStoreInformation(
  token: string,
  storeId: string,
  resource: string,
  page: number,
  search: string,
  signal: AbortSignal,
) {
  const parameters = new URLSearchParams({ page: String(page), search });
  return adminRequest<InformationPage>(
    token,
    `${base(storeId)}/information/${encodeURIComponent(resource)}?${parameters}`,
    { signal, cache: "no-store" },
  );
}
export function getStoreProfile(
  token: string,
  storeId: string,
  signal: AbortSignal,
) {
  return adminRequest<StoreProfile>(token, `${base(storeId)}/profile`, {
    signal,
    cache: "no-store",
  });
}
export function listStoreTeam(
  token: string,
  storeId: string,
  page: number,
  search: string,
  signal: AbortSignal,
) {
  const parameters = new URLSearchParams({ page: String(page), search });
  return adminRequest<StoreTeamPage>(
    token,
    `${base(storeId)}/members?${parameters}`,
    { signal, cache: "no-store" },
  );
}
export function createStoreMember(
  token: string,
  storeId: string,
  input: Pick<
    CreateUserInput,
    "username" | "displayName" | "email" | "phone" | "storeRole"
  >,
) {
  return adminRequest<{ userId: string; temporaryPassword: string }>(
    token,
    `${base(storeId)}/members`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
export function updateStoreMember(
  token: string,
  storeId: string,
  userId: string,
  input: { role: StoreRole; active: boolean; reason: string },
) {
  return adminRequest<StoreMember>(
    token,
    `${base(storeId)}/members/${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
