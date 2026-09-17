"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import {
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  getStore,
  getStoreAudit,
  grantStore,
  listUsers,
  revokeStore,
  saveStore,
  type AdminUser,
  type StoreAudit,
  type StoreDetail,
  type StoreInput,
} from "@/lib/admin-api";
import { InformationTable } from "./admin-information";
import "./store-management.css";

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const STATUS: Record<string, string> = {
  APPLIED: "Solicitud recibida",
  UNDER_REVIEW: "En evaluación",
  PENDING_DOCUMENTS: "Documentos pendientes",
  ACTIVE: "Activa",
  SUSPENDED: "Suspendida",
  REJECTED: "Rechazada",
  CLOSED: "Cerrada",
};
const EMPTY: StoreInput = {
  displayName: "",
  legalName: "",
  gallery: "",
  standNumber: "",
  whatsappNumber: "+51",
  hours: [],
  reason: "",
};
const failure = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operación.";

function StoreForm({
  accessToken,
  store,
  onSaved,
  onDirty,
  onPending,
}: Readonly<{
  accessToken: string;
  store: StoreDetail | null;
  onSaved: (store: StoreDetail) => void;
  onDirty: (dirty: boolean) => void;
  onPending: (pending: boolean) => void;
}>) {
  const [input, setInput] = useState<StoreInput>(
    store
      ? {
          displayName: store.displayName,
          legalName: store.legalName ?? "",
          gallery: store.gallery ?? "",
          standNumber: store.standNumber ?? "",
          whatsappNumber: store.whatsappNumber,
          hours: store.hours,
          reason: "",
        }
      : EMPTY,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [hourKeys, setHourKeys] = useState(() =>
    (store?.hours ?? []).map(() => crypto.randomUUID()),
  );
  const locked = store?.status === "CLOSED" || store?.status === "REJECTED";
  const saveLabel = store ? "Guardar cambios" : "Registrar tienda";
  function change(patch: Partial<StoreInput>) {
    setInput((previous) => ({ ...previous, ...patch }));
    onDirty(true);
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    onPending(true);
    setError("");
    try {
      const saved = await saveStore(accessToken, input, store ?? undefined);
      onDirty(false);
      onSaved(saved);
    } catch (error_: unknown) {
      setError(failure(error_));
    } finally {
      setPending(false);
      onPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="store-form">
      <fieldset disabled={pending || locked}>
        <legend>Datos de la tienda</legend>
        <div className="store-fields">
          <label>
            Nombre comercial
            <input
              required
              minLength={2}
              maxLength={120}
              value={input.displayName}
              onChange={(event) => change({ displayName: event.target.value })}
            />
          </label>
          <label>
            Razón social
            <input
              maxLength={180}
              value={input.legalName}
              onChange={(event) => change({ legalName: event.target.value })}
            />
          </label>
          <label>
            Galería
            <input
              required
              maxLength={120}
              value={input.gallery}
              onChange={(event) => change({ gallery: event.target.value })}
            />
          </label>
          <label>
            Stand
            <input
              required
              maxLength={30}
              value={input.standNumber}
              onChange={(event) => change({ standNumber: event.target.value })}
            />
          </label>
          <label>
            WhatsApp
            <input
              type="tel"
              required
              pattern="\+[1-9][0-9]{7,14}"
              maxLength={16}
              placeholder="+51987654321"
              title="Número internacional, por ejemplo +51987654321"
              value={input.whatsappNumber}
              onChange={(event) =>
                change({ whatsappNumber: event.target.value })
              }
            />
          </label>
          <div className="store-verification">
            <span>Verificación de WhatsApp</span>
            <strong>
              {store?.whatsappVerifiedAt &&
              input.whatsappNumber === store.whatsappNumber
                ? "Verificado"
                : "Pendiente"}
            </strong>
          </div>
        </div>
        <div className="store-subheading">
          <h3>
            Horario de atención <small>(Lima)</small>
          </h3>
          <button
            type="button"
            className="icon-button bordered"
            title="Añadir turno"
            aria-label="Añadir turno"
            disabled={input.hours.length >= 28}
            onClick={() => {
              setHourKeys((previous) => [...previous, crypto.randomUUID()]);
              change({
                hours: [
                  ...input.hours,
                  { dayOfWeek: 1, opensAt: "09:00", closesAt: "18:00" },
                ],
              });
            }}
          >
            <Plus size={18} />
          </button>
        </div>
        {!input.hours.length && (
          <p className="store-muted">Sin horarios registrados</p>
        )}
        <div className="store-hours">
          {input.hours.map((hour, index) => (
            <div className="store-hour" key={hourKeys[index]}>
              <label>
                Día
                <select
                  value={hour.dayOfWeek}
                  onChange={(event) =>
                    change({
                      hours: input.hours.map((item, position) =>
                        position === index
                          ? { ...item, dayOfWeek: Number(event.target.value) }
                          : item,
                      ),
                    })
                  }
                >
                  {DAYS.map((day, dayOfWeek) => (
                    <option key={day} value={dayOfWeek}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Apertura
                <input
                  type="time"
                  required
                  value={hour.opensAt}
                  onChange={(event) =>
                    change({
                      hours: input.hours.map((item, position) =>
                        position === index
                          ? { ...item, opensAt: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Cierre
                <input
                  type="time"
                  required
                  value={hour.closesAt}
                  onChange={(event) =>
                    change({
                      hours: input.hours.map((item, position) =>
                        position === index
                          ? { ...item, closesAt: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="icon-button bordered"
                title="Eliminar turno"
                aria-label={`Eliminar turno ${index + 1}`}
                onClick={() => {
                  setHourKeys((previous) =>
                    previous.filter((_, position) => position !== index),
                  );
                  change({
                    hours: input.hours.filter(
                      (_, position) => position !== index,
                    ),
                  });
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <label>
          Motivo del registro o cambio
          <textarea
            required
            minLength={3}
            maxLength={255}
            rows={2}
            value={input.reason}
            onChange={(event) => change({ reason: event.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="information-error">
            {error}
          </p>
        )}
        {!locked && (
          <button className="primary-button" disabled={pending} type="submit">
            <Save size={17} /> {pending ? "Guardando..." : saveLabel}
          </button>
        )}
      </fieldset>
    </form>
  );
}

function StoreMembers({
  accessToken,
  store,
  onChanged,
}: Readonly<{
  accessToken: string;
  store: StoreDetail;
  onChanged: () => Promise<void>;
}>) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userId, setUserId] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function findUsers(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    setUserId("");
    try {
      const result = await listUsers(accessToken, {
        page: 1,
        limit: 20,
        search: search.trim(),
        status: "ACTIVE",
      });
      setUsers(result.data);
      setMessage(
        result.total
          ? `${result.total} coincidencias. Se muestran hasta 20.`
          : "Sin usuarios activos coincidentes.",
      );
    } catch (error_: unknown) {
      setError(failure(error_));
      setUsers([]);
    } finally {
      setPending(false);
    }
  }
  async function mutate(target: string, remove: boolean) {
    if (reason.trim().length < 3) {
      setError("Escribe un motivo de al menos 3 caracteres.");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      if (remove)
        await revokeStore(accessToken, target, store.id, reason.trim());
      else
        await grantStore(accessToken, target, store.id, isOwner, reason.trim());
      setMessage(remove ? "Acceso retirado." : "Acceso guardado.");
      setReason("");
      await onChanged();
    } catch (error_: unknown) {
      setError(failure(error_));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="store-members" aria-label="Usuarios asignados">
      <h3>Usuarios asignados</h3>
      <ul>
        {store.members.map((member) => (
          <li key={member.userId}>
            <span>
              <strong>{member.user.displayName}</strong>
              <small>
                {member.user.username} ·{" "}
                {member.isOwner ? "Propietario" : "Colaborador"}
              </small>
            </span>
            <button
              type="button"
              className="icon-button bordered"
              title={`Retirar acceso de ${member.user.displayName}`}
              aria-label={`Retirar acceso de ${member.user.displayName}`}
              disabled={pending}
              onClick={() => void mutate(member.userId, true)}
            >
              <Trash2 size={17} />
            </button>
          </li>
        ))}
      </ul>
      {!store.members.length && (
        <p className="store-muted">Sin usuarios asignados</p>
      )}
      <form onSubmit={findUsers} className="store-user-search">
        <label>
          Buscar usuario
          <input
            value={search}
            maxLength={120}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="icon-button bordered"
          title="Buscar usuarios"
          aria-label="Buscar usuarios"
          disabled={pending}
        >
          <Search size={18} />
        </button>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (userId) void mutate(userId, false);
        }}
      >
        <fieldset disabled={pending}>
          <label>
            Usuario
            <select
              required
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setIsOwner(
                  store.members.find(
                    (member) => member.userId === event.target.value,
                  )?.isOwner ?? false,
                );
              }}
            >
              <option value="">Seleccionar usuario</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.username})
                </option>
              ))}
            </select>
          </label>
          <label className="store-check">
            <input
              type="checkbox"
              checked={isOwner}
              onChange={(event) => setIsOwner(event.target.checked)}
            />
            Propietario de la tienda
          </label>
          <label>
            Motivo del cambio de acceso
            <textarea
              required
              minLength={3}
              maxLength={255}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="secondary-button"
            disabled={!userId || pending}
          >
            <UserPlus size={17} />
            Guardar acceso
          </button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="information-error">
          {error}
        </p>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}

function StoreEditor({
  accessToken,
  id,
  onClose,
  onChanged,
}: Readonly<{
  accessToken: string;
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);
  const pending = useRef(false);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [audit, setAudit] = useState<StoreAudit[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function close() {
    if (pending.current) return;
    if (
      !dirty.current ||
      window.confirm("Hay cambios sin guardar. ¿Cerrar el expediente?")
    )
      onClose();
  }
  async function reload() {
    if (pending.current) return;
    if (
      dirty.current &&
      !window.confirm("¿Descartar los cambios sin guardar y recargar?")
    )
      return;
    const target = store?.id ?? id;
    if (!target) return;
    setLoading(true);
    setError("");
    try {
      const [updated, history] = await Promise.all([
        getStore(accessToken, target),
        getStoreAudit(accessToken, target),
      ]);
      setStore(updated);
      setAudit(history);
      dirty.current = false;
    } catch (error_: unknown) {
      setError(failure(error_));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([getStore(accessToken, id), getStoreAudit(accessToken, id)])
      .then(([data, history]) => {
        if (active) {
          setStore(data);
          setAudit(history);
        }
      })
      .catch((error_: unknown) => {
        if (active) setError(failure(error_));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, id]);
  async function refreshMembers() {
    if (!store) return;
    const updated = await getStore(accessToken, store.id);
    setStore((previous) =>
      previous ? { ...previous, members: updated.members } : previous,
    );
    onChanged();
  }
  function saved(updated: StoreDetail) {
    setStore(updated);
    setMessage("Expediente guardado.");
    onChanged();
    void getStoreAudit(accessToken, updated.id)
      .then(setAudit)
      .catch(() =>
        setError(
          "El expediente se guardó, pero no se pudo actualizar el historial.",
        ),
      );
  }
  return (
    <dialog
      ref={dialog}
      className="information-dialog store-dialog"
      aria-labelledby="store-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">Expediente de tienda</p>
          <h2 id="store-editor-title">
            {store?.displayName ?? (id ? "Tienda" : "Nueva tienda")}
          </h2>
          <p className="information-status">
            {STATUS[store?.status ?? "APPLIED"]}
          </p>
        </div>
        <button
          type="button"
          className="icon-button bordered"
          title="Cerrar expediente"
          aria-label="Cerrar expediente"
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      {(id || store) && (
        <button
          className="secondary-button"
          disabled={loading}
          onClick={() => void reload()}
        >
          <RefreshCw size={16} />
          Recargar expediente
        </button>
      )}
      {loading && <output>Cargando expediente...</output>}
      {error && (
        <div role="alert" className="information-error">
          <p>{error}</p>
        </div>
      )}
      {message && <output>{message}</output>}
      {!loading && (!id || store) && (
        <>
          <StoreForm
            key={`${store?.id ?? "new"}:${store?.updatedAt ?? ""}`}
            accessToken={accessToken}
            store={store}
            onSaved={saved}
            onDirty={(value) => {
              dirty.current = value;
            }}
            onPending={(value) => {
              pending.current = value;
            }}
          />
          {store && (
            <StoreMembers
              accessToken={accessToken}
              store={store}
              onChanged={refreshMembers}
            />
          )}
          {store && (
            <section
              className="store-history"
              aria-label="Historial del expediente"
            >
              <h3>Últimos cambios del expediente</h3>
              {!audit.length && (
                <p className="store-muted">Sin cambios registrados</p>
              )}
              <ol>
                {audit.map((entry) => (
                  <li key={entry.id}>
                    <strong>
                      {entry.action === "STORE_CREATED"
                        ? "Registro de tienda"
                        : "Actualización de tienda"}
                    </strong>
                    <p>{entry.reason}</p>
                    <small>
                      {entry.actor ?? "Sistema"} ·{" "}
                      {new Date(entry.occurredAt).toLocaleString("es-PE", {
                        timeZone: "America/Lima",
                      })}
                    </small>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </dialog>
  );
}

export function StoreManagement({
  accessToken,
}: Readonly<{ accessToken: string }>) {
  const [selected, setSelected] = useState<string | null | undefined>(
    undefined,
  );
  const [revision, setRevision] = useState(0);
  return (
    <section
      className="admin-shell information-shell"
      aria-labelledby="stores-title"
    >
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1 id="stores-title">Tiendas</h1>
        </div>
        <button className="primary-button" onClick={() => setSelected(null)}>
          <Plus size={18} />
          Nueva tienda
        </button>
      </div>
      <InformationTable
        accessToken={accessToken}
        resource="stores"
        revision={revision}
        onOpen={setSelected}
      />
      {selected !== undefined && (
        <StoreEditor
          key={selected ?? "new"}
          accessToken={accessToken}
          id={selected}
          onClose={() => setSelected(undefined)}
          onChanged={() => setRevision((value) => value + 1)}
        />
      )}
    </section>
  );
}
