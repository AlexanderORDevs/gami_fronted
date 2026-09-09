import { ApiError } from "./auth-api";

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
  email?: string;
  phone?: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

async function adminRequest<T>(
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
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(" ")
      : payload?.message;
    throw new ApiError(
      message ?? "The request could not be completed.",
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listRoles(accessToken: string) {
  return adminRequest<Role[]>(accessToken, "/admin/roles");
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
) {
  return adminRequest<AdminUser>(accessToken, `/admin/users/${userId}/stores`, {
    method: "POST",
    body: JSON.stringify({ storeId, isOwner, reason }),
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
