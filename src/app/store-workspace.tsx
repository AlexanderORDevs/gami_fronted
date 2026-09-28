"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Save,
  Search,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import {
  ADMIN_SECTIONS,
  InformationTable,
  type AdminSection,
} from "./admin-information";
import {
  createStoreMember,
  getStoreProfile,
  listStoreTeam,
  listWorkspaceStores,
  STORE_ROLE_LABELS,
  updateStoreMember,
  type StoreMember,
  type StoreProfile,
  type StoreResource,
  type StoreRole,
  type StoreTeamPage,
  type WorkspaceStore,
} from "@/lib/store-api";
import "./store-workspace.css";
import { OperationToolbar } from "./store-operations";

const MODULES: Partial<
  Record<AdminSection, { label: string; resources: StoreResource[] }>
> = {
  users: { label: "Equipo y accesos", resources: ["members"] },
  stores: { label: "Datos de tienda", resources: ["profile"] },
  products: { label: "Catálogo", resources: ["products"] },
  orders: { label: "Atención y órdenes", resources: ["orders"] },
  warehouse: {
    label: "Inventario y envíos",
    resources: ["inventory", "shipments"],
  },
  finance: { label: "Finanzas", resources: ["payouts", "ledger"] },
};
export function storeSections(permissions: readonly StoreResource[]) {
  const order: AdminSection[] = [
    "products",
    "orders",
    "warehouse",
    "finance",
    "users",
    "stores",
  ];
  return order.flatMap((id) => {
    const definition = MODULES[id]!;
    const section = ADMIN_SECTIONS.find((item) => item.id === id)!;
    return definition.resources.some((resource) =>
      permissions.includes(resource),
    )
      ? [{ ...section, label: definition.label }]
      : [];
  });
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operación.";

export function StoreWorkspace({
  accessToken,
  section,
  onStoreChange,
}: Readonly<{
  accessToken: string;
  section: AdminSection;
  onStoreChange: (store: WorkspaceStore | null) => void;
}>) {
  const [stores, setStores] = useState<WorkspaceStore[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const selection = useRef("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    listWorkspaceStores(accessToken, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const current =
          result.find((store) => store.id === selection.current) ??
          result[0] ??
          null;
        setStores(result);
        setSelectedId(current?.id ?? "");
        selection.current = current?.id ?? "";
        onStoreChange(current);
        setError("");
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) {
          setError(message(error_));
          setStores([]);
          onStoreChange(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, onStoreChange, revision]);
  const store = stores.find((item) => item.id === selectedId);
  const sections = storeSections(store?.permissions ?? []);
  const activeSection =
    sections.find((item) => item.id === section)?.id ?? sections[0]?.id;
  return (
    <section className="admin-shell store-workspace">
      <header className="store-workspace-heading">
        <div>
          <p className="eyebrow">Portal de tienda</p>
          <h1>{store?.displayName ?? "Mi tienda"}</h1>
          {store && <p>{STORE_ROLE_LABELS[store.role]}</p>}
        </div>
        <div className="store-workspace-picker">
          {stores.length > 1 && (
            <label>
              <span>Tienda</span>
              <select
                value={selectedId}
                disabled={loading || !stores.length}
                onChange={(event) => {
                  const current = stores.find(
                    (item) => item.id === event.target.value,
                  )!;
                  setSelectedId(current.id);
                  selection.current = current.id;
                  onStoreChange(current);
                }}
              >
                {stores.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="icon-button bordered"
            title="Actualizar accesos"
            aria-label="Actualizar accesos"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRevision((value) => value + 1);
            }}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>
      {loading && <output>Cargando tienda...</output>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !store && (
        <p>No tienes una tienda activa asignada.</p>
      )}
      {!loading && store && activeSection && (
        <StoreContent
          key={`${store.id}:${activeSection}`}
          accessToken={accessToken}
          store={store}
          section={activeSection}
          onAccessChanged={() => setRevision((value) => value + 1)}
        />
      )}
    </section>
  );
}

function StoreContent({
  accessToken,
  store,
  section,
  onAccessChanged,
}: Readonly<{
  accessToken: string;
  store: WorkspaceStore;
  section: AdminSection;
  onAccessChanged: () => void;
}>) {
  const [revision, setRevision] = useState(0);
  if (section === "users")
    return (
      <StoreTeam
        accessToken={accessToken}
        storeId={store.id}
        onAccessChanged={onAccessChanged}
      />
    );
  if (section === "stores")
    return <Profile accessToken={accessToken} storeId={store.id} />;
  const resources = MODULES[section]!.resources.filter((resource) =>
    store.permissions.includes(resource),
  );
  return (
    <>
      {resources.map((resource) => (
        <section key={resource} className="store-workspace-resource">
          <h2>
            {
              (
                {
                  products: "Catálogo",
                  orders: "Atención y órdenes",
                  inventory: "Inventario",
                  shipments: "Envíos",
                  payouts: "Liquidaciones",
                  ledger: "Movimientos",
                } as Record<string, string>
              )[resource]
            }
          </h2>
          <OperationToolbar
            token={accessToken}
            store={store}
            resource={resource}
            onSaved={() => setRevision((current) => current + 1)}
          />
          <InformationTable
            accessToken={accessToken}
            resource={
              resource as
                | "products"
                | "orders"
                | "inventory"
                | "shipments"
                | "payouts"
                | "ledger"
            }
            storeId={store.id}
            revision={revision}
          />
        </section>
      ))}
    </>
  );
}

function Profile({
  accessToken,
  storeId,
}: Readonly<{ accessToken: string; storeId: string }>) {
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getStoreProfile(accessToken, storeId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setProfile(result);
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(message(error_));
      });
    return () => controller.abort();
  }, [accessToken, storeId]);
  if (error) return <p role="alert">{error}</p>;
  if (!profile) return <output>Cargando datos...</output>;
  return (
    <dl className="store-workspace-profile">
      {[
        ["Nombre comercial", profile.displayName],
        ["Razón social", profile.legalName],
        ["Galería", profile.gallery],
        ["Puesto", profile.standNumber],
        ["WhatsApp", profile.whatsappNumber],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "Sin registrar"}</dd>
        </div>
      ))}
    </dl>
  );
}

function StoreTeam({
  accessToken,
  storeId,
  onAccessChanged,
}: Readonly<{
  accessToken: string;
  storeId: string;
  onAccessChanged: () => void;
}>) {
  const [result, setResult] = useState<StoreTeamPage>({
    data: [],
    total: 0,
    page: 1,
    pages: 0,
  });
  const [query, setQuery] = useState({ page: 1, search: "" });
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StoreMember | null | undefined>(
    undefined,
  );
  const [secret, setSecret] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    listStoreTeam(
      accessToken,
      storeId,
      query.page,
      query.search,
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
          setError(message(error_));
          setResult({ data: [], total: 0, page: 1, pages: 0 });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, storeId, query, revision]);
  function reload() {
    setLoading(true);
    setRevision((value) => value + 1);
  }
  return (
    <section>
      <div className="store-team-heading">
        <h2>Equipo y accesos</h2>
        <button
          type="button"
          className="primary-button"
          onClick={() => setEditing(null)}
        >
          <UserPlus size={18} /> Nuevo usuario
        </button>
      </div>
      <div className="admin-toolbar">
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            setLoading(true);
            setQuery({ page: 1, search });
          }}
        >
          <Search size={18} />
          <input
            aria-label="Buscar integrantes"
            placeholder="Buscar usuario o nombre"
            value={search}
            maxLength={120}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="submit"
            title="Buscar integrantes"
            aria-label="Buscar integrantes"
          >
            <Search size={18} />
          </button>
        </form>
        <button
          className="icon-button bordered"
          title="Actualizar equipo"
          aria-label="Actualizar equipo"
          disabled={loading}
          onClick={reload}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="information-table-wrap">
        <table className="information-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol en esta tienda</th>
              <th>Acceso</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              result.data.map((member) => (
                <tr key={member.userId}>
                  <td>
                    {member.displayName}
                    <br />
                    <small>@{member.username}</small>
                  </td>
                  <td>{STORE_ROLE_LABELS[member.role]}</td>
                  <td>{member.active ? "Activo" : "Retirado"}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-button bordered"
                      title={`Editar acceso de ${member.displayName}`}
                      aria-label={`Editar acceso de ${member.displayName}`}
                      onClick={() => setEditing(member)}
                    >
                      <UserCog size={18} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading && <output>Cargando equipo...</output>}
        {!loading && !error && !result.data.length && (
          <p>Sin integrantes coincidentes.</p>
        )}
      </div>
      <footer className="table-footer">
        <output>
          {result.total} integrantes · Página {query.page} de{" "}
          {Math.max(1, result.pages)}
        </output>
        <div>
          <button
            type="button"
            className="icon-button bordered"
            title="Página anterior"
            aria-label="Página anterior"
            disabled={loading || query.page <= 1}
            onClick={() => {
              setLoading(true);
              setQuery((previous) => ({
                ...previous,
                page: previous.page - 1,
              }));
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="icon-button bordered"
            title="Página siguiente"
            aria-label="Página siguiente"
            disabled={loading || query.page >= result.pages}
            onClick={() => {
              setLoading(true);
              setQuery((previous) => ({
                ...previous,
                page: previous.page + 1,
              }));
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
      {editing !== undefined && (
        <MemberForm
          key={editing?.userId ?? "new"}
          accessToken={accessToken}
          storeId={storeId}
          member={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(password) => {
            setEditing(undefined);
            setSecret(password ?? "");
            reload();
            onAccessChanged();
          }}
        />
      )}
      {secret && <SecretDialog secret={secret} onClose={() => setSecret("")} />}
    </section>
  );
}

function useDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return ref;
}

function SecretDialog({
  secret,
  onClose,
}: Readonly<{ secret: string; onClose: () => void }>) {
  const dialog = useDialog();
  const [error, setError] = useState("");
  return (
    <dialog
      ref={dialog}
      className="admin-modal store-team-dialog"
      aria-labelledby="store-secret-title"
      onCancel={onClose}
    >
      <header>
        <h2 id="store-secret-title">Contraseña temporal</h2>
      </header>
      <div className="store-dialog-content">
        <code className="store-temporary-password">{secret}</code>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void navigator.clipboard
              .writeText(secret)
              .catch(() => setError("No se pudo copiar la contraseña."))
          }
        >
          <Copy size={18} /> Copiar
        </button>
        {error && <p role="alert">{error}</p>}
        <button type="button" className="primary-button" onClick={onClose}>
          Ya la guardé de forma segura
        </button>
      </div>
    </dialog>
  );
}

function MemberForm({
  accessToken,
  storeId,
  member,
  onClose,
  onSaved,
}: Readonly<{
  accessToken: string;
  storeId: string;
  member: StoreMember | null;
  onClose: () => void;
  onSaved: (password?: string) => void;
}>) {
  const dialog = useDialog();
  const [input, setInput] = useState({
    username: "",
    displayName: "",
    email: "",
    phone: "",
  });
  const [role, setRole] = useState<StoreRole>(member?.role ?? "STORE_OPERATOR");
  const [active, setActive] = useState(member?.active ?? true);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (member) {
        await updateStoreMember(accessToken, storeId, member.userId, {
          role,
          active,
          reason: reason.trim(),
        });
        onSaved();
      } else {
        const result = await createStoreMember(accessToken, storeId, {
          ...input,
          phone: input.phone.trim() || undefined,
          storeRole: role,
        });
        onSaved(result.temporaryPassword);
      }
    } catch (error_: unknown) {
      setError(message(error_));
    } finally {
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="admin-modal store-team-dialog"
      aria-labelledby="store-member-title"
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">Equipo de tienda</p>
          <h2 id="store-member-title">
            {member ? member.displayName : "Crear usuario"}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Cerrar"
          aria-label="Cerrar"
          disabled={pending}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <form onSubmit={submit}>
        {!member &&
          (["username", "displayName", "email", "phone"] as const).map(
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
                    disabled={pending}
                    minLength={field === "username" ? 3 : undefined}
                    maxLength={
                      { username: 60, displayName: 120, email: 180, phone: 30 }[
                        field
                      ]
                    }
                    type={field === "email" ? "email" : "text"}
                    value={input[field]}
                    onChange={(event) =>
                      setInput((previous) => ({
                        ...previous,
                        [field]: event.target.value,
                      }))
                    }
                  />
                </span>
              </label>
            ),
          )}
        <label className="field">
          <span>Rol en esta tienda</span>
          <select
            value={role}
            disabled={pending}
            onChange={(event) => setRole(event.target.value as StoreRole)}
          >
            {Object.entries(STORE_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {member && (
          <>
            <label className="check-field">
              <input
                type="checkbox"
                disabled={pending}
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              <span>Acceso activo a esta tienda</span>
            </label>
            <label className="field">
              <span>Motivo del cambio</span>
              <textarea
                required
                minLength={3}
                maxLength={255}
                disabled={pending}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="primary-button" disabled={pending}>
          <Save size={18} /> {pending ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </dialog>
  );
}
