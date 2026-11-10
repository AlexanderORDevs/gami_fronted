"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  LogOut,
  Save,
  ShoppingBag,
  UserPlus,
  X,
} from "lucide-react";
import {
  changePassword,
  recoverPassword,
  requestPasswordReset,
} from "@/lib/auth-api";
import { useCustomer, type AccountView } from "@/lib/customer-session";
import { formatPrice } from "@/lib/catalog-api";
import { OrderDetailPanel } from "./order-detail";
import { generateSuggestedPassword } from "@/lib/password";
import "./customer-account.css";

const titles: Record<AccountView, string> = {
  login: "Accede a Gami",
  register: "Crea tu cuenta en Gami",
  profile: "Mi perfil",
  orders: "Mis órdenes",
  password: "Cambiar contraseña",
  forgot: "Recuperar acceso",
  recover: "Restablecer contraseña",
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : "No pudimos completar la operación.";
function Field({
  label,
  prefix,
  action,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  prefix?: string;
  action?: ReactNode;
}) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      <span className="input-shell">
        {prefix && (
          <span className="customer-phone-prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input aria-labelledby={labelId} {...props} />
        {action}
      </span>
    </label>
  );
}
const value = (data: FormData, name: string) => {
  const result = data.get(name);
  return typeof result === "string" ? result : "";
};

export function CustomerAccountDialog() {
  const account = useCustomer();
  if (!account.view) return null;
  return <AccountWindow key={account.view} view={account.view} />;
}
function AccountWindow({ view }: Readonly<{ view: AccountView }>) {
  const account = useCustomer();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const element = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="customer-dialog"
      data-view={view}
      aria-labelledby="customer-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) account.close();
      }}
    >
      <header>
        <div>
          <p className="customer-wordmark">
            gami<span>.</span>
          </p>
          <h2 id="customer-title">{titles[view]}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar cuenta"
          title="Cerrar cuenta"
          onClick={account.close}
          disabled={pending}
        >
          <X size={20} />
        </button>
      </header>
      <div className="customer-body">
        {account.session && !account.session.user.mustChangePassword && (
          <nav aria-label="Mi cuenta">
            <button
              type="button"
              className="text-button"
              aria-current={view === "profile" ? "page" : undefined}
              onClick={() => account.open("profile")}
              disabled={pending}
            >
              Perfil
            </button>
            <button
              type="button"
              className="text-button"
              aria-current={view === "orders" ? "page" : undefined}
              onClick={() => account.open("orders")}
              disabled={pending}
            >
              <ShoppingBag size={16} />
              Órdenes
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => account.open("password")}
              disabled={pending}
            >
              <KeyRound size={16} />
              Contraseña
            </button>
          </nav>
        )}
        {view === "profile" ? (
          <Profile onPending={setPending} />
        ) : view === "orders" ? (
          <Orders />
        ) : (
          <AccountForm view={view} onPending={setPending} />
        )}
      </div>
    </dialog>
  );
}

function AccountForm({
  view,
  onPending,
}: Readonly<{ view: AccountView; onPending: (pending: boolean) => void }>) {
  const account = useCustomer();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [registrationPhone, setRegistrationPhone] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    onPending(true);
    try {
      const password = value(data, "password");
      if (
        ["recover", "password"].includes(view) &&
        password !== value(data, "confirmation")
      )
        throw new Error("Las contraseñas no coinciden.");
      if (view === "login")
        await account.login(value(data, "username").trim(), password);
      if (view === "register")
        await account.register({
          username: value(data, "username").trim(),
          displayName: value(data, "displayName").trim(),
          email: value(data, "email").trim(),
          phone: value(data, "phone").trim(),
          password,
        });
      if (view === "forgot") {
        await requestPasswordReset(value(data, "email"));
        setSuccess(
          "Si el correo está registrado, recibirás un código de recuperación.",
        );
      }
      if (view === "recover") {
        const result = await recoverPassword(
          value(data, "email"),
          value(data, "code"),
          password,
        );
        account.acceptSession(result);
        setCodes(result.recoveryCodes);
        setSuccess("Contraseña actualizada.");
      }
      if (view === "password" && account.session) {
        const result = await changePassword(
          account.session.tokens.accessToken,
          account.session.user.mustChangePassword
            ? undefined
            : value(data, "currentPassword"),
          password,
        );
        account.acceptSession(result);
        setCodes(result.recoveryCodes);
        setSuccess("Contraseña actualizada.");
      }
    } catch (error_) {
      setError(message(error_));
    } finally {
      setPending(false);
      onPending(false);
    }
  }
  if (codes.length)
    return (
      <section className="customer-recovery">
        <h3>Códigos de recuperación</h3>
        <p>
          Guárdalos en un lugar privado. Cada código se puede utilizar una sola
          vez.
        </p>
        {codes.map((code) => (
          <code key={code}>{code}</code>
        ))}
        <button
          type="button"
          className="primary-button"
          onClick={account.close}
        >
          Continuar al catálogo
        </button>
      </section>
    );
  const registering = view === "register";
  const entering = view === "login";
  const forgot = view === "forgot";
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="customer-fields">
        {(entering || registering) && (
          <Field
            label="Usuario"
            name="username"
            required
            minLength={3}
            maxLength={60}
            autoComplete="username"
            pattern={registering ? "[a-zA-Z0-9._\\-]+" : undefined}
          />
        )}
        {registering && (
          <Field
            label="Nombre completo"
            name="displayName"
            required
            minLength={3}
            maxLength={120}
            autoComplete="name"
          />
        )}
        {(registering || forgot || view === "recover") && (
          <Field
            label="Correo electrónico"
            name="email"
            required
            type="email"
            maxLength={180}
            autoComplete="email"
          />
        )}
        {registering && (
          <Field
            label="Número de celular"
            name="phone"
            required
            type="tel"
            inputMode="numeric"
            pattern="9[0-9]{8}"
            minLength={9}
            maxLength={9}
            autoComplete="tel-national"
            prefix="+51"
            value={registrationPhone}
            onChange={(event) =>
              setRegistrationPhone(
                event.target.value.replace(/\D/g, "").slice(0, 9),
              )
            }
            title="Ingresa nueve dígitos, comenzando en 9"
          />
        )}
        {view === "recover" && (
          <Field
            label="Código de recuperación"
            name="code"
            required
            minLength={12}
            autoComplete="one-time-code"
          />
        )}
        {view === "password" && !account.session?.user.mustChangePassword && (
          <Field
            label="Contraseña actual"
            name="currentPassword"
            required
            type="password"
            autoComplete="current-password"
          />
        )}
        {!forgot && (
          <Field
            label={entering ? "Contraseña" : "Nueva contraseña"}
            name="password"
            required
            type={registering && passwordVisible ? "text" : "password"}
            minLength={entering ? 1 : 12}
            maxLength={72}
            autoComplete={entering ? "current-password" : "new-password"}
            value={registering ? registrationPassword : undefined}
            onChange={
              registering
                ? (event) => setRegistrationPassword(event.target.value)
                : undefined
            }
            action={
              registering ? (
                <span className="customer-password-actions">
                  <button
                    type="button"
                    className="icon-button"
                    title="Sugerir contraseña"
                    aria-label="Sugerir contraseña"
                    onClick={() => {
                      setRegistrationPassword(generateSuggestedPassword());
                      setPasswordVisible(true);
                    }}
                  >
                    <Dices size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title={
                      passwordVisible
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    aria-label={
                      passwordVisible
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    onClick={() => setPasswordVisible((current) => !current)}
                  >
                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              ) : undefined
            }
          />
        )}
        {registering && (
          <p className="customer-password-guidance">Mínimo 12 caracteres.</p>
        )}
        {!entering && !forgot && !registering && (
          <Field
            label="Confirmar contraseña"
            name="confirmation"
            required
            type="password"
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
          />
        )}
        {error && <p role="alert">{error}</p>}
        {success && <output>{success}</output>}
        <button type="submit" className="primary-button" disabled={pending}>
          {entering ? (
            <LogIn size={18} />
          ) : registering ? (
            <UserPlus size={18} />
          ) : (
            <Save size={18} />
          )}
          {pending
            ? "Procesando..."
            : entering
              ? "Ingresar"
              : registering
                ? "Crear cuenta"
                : forgot
                  ? "Enviar código"
                  : "Guardar contraseña"}
        </button>
        {entering && (
          <>
            <button
              type="button"
              className="secondary-button"
              onClick={() => account.open("register")}
            >
              Crear cuenta de cliente
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => account.open("forgot")}
            >
              Olvidé mi contraseña
            </button>
          </>
        )}
        {registering && (
          <button
            type="button"
            className="text-button"
            onClick={() => account.open("login")}
          >
            Ya tengo una cuenta
          </button>
        )}
        {forgot && (
          <button
            type="button"
            className="text-button"
            onClick={() => account.open("recover")}
          >
            Ya tengo el código
          </button>
        )}
        {view === "recover" && (
          <button
            type="button"
            className="text-button"
            onClick={() => account.open("login")}
          >
            Volver a ingresar
          </button>
        )}
      </fieldset>
    </form>
  );
}

function Profile({
  onPending,
}: Readonly<{ onPending: (pending: boolean) => void }>) {
  const account = useCustomer();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    onPending(true);
    setError("");
    try {
      await account.api("/customers/me", "PATCH", {
        displayName: value(data, "displayName").trim(),
        phone: value(data, "phone").trim(),
      });
      await account.reload();
      setSuccess("Perfil actualizado.");
    } catch (error_) {
      setError(message(error_));
    } finally {
      setPending(false);
      onPending(false);
    }
  }
  if (!account.profile)
    return (
      <>
        <output>
          {account.loading
            ? "Cargando perfil..."
            : "No se pudo cargar el perfil."}
        </output>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void account.reload().catch((error_) => setError(message(error_)))
          }
        >
          Actualizar perfil
        </button>
        {error && <p role="alert">{error}</p>}
      </>
    );
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="customer-fields">
        <p>
          <strong>{account.profile.user.username}</strong>
          <br />
          {account.profile.email}
        </p>
        <Field
          label="Nombre completo"
          name="displayName"
          defaultValue={account.profile.fullName}
          minLength={3}
          maxLength={120}
          required
          autoComplete="name"
        />
        <Field
          label="Teléfono"
          name="phone"
          defaultValue={account.profile.phone}
          required
          type="tel"
          pattern="\+?[0-9]{7,15}"
          maxLength={16}
          autoComplete="tel"
        />
        {error && <p role="alert">{error}</p>}
        {success && <output>{success}</output>}
        <button type="submit" className="primary-button">
          <Save size={18} />
          {pending ? "Guardando..." : "Guardar perfil"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void account.signOut().catch((error_) => setError(message(error_)))
          }
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </fieldset>
    </form>
  );
}

type CustomerOrderPage = {
  data: {
    orderNumber: string;
    status: string;
    totalInCents: number;
    createdAt: string;
    storeOrders: {
      store: { displayName: string };
      items: {
        productName: string;
        sizeLabel: string;
        color: string;
        quantity: number;
        unitPriceInCents: number;
      }[];
    }[];
  }[];
  page: number;
  pages: number;
  total: number;
};
const orderStatuses: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PENDING_CONFIRMATION: "Pendiente de confirmación",
  PRE_CONFIRMED: "Preconfirmada",
  PAID: "Pagada",
  PARTIALLY_CONFIRMED: "Confirmada parcialmente",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada por la tienda",
  CANCELLED: "Cancelada",
  FULFILLING: "En preparación",
  DELIVERED: "Entregada",
  CLOSED: "Cerrada",
};
function Orders() {
  const account = useCustomer();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CustomerOrderPage | null>(null);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const loadOrders = useEffectEvent((signal: AbortSignal) =>
    account.api<CustomerOrderPage>(
      `/customers/me/orders?page=${page}`,
      "GET",
      undefined,
      signal,
    ),
  );
  useEffect(() => {
    const controller = new AbortController();
    loadOrders(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data);
          setError("");
        }
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(message(error_));
      });
    return () => controller.abort();
  }, [page]);
  return (
    <section className="customer-orders">
      {selectedOrder ? (
        <OrderDetailPanel
          orderNumber={selectedOrder}
          request={account.api}
          onBack={() => setSelectedOrder(null)}
        />
      ) : (
        <>
          {error && <p role="alert">{error}</p>}
          {!result && !error && <output>Cargando órdenes...</output>}
          {result?.data.map((order) => (
            <article key={order.orderNumber}>
              <h3>{order.orderNumber}</h3>
              <p>
                {orderStatuses[order.status] ?? order.status} ·{" "}
                {formatPrice(order.totalInCents)}
              </p>
              <time dateTime={order.createdAt}>
                {new Intl.DateTimeFormat("es-PE", {
                  dateStyle: "medium",
                  timeZone: "America/Lima",
                }).format(new Date(order.createdAt))}
              </time>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedOrder(order.orderNumber)}
              >
                <Eye size={16} />
                Ver detalle
              </button>
              {order.storeOrders.map((storeOrder, index) => (
                <div key={`${order.orderNumber}:${index}`}>
                  <h4>{storeOrder.store.displayName}</h4>
                  {storeOrder.items.map((item, itemIndex) => (
                    <p key={`${item.productName}:${itemIndex}`}>
                      {item.productName} · {item.sizeLabel} / {item.color} ×{" "}
                      {item.quantity}
                    </p>
                  ))}
                </div>
              ))}
            </article>
          ))}
          {result && !result.total && <p>Aún no tienes órdenes registradas.</p>}
          {result && (
            <footer>
              <output>
                {result.total} órdenes · Página {page} de{" "}
                {Math.max(1, result.pages)}
              </output>
              <div>
                <button
                  type="button"
                  className="icon-button bordered"
                  title="Órdenes anteriores"
                  aria-label="Órdenes anteriores"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button bordered"
                  title="Órdenes siguientes"
                  aria-label="Órdenes siguientes"
                  disabled={page >= result.pages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </section>
  );
}
