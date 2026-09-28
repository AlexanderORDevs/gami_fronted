import { ApiError, localizedApiError } from "./auth-api";
import type { StoreRole } from "./store-api";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  system: boolean;
};

export type StoreMembership = {
  storeId: string;
  storeName: string;
  isOwner: boolean;
  active: boolean;
  role: StoreRole;
};

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  storeMemberships: StoreMembership[];
};

export type UserList = {
  data: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type AuditEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  fromState: string | null;
  toState: string | null;
  reason: string | null;
  channel: string;
  metadata: unknown;
  occurredAt: string;
};

export type AuditList = {
  data: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type CreateUserInput = {
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  storeId?: string;
  isOwner?: boolean;
  storeRole?: StoreRole;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

export async function adminRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  }).catch(() => {
    throw new Error(
      "No se pudo conectar con Gami. Revisa tu conexión e inténtalo de nuevo.",
    );
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(" ")
      : payload?.message;
    throw new ApiError(
      localizedApiError(message, response.status),
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listRoles(accessToken: string) {
  return adminRequest<Role[]>(accessToken, "/admin/roles");
}

export type StoreHour = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
};
export type StoreInput = {
  displayName: string;
  legalName: string;
  gallery: string;
  standNumber: string;
  whatsappNumber: string;
  hours: StoreHour[];
  reason: string;
};
export type StoreDetail = Omit<
  StoreInput,
  "reason" | "legalName" | "gallery" | "standNumber"
> & {
  id: string;
  legalName: string | null;
  gallery: string | null;
  standNumber: string | null;
  status: string;
  whatsappVerifiedAt: string | null;
  updatedAt: string;
  createdAt: string;
  members: {
    userId: string;
    isOwner: boolean;
    user: { displayName: string; username: string; status: string };
  }[];
};
export type StoreAudit = {
  id: string;
  action: string;
  reason: string | null;
  actor: string | null;
  occurredAt: string;
};
export function getStore(accessToken: string, id: string) {
  return adminRequest<StoreDetail>(accessToken, `/admin/stores/${id}`, {
    cache: "no-store",
  });
}
export function saveStore(
  accessToken: string,
  input: StoreInput,
  existing?: { id: string; updatedAt: string },
) {
  return adminRequest<StoreDetail>(
    accessToken,
    existing ? `/admin/stores/${existing.id}` : "/admin/stores",
    {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify({
        ...input,
        ...(existing ? { updatedAt: existing.updatedAt } : {}),
      }),
    },
  );
}
export function getStoreAudit(accessToken: string, id: string) {
  return adminRequest<StoreAudit[]>(
    accessToken,
    `/admin/stores/${id}/audit-log`,
    { cache: "no-store" },
  );
}

export type InformationResource =
  | "inventory"
  | "stores"
  | "products"
  | "orders"
  | "shipments"
  | "payouts"
  | "ledger"
  | "settings"
  | "calendar"
  | "shipping-rates";
export type InformationRow = { id: string } & Record<
  string,
  string | number | boolean | null
>;
export type InformationPage = {
  data: InformationRow[];
  total: number;
  page: number;
  pages: number;
};

export function getAdminInformation(
  accessToken: string,
  resource: InformationResource,
  page: number,
  search: string,
  signal: AbortSignal,
) {
  const parameters = new URLSearchParams({ page: String(page) });
  if (search.trim()) parameters.set("search", search.trim());
  return adminRequest<InformationPage>(
    accessToken,
    `/admin/information/${resource}?${parameters}`,
    { signal, cache: "no-store" },
  );
}

export function listUsers(
  accessToken: string,
  query: { page: number; limit: number; search?: string; status?: UserStatus },
) {
  const parameters = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.search) parameters.set("search", query.search);
  if (query.status) parameters.set("status", query.status);
  return adminRequest<UserList>(accessToken, `/admin/users?${parameters}`);
}

export function getUser(accessToken: string, userId: string) {
  return adminRequest<AdminUser>(accessToken, `/admin/users/${userId}`);
}

export function createUser(accessToken: string, input: CreateUserInput) {
  return adminRequest<{ user: AdminUser; temporaryPassword: string }>(
    accessToken,
    "/admin/users",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateUserStatus(
  accessToken: string,
  userId: string,
  status: UserStatus,
  reason: string,
) {
  return adminRequest<AdminUser>(accessToken, `/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

export function grantRole(
  accessToken: string,
  userId: string,
  roleCode: string,
  reason: string,
) {
  return adminRequest<AdminUser>(accessToken, `/admin/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ roleCode, reason }),
  });
}

export function revokeRole(
  accessToken: string,
  userId: string,
  roleCode: string,
  reason: string,
) {
  return adminRequest<AdminUser>(
    accessToken,
    `/admin/users/${userId}/roles/${encodeURIComponent(roleCode)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    },
  );
}

export function grantStore(
  accessToken: string,
  userId: string,
  storeId: string,
  isOwner: boolean,
  reason: string,
  storeRole?: StoreRole,
) {
  return adminRequest<AdminUser>(accessToken, `/admin/users/${userId}/stores`, {
    method: "POST",
    body: JSON.stringify({ storeId, isOwner, reason, storeRole }),
  });
}

export function revokeStore(
  accessToken: string,
  userId: string,
  storeId: string,
  reason: string,
) {
  return adminRequest<AdminUser>(
    accessToken,
    `/admin/users/${userId}/stores/${storeId}`,
    {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    },
  );
}

export function resetPassword(
  accessToken: string,
  userId: string,
  reason: string,
) {
  return adminRequest<{ temporaryPassword: string; mustChangePassword: true }>(
    accessToken,
    `/admin/users/${userId}/reset-password`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export function revokeSessions(
  accessToken: string,
  userId: string,
  reason: string,
) {
  return adminRequest<void>(accessToken, `/admin/users/${userId}/sessions`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
}

export function getUserAudit(accessToken: string, userId: string, page = 1) {
  return adminRequest<AuditList>(
    accessToken,
    `/admin/users/${userId}/audit-log?page=${page}&limit=20`,
  );
}
