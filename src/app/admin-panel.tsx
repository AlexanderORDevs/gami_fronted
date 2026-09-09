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
  X,
} from "lucide-react";
import { SyntheticEvent, useEffect, useState } from "react";
import {
  AdminUser,
  AuditEntry,
  CreateUserInput,
  Role,
  UserList,
  UserStatus,
  createUser,
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

type Action =
  | { kind: "status"; status: UserStatus }
  | { kind: "grant-role"; roleCode: string }
  | { kind: "revoke-role"; roleCode: string }
  | { kind: "grant-store"; storeId: string; isOwner: boolean }
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
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function messageFrom(error_: unknown) {
  return error_ instanceof Error
    ? error_.message
    : "The operation could not be completed.";
}

function StatusBadge({ status }: Readonly<{ status: UserStatus }>) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {status.toLowerCase()}
    </span>
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
      const input = Object.fromEntries(
        Object.entries(newUser).filter(([, value]) => value?.trim()),
      ) as CreateUserInput;
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
          <p className="eyebrow">Identity & access</p>
          <h1>Users</h1>
          <p>Control platform permissions and store scope.</p>
        </div>
        <button className="primary-command" onClick={() => setCreateOpen(true)}>
          <CirclePlus size={18} /> New user
        </button>
      </div>

      <div className="admin-toolbar">
        <form className="search-form" onSubmit={handleSearch}>
          <Search size={18} />
          <input
            aria-label="Search users"
            placeholder="Search name, username, email or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            const next = event.target.value as UserStatus | "";
            setStatus(next);
            void load(1, search, next);
          }}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <button
          className="icon-button bordered"
          title="Refresh users"
          aria-label="Refresh users"
          onClick={() => void load(users.page)}
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {error && (
        <p className="admin-alert" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </p>
      )}

      <div className="user-table-wrap">
        <table className="user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Roles</th>
              <th>Store scope</th>
              <th>Last login</th>
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
                          <span key={role}>{role.replaceAll("_", " ")}</span>
                        ))
                      ) : (
                        <em>No roles</em>
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
        {loading && <div className="empty-state">Loading users...</div>}
        {!loading && !users.data.length && (
          <div className="empty-state">No users match these filters.</div>
        )}
      </div>

      <footer className="table-footer">
        <span>
          {users.total} users · Page {users.page} of {Math.max(users.pages, 1)}
        </span>
        <div>
          <button
            className="icon-button bordered"
            disabled={users.page <= 1 || loading}
            onClick={() => void load(users.page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button bordered"
            disabled={users.page >= users.pages || loading}
            onClick={() => void load(users.page + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>

      {selected && (
        <div className="drawer-backdrop">
          <aside className="user-drawer" aria-label="User details">
            <header>
              <div>
                <p className="eyebrow">User profile</p>
                <h2>{selected.displayName}</h2>
                <span>@{selected.username}</span>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelected(null)}
                aria-label="Close user details"
              >
                <X />
              </button>
            </header>
            <div className="drawer-section user-summary">
              <StatusBadge status={selected.status} />
              <span>
                {selected.mustChangePassword
                  ? "Password change required"
                  : "Password established"}
              </span>
              <span>Created {formatDate(selected.createdAt)}</span>
            </div>
            <div className="drawer-section">
              <div className="section-title">
                <h3>Status</h3>
                <select
                  aria-label="Change user status"
                  value={selected.status}
                  onChange={(event) =>
                    setAction({
                      kind: "status",
                      status: event.target.value as UserStatus,
                    })
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DISABLED">Disabled</option>
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
                    aria-label="Grant role"
                    value=""
                    onChange={(event) =>
                      event.target.value &&
                      setAction({
                        kind: "grant-role",
                        roleCode: event.target.value,
                      })
                    }
                  >
                    <option value="">Add role...</option>
                    {availableRoles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="access-list">
                {selected.roles.map((role) => (
                  <div key={role}>
                    <span>{role.replaceAll("_", " ")}</span>
                    <button
                      onClick={() =>
                        setAction({ kind: "revoke-role", roleCode: role })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="drawer-section">
              <div className="section-title">
                <h3>
                  <Store size={17} /> Store access
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
                  Add access
                </button>
              </div>
              <div className="access-list">
                {selected.storeMemberships
                  .filter((membership) => membership.active)
                  .map((membership) => (
                    <div key={membership.storeId}>
                      <span>
                        {membership.storeName}
                        {membership.isOwner ? " · Owner" : ""}
                      </span>
                      <button
                        onClick={() =>
                          setAction({
                            kind: "revoke-store",
                            storeId: membership.storeId,
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                {!selected.storeMemberships.some(
                  (membership) => membership.active,
                ) && <p>No active store access.</p>}
              </div>
            </div>
            <div className="drawer-section danger-actions">
              <button onClick={() => setAction({ kind: "reset-password" })}>
                <KeyRound size={16} /> Reset password
              </button>
              <button onClick={() => setAction({ kind: "revoke-sessions" })}>
                Revoke all sessions
              </button>
            </div>
            <div className="drawer-section">
              <h3>Audit history</h3>
              <div className="audit-list">
                {audit.map((entry) => (
                  <article key={entry.id}>
                    <strong>{entry.action.replaceAll("_", " ")}</strong>
                    <time>{formatDate(entry.occurredAt)}</time>
                    {entry.reason && <p>{entry.reason}</p>}
                  </article>
                ))}
                {!audit.length && <p>No audit entries found.</p>}
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
                <p className="eyebrow">New identity</p>
                <h2>Create user</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
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
                          username: "Username",
                          displayName: "Display name",
                          email: "Email (optional)",
                          phone: "Phone (optional)",
                        }[field]
                      }
                    </span>
                    <span className="input-shell">
                      <input
                        required={
                          field === "username" || field === "displayName"
                        }
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
              <button
                className="primary-button"
                type="submit"
                disabled={pending}
              >
                Create user
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
                <p className="eyebrow">Audited action</p>
                <h2>{action.kind.replaceAll("-", " ")}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setAction(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </header>
            <form onSubmit={handleAction}>
              {action.kind === "grant-store" && (
                <>
                  <label className="field">
                    <span>Store UUID</span>
                    <span className="input-shell">
                      <input
                        required
                        value={action.storeId}
                        onChange={(event) =>
                          setAction({ ...action, storeId: event.target.value })
                        }
                      />
                    </span>
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={action.isOwner}
                      onChange={(event) =>
                        setAction({ ...action, isOwner: event.target.checked })
                      }
                    />{" "}
                    Store owner
                  </label>
                  <p className="dependency-note">
                    Store discovery depends on the upcoming Stores module. Enter
                    a known store UUID for now.
                  </p>
                </>
              )}
              <label className="field">
                <span>Reason</span>
                <textarea
                  required
                  minLength={3}
                  maxLength={255}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain the business reason for this change."
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={pending}
              >
                {pending ? "Applying..." : "Confirm action"}
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
            <p className="eyebrow">Shown once</p>
            <h2>Temporary password</h2>
            <p>Deliver this credential through an approved secure channel.</p>
            <div className="temporary-secret">
              <code>{temporaryPassword}</code>
              <button
                className="icon-button"
                title="Copy temporary password"
                aria-label="Copy temporary password"
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
              I have stored it securely
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
