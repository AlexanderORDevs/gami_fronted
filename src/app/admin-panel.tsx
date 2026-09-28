"use client";

import {
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Copy,
  KeyRound,
  RefreshCw,
  Search,
  Shield,
  Store,
  UserRound,
  UserCog,
  X,
} from "lucide-react";
import { SyntheticEvent, useEffect, useState } from "react";
import {
  AdminUser,
  AuditEntry,
  CreateUserInput,
  InformationPage,
  InformationRow,
  Role,
  UserList,
  UserStatus,
  createUser,
  getAdminInformation,
  getUserAudit,
  grantRole,
  grantStore,
  listRoles,
  listUsers,
  resetPassword,
  revokeRole,
  revokeSessions,
  revokeStore,
  updateUserStatus,
} from "@/lib/admin-api";
import { STORE_ROLE_LABELS, type StoreRole } from "@/lib/store-api";

type Action =
  | { kind: "status"; status: UserStatus }
  | { kind: "grant-role"; roleCode: string }
  | { kind: "revoke-role"; roleCode: string }
  | {
      kind: "grant-store";
      storeId: string;
      isOwner: boolean;
      storeRole?: StoreRole;
      storeName?: string;
    }
  | { kind: "revoke-store"; storeId: string }
  | { kind: "reset-password" }
  | { kind: "revoke-sessions" };

const EMPTY_LIST: UserList = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  pages: 0,
};
const EMPTY_USER: CreateUserInput = {
  username: "",
  displayName: "",
  email: "",
  phone: "",
};

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function messageFrom(error_: unknown) {
  return error_ instanceof Error
    ? error_.message
    : "No se pudo completar la operación.";
}

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  DISABLED: "Deshabilitado",
};
const ACTION_LABELS: Record<Action["kind"], string> = {
  status: "Cambiar estado",
  "grant-role": "Asignar rol",
  "revoke-role": "Retirar rol",
  "grant-store": "Asignar tienda",
  "revoke-store": "Retirar acceso a tienda",
  "reset-password": "Restablecer contraseña",
  "revoke-sessions": "Cerrar todas las sesiones",
};
const ROLE_LABELS: Record<string, string> = {
  CATALOG_MANAGER: "Responsable de catálogo",
  OPERATIONS_MANAGER: "Responsable de operaciones",
  WAREHOUSE_OPERATOR: "Operador de almacén",
  FINANCE_MANAGER: "Responsable de finanzas",
  STORE_OPERATOR: "Operador de tienda",
  SUPER_ADMIN: "Administrador general",
  ADMIN: "Administrador",
  STORE_OWNER: "Propietario de tienda",
  STORE_MANAGER: "Encargado de tienda",
  STORE_STAFF: "Personal de tienda",
  CUSTOMER: "Cliente",
  OPERATIONS: "Operaciones",
  OPS: "Operaciones",
  FINANCE: "Finanzas",
  WAREHOUSE: "Almacén",
};
const roleLabel = (code: string) => ROLE_LABELS[code] ?? code;
const AUDIT_LABELS: Record<string, string> = {
  USER_CREATED: "Usuario creado",
  USER_STATUS_CHANGED: "Estado de usuario actualizado",
  USER_ROLE_GRANTED: "Rol asignado",
  USER_ROLE_REVOKED: "Rol retirado",
  USER_STORE_ACCESS_GRANTED: "Acceso a tienda asignado",
  USER_STORE_ACCESS_REVOKED: "Acceso a tienda retirado",
  USER_STORE_ROLE_CHANGED: "Rol de tienda actualizado",
  USER_PASSWORD_RESET: "Contraseña restablecida",
  USER_SESSIONS_REVOKED: "Sesiones cerradas",
  AUTH_LOGIN_SUCCEEDED: "Inicio de sesión",
  AUTH_REFRESH_REUSE_DETECTED: "Reutilización de sesión detectada",
  AUTH_TOKEN_REFRESHED: "Sesión renovada",
  AUTH_LOGOUT: "Cierre de sesión",
  AUTH_PASSWORD_CHANGED: "Contraseña cambiada",
  AUTH_PASSWORD_RECOVERED: "Contraseña recuperada",
};

function StatusBadge({ status }: Readonly<{ status: UserStatus }>) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function StorePicker({
  accessToken,
  value,
  onChange,
  disabled,
  required = false,
  selectedLabel,
}: Readonly<{
  accessToken: string;
  value: string;
  onChange: (storeId: string) => void;
  disabled: boolean;
  required?: boolean;
  selectedLabel?: string;
}>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<InformationPage>({
    data: [],
    total: 0,
    page: 1,
    pages: 0,
  });
  const [selected, setSelected] = useState<InformationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getAdminInformation(accessToken, "stores", page, search, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setResult(response);
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(messageFrom(error_));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, page, search, retry]);

  function changePage(next: number) {
    setLoading(true);
    setError("");
    setPage(next);
  }

  return (
    <fieldset className="store-picker" aria-label="Asignación de tienda">
      <label className="field">
        <span>Buscar tienda</span>
        <span className="input-shell">
          <Search size={16} aria-hidden="true" />
          <input
            value={search}
            maxLength={120}
            disabled={disabled}
            onChange={(event) => {
              setLoading(true);
              setError("");
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </span>
      </label>
      <label className="field">
        <span>{required ? "Tienda" : "Tienda (opcional)"}</span>
        <select
          value={value}
          required={required}
          disabled={disabled || loading || Boolean(error)}
          onChange={(event) => {
            const storeId = event.target.value;
            setSelected(
              result.data.find((store) => store.id === storeId) ?? null,
            );
            onChange(storeId);
          }}
        >
          <option value="">
            {required ? "Selecciona una tienda" : "Sin tienda"}
          </option>
          {value && !result.data.some((store) => store.id === value) && (
            <option value={value}>
              {String(
                selected?.displayName ?? selectedLabel ?? "Tienda seleccionada",
              )}
            </option>
          )}
          {result.data.map((store) => (
            <option key={store.id} value={store.id}>
              {String(store.displayName)}
            </option>
          ))}
        </select>
      </label>
      <div className="store-picker-pagination">
        <output>
          {loading ? "Cargando tiendas..." : `${result.total} tiendas`}
        </output>
        <div>
          <button
            type="button"
            className="icon-button bordered"
            title="Tiendas anteriores"
            aria-label="Tiendas anteriores"
            disabled={disabled || loading || page <= 1}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page} / {Math.max(1, result.pages)}
          </span>
          <button
            type="button"
            className="icon-button bordered"
            title="Tiendas siguientes"
            aria-label="Tiendas siguientes"
            disabled={disabled || loading || page >= result.pages}
            onClick={() => changePage(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {error && (
        <div role="alert">
          {error}{" "}
          <button
            type="button"
            className="icon-button bordered"
            title="Reintentar carga de tiendas"
            aria-label="Reintentar carga de tiendas"
            disabled={disabled}
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((current) => current + 1);
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}
    </fieldset>
  );
}

export function AdminPanel({ accessToken }: Readonly<{ accessToken: string }>) {
  const [users, setUsers] = useState<UserList>(EMPTY_LIST);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState<CreateUserInput>(EMPTY_USER);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function load(page = 1, nextSearch = search, nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const [userPage, roleList] = await Promise.all([
        listUsers(accessToken, {
          page,
          limit: 20,
          search: nextSearch.trim() || undefined,
          status: nextStatus || undefined,
        }),
        roles.length ? Promise.resolve(roles) : listRoles(accessToken),
      ]);
      setUsers(userPage);
      setRoles(roleList);
    } catch (error_) {
      setError(messageFrom(error_));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      listUsers(accessToken, { page: 1, limit: 20 }),
      listRoles(accessToken),
    ])
      .then(([userPage, roleList]) => {
        if (!active) return;
        setUsers(userPage);
        setRoles(roleList);
      })
      .catch((error_: unknown) => {
        if (active) setError(messageFrom(error_));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function openUser(user: AdminUser) {
    setSelected(user);
    setAudit([]);
    try {
      const history = await getUserAudit(accessToken, user.id);
      setAudit(history.data);
    } catch (error_) {
      setError(messageFrom(error_));
    }
  }

  async function handleSearch(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    await load(1);
  }

  async function handleCreate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const input: CreateUserInput = {
        ...newUser,
        phone: newUser.phone?.trim() || undefined,
        storeId: newUser.storeId || undefined,
        isOwner: newUser.storeId ? (newUser.isOwner ?? false) : undefined,
        storeRole: newUser.storeId ? newUser.storeRole : undefined,
      };
      const result = await createUser(accessToken, input);
      setTemporaryPassword(result.temporaryPassword);
      setCreateOpen(false);
      setNewUser(EMPTY_USER);
      await load(1);
      await openUser(result.user);
    } catch (error_) {
      setError(messageFrom(error_));
    } finally {
      setPending(false);
    }
  }

  async function handleAction(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !action) return;
    setPending(true);
    setError("");
    try {
      let updated: AdminUser | undefined;
      if (action.kind === "status")
        updated = await updateUserStatus(
          accessToken,
          selected.id,
          action.status,
          reason,
        );
      if (action.kind === "grant-role")
        updated = await grantRole(
          accessToken,
          selected.id,
          action.roleCode,
          reason,
        );
      if (action.kind === "revoke-role")
        updated = await revokeRole(
          accessToken,
          selected.id,
          action.roleCode,
          reason,
        );
      if (action.kind === "grant-store")
        updated = await grantStore(
          accessToken,
          selected.id,
          action.storeId,
          action.isOwner,
          reason,
          action.storeRole ??
            (action.isOwner ? "STORE_ADMIN" : "STORE_OPERATOR"),
        );
      if (action.kind === "revoke-store")
        updated = await revokeStore(
          accessToken,
          selected.id,
          action.storeId,
          reason,
        );
      if (action.kind === "reset-password") {
        const result = await resetPassword(accessToken, selected.id, reason);
        setTemporaryPassword(result.temporaryPassword);
      }
      if (action.kind === "revoke-sessions")
        await revokeSessions(accessToken, selected.id, reason);
      if (updated) setSelected(updated);
      setAction(null);
      setReason("");
      await load(users.page);
      const history = await getUserAudit(accessToken, selected.id);
      setAudit(history.data);
    } catch (error_) {
      setError(messageFrom(error_));
    } finally {
      setPending(false);
    }
  }

  const availableRoles = roles.filter(
    (role) => !selected?.roles.includes(role.code),
  );

  return (
    <section className="admin-shell">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Identidad y accesos</p>
          <div className="admin-title">
            <h1>Usuarios</h1>
            {!loading && <span className="result-count">{users.total}</span>}
          </div>
          <p>Equipo de Gami y personal de tiendas.</p>
        </div>
        <button className="primary-command" onClick={() => setCreateOpen(true)}>
          <CirclePlus size={18} /> Nuevo usuario
        </button>
      </div>

      <div className="admin-toolbar">
        <form className="search-form" onSubmit={handleSearch}>
          <Search size={18} />
          <input
            aria-label="Buscar usuarios"
            placeholder="Buscar nombre, usuario, correo o teléfono"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" aria-label="Buscar" title="Buscar">
            <Search size={16} />
          </button>
        </form>
        <select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) => {
            const next = event.target.value as UserStatus | "";
            setStatus(next);
            void load(1, search, next);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="SUSPENDED">Suspendido</option>
          <option value="DISABLED">Deshabilitado</option>
        </select>
        <button
          className="icon-button bordered"
          title="Actualizar usuarios"
          aria-label="Actualizar usuarios"
          onClick={() => void load(users.page)}
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {error && (
        <p className="admin-alert" role="alert">
          {error}
          <button
            onClick={() => setError("")}
            aria-label="Cerrar mensaje de error"
          >
            <X size={16} />
          </button>
        </p>
      )}

      <div className="user-table-wrap">
        <table className="user-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Estado</th>
              <th>Roles</th>
              <th>Tiendas</th>
              <th>Último acceso</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              users.data.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => void openUser(user)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void openUser(user);
                  }}
                >
                  <td>
                    <strong>{user.displayName}</strong>
                    <span>
                      @{user.username}
                      {user.email ? ` · ${user.email}` : ""}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td>
                    <div className="tag-row">
                      {user.roles.length ? (
                        user.roles.map((role) => (
                          <span key={role} title={role}>
                            {roleLabel(role)}
                          </span>
                        ))
                      ) : (
                        <em>Sin roles</em>
                      )}
                    </div>
                  </td>
                  <td>
                    {
                      user.storeMemberships.filter(
                        (membership) => membership.active,
                      ).length
                    }
                  </td>
                  <td>{formatDate(user.lastLoginAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading && <div className="empty-state">Cargando usuarios...</div>}
        {!loading && !users.data.length && (
          <div className="empty-state">No hay usuarios con estos filtros.</div>
        )}
      </div>

      <footer className="table-footer">
        <span>
          {users.total} usuarios · Página {users.page} de{" "}
          {Math.max(users.pages, 1)}
        </span>
        <div>
          <button
            className="icon-button bordered"
            disabled={users.page <= 1 || loading}
            onClick={() => void load(users.page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button bordered"
            disabled={users.page >= users.pages || loading}
            onClick={() => void load(users.page + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>

      {selected && (
        <div className="drawer-backdrop">
          <aside className="user-drawer" aria-label="Detalle del usuario">
            <header>
              <div>
                <p className="eyebrow">Perfil del usuario</p>
                <h2>{selected.displayName}</h2>
                <span>@{selected.username}</span>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelected(null)}
                aria-label="Cerrar detalle del usuario"
              >
                <X />
              </button>
            </header>
            <div className="drawer-section user-summary">
              <StatusBadge status={selected.status} />
              <span>
                {selected.mustChangePassword
                  ? "Debe cambiar su contraseña"
                  : "Contraseña establecida"}
              </span>
              <span>Creado el {formatDate(selected.createdAt)}</span>
              <span>Último acceso: {formatDate(selected.lastLoginAt)}</span>
            </div>
            <div className="drawer-section">
              <div className="section-title">
                <h3>Estado</h3>
                <select
                  aria-label="Cambiar estado del usuario"
                  value={selected.status}
                  onChange={(event) =>
                    setAction({
                      kind: "status",
                      status: event.target.value as UserStatus,
                    })
                  }
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="SUSPENDED">Suspendido</option>
                  <option value="DISABLED">Deshabilitado</option>
                </select>
              </div>
            </div>
            <div className="drawer-section">
              <div className="section-title">
                <h3>
                  <Shield size={17} /> Roles
                </h3>
                {availableRoles.length > 0 && (
                  <select
                    aria-label="Asignar rol"
                    value=""
                    onChange={(event) =>
                      event.target.value &&
                      setAction({
                        kind: "grant-role",
                        roleCode: event.target.value,
                      })
                    }
                  >
                    <option value="">Agregar rol...</option>
                    {availableRoles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {ROLE_LABELS[role.code] ?? role.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="access-list">
                {selected.roles.map((role) => (
                  <div key={role}>
                    <span title={role}>{roleLabel(role)}</span>
                    <button
                      onClick={() =>
                        setAction({ kind: "revoke-role", roleCode: role })
                      }
                    >
                      Retirar
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="drawer-section">
              <div className="section-title">
                <h3>
                  <Store size={17} /> Acceso a tiendas
                </h3>
                <button
                  onClick={() =>
                    setAction({
                      kind: "grant-store",
                      storeId: "",
                      isOwner: false,
                    })
                  }
                >
                  Agregar acceso
                </button>
              </div>
              <div className="access-list">
                {selected.storeMemberships
                  .filter((membership) => membership.active)
                  .map((membership) => (
                    <div key={membership.storeId}>
                      <span>
                        {membership.storeName}
                        {membership.isOwner ? " · Propietario" : ""}
                        {" · "}
                        {STORE_ROLE_LABELS[membership.role] ??
                          "Operador de tienda"}
                      </span>
                      <button
                        type="button"
                        title={`Editar rol en ${membership.storeName}`}
                        aria-label={`Editar rol en ${membership.storeName}`}
                        onClick={() =>
                          setAction({
                            kind: "grant-store",
                            storeId: membership.storeId,
                            storeName: membership.storeName,
                            isOwner: membership.isOwner,
                            storeRole: membership.role,
                          })
                        }
                      >
                        <UserCog size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setAction({
                            kind: "revoke-store",
                            storeId: membership.storeId,
                          })
                        }
                      >
                        Retirar
                      </button>
                    </div>
                  ))}
                {!selected.storeMemberships.some(
                  (membership) => membership.active,
                ) && <p>Sin acceso activo a tiendas.</p>}
              </div>
            </div>
            <div className="drawer-section danger-actions">
              <button onClick={() => setAction({ kind: "reset-password" })}>
                <KeyRound size={16} /> Restablecer contraseña
              </button>
              <button onClick={() => setAction({ kind: "revoke-sessions" })}>
                Cerrar todas las sesiones
              </button>
            </div>
            <div className="drawer-section">
              <h3>Historial de auditoría</h3>
              <div className="audit-list">
                {audit.map((entry) => (
                  <article key={entry.id}>
                    <strong title={entry.action}>
                      {AUDIT_LABELS[entry.action] ?? entry.action}
                    </strong>
                    <time>{formatDate(entry.occurredAt)}</time>
                    {entry.reason && <p>{entry.reason}</p>}
                  </article>
                ))}
                {!audit.length && <p>No hay registros de auditoría.</p>}
              </div>
            </div>
          </aside>
        </div>
      )}

      {createOpen && (
        <div className="modal-backdrop">
          <div className="admin-modal">
            <header>
              <div>
                <p className="eyebrow">Nueva cuenta</p>
                <h2>Crear usuario</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={pending}
                aria-label="Cerrar"
              >
                <X />
              </button>
            </header>
            <form onSubmit={handleCreate}>
              {(["username", "displayName", "email", "phone"] as const).map(
                (field) => (
                  <label className="field" key={field}>
                    <span>
                      {
                        {
                          username: "Usuario",
                          displayName: "Nombre completo",
                          email: "Correo electrónico",
                          phone: "Teléfono (opcional)",
                        }[field]
                      }
                    </span>
                    <span className="input-shell">
                      <input
                        required={field !== "phone"}
                        type={field === "email" ? "email" : "text"}
                        value={newUser[field] ?? ""}
                        onChange={(event) =>
                          setNewUser((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </span>
                  </label>
                ),
              )}
              <StorePicker
                accessToken={accessToken}
                value={newUser.storeId ?? ""}
                disabled={pending}
                onChange={(storeId) =>
                  setNewUser((current) => ({
                    ...current,
                    storeId,
                    isOwner: false,
                    storeRole: undefined,
                  }))
                }
              />
              {newUser.storeId && (
                <label className="field">
                  <span>Rol en esta tienda</span>
                  <select
                    value={
                      newUser.storeRole ??
                      (newUser.isOwner ? "STORE_ADMIN" : "STORE_OPERATOR")
                    }
                    disabled={pending}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        storeRole: event.target.value as StoreRole,
                      }))
                    }
                  >
                    {Object.entries(STORE_ROLE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {newUser.storeId && (
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={newUser.isOwner ?? false}
                    disabled={pending}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        isOwner: event.target.checked,
                      }))
                    }
                  />
                  <span>Propietario de tienda</span>
                </label>
              )}
              {error && <p role="alert">{error}</p>}
              <button
                className="primary-button"
                type="submit"
                disabled={pending}
              >
                <CirclePlus size={18} />{" "}
                {pending ? "Creando..." : "Crear usuario"}
              </button>
            </form>
          </div>
        </div>
      )}

      {action && selected && (
        <div className="modal-backdrop">
          <div className="admin-modal">
            <header>
              <div>
                <p className="eyebrow">Acción con registro de auditoría</p>
                <h2>{ACTION_LABELS[action.kind]}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setAction(null)}
                aria-label="Cerrar"
              >
                <X />
              </button>
            </header>
            <form onSubmit={handleAction}>
              {action.kind === "grant-store" && (
                <>
                  <StorePicker
                    accessToken={accessToken}
                    value={action.storeId}
                    selectedLabel={action.storeName}
                    disabled={pending}
                    required
                    onChange={(storeId) =>
                      setAction({
                        ...action,
                        storeId,
                        isOwner: false,
                        storeRole: undefined,
                      })
                    }
                  />
                  <label className="field">
                    <span>Rol en esta tienda</span>
                    <select
                      value={
                        action.storeRole ??
                        (action.isOwner ? "STORE_ADMIN" : "STORE_OPERATOR")
                      }
                      disabled={pending}
                      onChange={(event) =>
                        setAction({
                          ...action,
                          storeRole: event.target.value as StoreRole,
                        })
                      }
                    >
                      {Object.entries(STORE_ROLE_LABELS).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={action.isOwner}
                      onChange={(event) =>
                        setAction({ ...action, isOwner: event.target.checked })
                      }
                    />{" "}
                    Propietario de tienda
                  </label>
                </>
              )}
              <label className="field">
                <span>Motivo</span>
                <textarea
                  required
                  minLength={3}
                  maxLength={255}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Indica el motivo de este cambio."
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <button
                className="primary-button"
                type="submit"
                disabled={
                  pending || (action.kind === "grant-store" && !action.storeId)
                }
              >
                {pending ? "Aplicando..." : "Confirmar acción"}
              </button>
            </form>
          </div>
        </div>
      )}

      {temporaryPassword && (
        <div className="modal-backdrop">
          <div className="admin-modal secret-modal">
            <div className="section-icon">
              <UserRound size={22} />
            </div>
            <p className="eyebrow">Se muestra una sola vez</p>
            <h2>Contraseña temporal</h2>
            <p>Entrega esta contraseña por un canal seguro autorizado.</p>
            <div className="temporary-secret">
              <code>{temporaryPassword}</code>
              <button
                className="icon-button"
                title="Copiar contraseña temporal"
                aria-label="Copiar contraseña temporal"
                onClick={() =>
                  void navigator.clipboard.writeText(temporaryPassword)
                }
              >
                <Copy size={18} />
              </button>
            </div>
            <button
              className="primary-button"
              onClick={() => setTemporaryPassword("")}
            >
              Ya la guardé de forma segura
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
