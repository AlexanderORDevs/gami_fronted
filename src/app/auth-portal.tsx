"use client";

import {
  ArrowRight,
  Dices,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, SyntheticEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  AuthSession,
  changePassword,
  getCurrentUser,
  login,
  logout,
  PasswordChangeResult,
  recoverPassword,
  refreshSession,
  requestPasswordReset,
} from "@/lib/auth-api";
import { AdminPanel } from "./admin-panel";
import { StoreManagement } from "./store-management";
import { StoreWorkspace, storeSections } from "./store-workspace";
import type { WorkspaceStore, StoreResource } from "@/lib/store-api";
import {
  ADMIN_SECTIONS,
  AdminInformation,
  useAdminSection,
  type AdminSection,
} from "./admin-information";

const SESSION_KEY = "gami.auth.session";
let refreshInFlight: Promise<AuthSession> | null = null;

type PublicView = "login" | "reset-password";

function AuthBrand() {
  return (
    <header className="auth-brand">
      <Link href="/" aria-label="Volver al catálogo de Gami">
        <Image
          src="/gami-mark.svg"
          width={72}
          height={60}
          alt="Gami"
          priority
        />
      </Link>
      <p>Portal de tiendas y administración</p>
      <Link href="/" className="text-button">
        Volver al catálogo
      </Link>
    </header>
  );
}

function WorkspaceFrame({
  session,
  section,
  pending,
  onPasswordChange,
  onLogout,
  children,
  storePermissions = [],
}: Readonly<{
  session: AuthSession;
  section: AdminSection;
  pending: boolean;
  onPasswordChange: () => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
  storePermissions?: StoreResource[];
}>) {
  const isAdmin = session.user.roles.includes("SUPER_ADMIN");
  const workspaceName = isAdmin ? "Administración" : "Mi tienda";
  const navigation = isAdmin ? ADMIN_SECTIONS : storeSections(storePermissions);
  const currentSection =
    navigation.find((item) => item.id === section) ?? navigation[0];
  const sectionLabel = currentSection?.label ?? "Mi tienda";
  return (
    <div className="workspace">
      <aside className="workspace-sidebar" aria-label="Navegación del portal">
        <div className="sidebar-brand">
          <Image src="/gami-mark.svg" width={48} height={40} alt="Gami" />
          <span>{workspaceName}</span>
        </div>
        <p className="sidebar-label">Portal</p>
        <nav aria-label="Navegación principal">
          {navigation.map((item) => (
            <a
              key={item.id}
              className="workspace-nav-link"
              href={`#${item.id}`}
              aria-current={currentSection?.id === item.id ? "page" : undefined}
            >
              <item.icon size={18} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck size={16} /> Operaciones Gami
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <div className="workspace-breadcrumb">
            <span>{workspaceName}</span>
            <span aria-hidden="true">/</span>
            <strong>{sectionLabel}</strong>
          </div>
          <div className="profile">
            <span className="profile-avatar" aria-hidden="true">
              {session.user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="profile-name">{session.user.displayName}</span>
            <button
              className="icon-button bordered"
              onClick={onPasswordChange}
              aria-label="Cambiar contraseña"
              title="Cambiar contraseña"
            >
              <KeyRound size={18} />
            </button>
            <button
              className="icon-button bordered"
              onClick={onLogout}
              disabled={pending}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="workspace-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

function generateSuggestedPassword() {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*?",
  ];
  const characters = groups.join("");
  const randomIndex = (length: number) => {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % length;
  };
  const password = groups.map((group) => group[randomIndex(group.length)]);
  while (password.length < 16) {
    password.push(characters[randomIndex(characters.length)]);
  }
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [password[index], password[swapIndex]] = [
      password[swapIndex],
      password[index],
    ];
  }
  return password.join("");
}

function rotateSession(refreshToken: string) {
  refreshInFlight ??= refreshSession(refreshToken).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}>) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <span className="input-shell">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          className="icon-button"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

function PasswordSuggestion({
  onUse,
}: Readonly<{
  onUse: (password: string) => void;
}>) {
  return (
    <div className="password-guidance">
      <span>
        Usa al menos 12 caracteres. Combina letras, números y símbolos.
      </span>
      <button type="button" onClick={() => onUse(generateSuggestedPassword())}>
        <Dices size={16} /> Sugerir contraseña
      </button>
    </div>
  );
}

function PasswordError({ message }: Readonly<{ message: string }>) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}

function useSuggestedPassword(
  setNewPassword: (password: string) => void,
  setConfirmation: (password: string) => void,
) {
  return (suggestion: string) => {
    setNewPassword(suggestion);
    setConfirmation(suggestion);
  };
}

function useManagedSession() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  function persist(nextSession: AuthSession) {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function clear() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const stored = window.sessionStorage.getItem(SESSION_KEY);
      if (!stored) {
        if (active) setReady(true);
        return;
      }

      try {
        const saved = JSON.parse(stored) as AuthSession;
        const user = await getCurrentUser(saved.tokens.accessToken);
        if (active) persist({ ...saved, user });
      } catch (error_) {
        try {
          const saved = JSON.parse(stored) as AuthSession;
          if (!(error_ instanceof ApiError) || error_.status !== 401)
            throw error_;
          const renewed = await rotateSession(saved.tokens.refreshToken);
          if (active) persist(renewed);
        } catch {
          window.sessionStorage.removeItem(SESSION_KEY);
          if (active) setSession(null);
        }
      } finally {
        if (active) setReady(true);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const renewAfter = Math.max((session.tokens.expiresIn - 60) * 1000, 30_000);
    const timer = window.setTimeout(async () => {
      try {
        persist(await rotateSession(session.tokens.refreshToken));
      } catch {
        clear();
      }
    }, renewAfter);
    return () => window.clearTimeout(timer);
  }, [session]);

  return { ready, session, persist, clear };
}

type PasswordActionsOptions = {
  session: AuthSession | null;
  currentPassword: string;
  recoveryEmail: string;
  recoveryCode: string;
  newPassword: string;
  confirmation: string;
  persist: (session: AuthSession) => void;
  clearFields: () => void;
  setError: (message: string) => void;
  setPending: (pending: boolean) => void;
  onCompleted: (result: PasswordChangeResult) => void;
};

function usePasswordActions(options: PasswordActionsOptions) {
  async function update(accessToken: string) {
    const result = await changePassword(
      accessToken,
      options.session?.user.mustChangePassword
        ? undefined
        : options.currentPassword,
      options.newPassword,
    );
    options.onCompleted(result);
    options.clearFields();
  }

  async function run(action: () => Promise<void>) {
    options.setError("");
    if (options.newPassword !== options.confirmation) {
      options.setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    options.setPending(true);
    try {
      await action();
    } catch (error_) {
      options.setError(
        error_ instanceof Error
          ? error_.message
          : "No se pudo cambiar la contraseña.",
      );
    } finally {
      options.setPending(false);
    }
  }

  function authenticated(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => update(options.session!.tokens.accessToken));
  }

  function recover(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const result = await recoverPassword(
        options.recoveryEmail.trim(),
        options.recoveryCode.trim(),
        options.newPassword,
      );
      options.onCompleted(result);
      options.clearFields();
    });
  }

  return { authenticated, recover };
}

export function AuthPortal() {
  const router = useRouter();
  const section = useAdminSection();
  const { ready, session, persist, clear } = useManagedSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [publicView, setPublicView] = useState<PublicView>("login");
  const [voluntaryChange, setVoluntaryChange] = useState(false);
  const [activeStore, setActiveStore] = useState<WorkspaceStore | null>(null);
  const useSuggestion = useSuggestedPassword(setNewPassword, setConfirmation);

  const passwordActions = usePasswordActions({
    session,
    currentPassword: password,
    recoveryEmail,
    recoveryCode,
    newPassword,
    confirmation,
    persist,
    clearFields: () => {
      setPassword("");
      setNewPassword("");
      setConfirmation("");
    },
    setError,
    setPending,
    onCompleted: (result) => {
      persist({ tokens: result.tokens, user: result.user });
      setRecoveryCodes(result.recoveryCodes);
      setRecoveryCode("");
      setRecoveryEmail("");
      setResetCodeSent(false);
    },
  });

  async function handleResetRequest(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await requestPasswordReset(recoveryEmail.trim());
      setResetCodeSent(true);
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "No se pudo enviar el correo de recuperación.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleLogin(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      persist(await login(username.trim(), password));
      setPassword("");
    } catch {
      setError(
        "No pudimos iniciar sesión. Revisa tu usuario y contraseña e inténtalo de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    if (!session) return;
    setPending(true);
    try {
      await logout(session.tokens.accessToken);
    } finally {
      clear();
      setVoluntaryChange(false);
      setPending(false);
      router.push("/");
    }
  }

  if (!ready) {
    return <main className="loading-screen" aria-label="Cargando sesión" />;
  }

  if (recoveryCodes.length) {
    return (
      <main className="auth-layout">
        <AuthBrand />
        <section className="form-panel">
          <div className="form-wrap">
            <div className="section-icon">
              <KeyRound size={24} />
            </div>
            <p className="eyebrow">Se muestran una sola vez</p>
            <h2>Códigos de recuperación</h2>
            <p className="supporting-copy">
              Guarda estos cinco códigos. Los anteriores ya no son válidos.
            </p>
            <div className="recovery-code-list">
              {recoveryCodes.map((code) => (
                <code key={code}>{code}</code>
              ))}
            </div>
            <button
              className="secondary-button full-button"
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(recoveryCodes.join("\n"))
              }
            >
              Copiar todos los códigos
            </button>
            <button
              className="primary-button full-button"
              type="button"
              onClick={() => setRecoveryCodes([])}
            >
              Ya los guardé de forma segura <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (session?.user.mustChangePassword || (session && voluntaryChange)) {
    return (
      <main className="auth-layout">
        <AuthBrand />

        <section className="form-panel">
          <div className="form-wrap">
            <div className="section-icon">
              <KeyRound size={24} />
            </div>
            <p className="eyebrow">
              {session.user.mustChangePassword
                ? "Cambio obligatorio"
                : "Seguridad de la cuenta"}
            </p>
            <h2>
              {session.user.mustChangePassword
                ? "Crea tu contraseña definitiva"
                : "Cambia tu contraseña"}
            </h2>
            <p className="supporting-copy">
              Hola, {session.user.displayName}. Elige y confirma una contraseña
              única para esta cuenta.
            </p>
            <form onSubmit={passwordActions.authenticated}>
              {!session.user.mustChangePassword && (
                <PasswordInput
                  id="current-password"
                  label="Contraseña actual"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />
              )}
              <PasswordInput
                id="new-password"
                label="Nueva contraseña"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              <PasswordSuggestion onUse={useSuggestion} />
              <PasswordInput
                id="confirmation"
                label="Confirmar nueva contraseña"
                value={confirmation}
                onChange={setConfirmation}
                autoComplete="new-password"
              />
              <PasswordError message={error} />
              <button
                className="primary-button"
                disabled={pending}
                type="submit"
              >
                <span>
                  {pending ? "Actualizando..." : "Actualizar contraseña"}
                </span>
                <ArrowRight size={18} />
              </button>
            </form>
            <button
              className="text-button"
              type="button"
              onClick={
                session.user.mustChangePassword
                  ? handleLogout
                  : () => setVoluntaryChange(false)
              }
              disabled={pending}
            >
              {session.user.mustChangePassword ? "Cerrar sesión" : "Cancelar"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (session) {
    const canAdministerUsers = session.user.roles.includes("SUPER_ADMIN");
    return (
      <WorkspaceFrame
        session={session}
        section={section}
        pending={pending}
        onPasswordChange={() => setVoluntaryChange(true)}
        onLogout={handleLogout}
        storePermissions={activeStore?.permissions}
      >
        {canAdministerUsers ? (
          <AdministrativeContent
            accessToken={session.tokens.accessToken}
            section={section}
          />
        ) : (
          <StoreWorkspace
            key={session.user.id}
            accessToken={session.tokens.accessToken}
            section={section}
            onStoreChange={setActiveStore}
          />
        )}
      </WorkspaceFrame>
    );
  }

  if (publicView === "reset-password") {
    return (
      <main className="auth-layout">
        <AuthBrand />
        <section className="form-panel">
          <div className="form-wrap">
            <div className="section-icon">
              <KeyRound size={24} />
            </div>
            <p className="eyebrow">Recuperar contraseña</p>
            <h2>
              {resetCodeSent ? "Ingresa el código" : "Recupera tu cuenta"}
            </h2>
            <p className="supporting-copy">
              {resetCodeSent
                ? `Si hay una cuenta activa con ${recoveryEmail} y el correo está habilitado, recibirás un código. Vence en 15 minutos. Si no llega, contacta a un administrador.`
                : "Ingresa el correo de tu cuenta Gami. Si el envío de correo no está disponible, solicita una contraseña temporal a un administrador."}
            </p>
            {!resetCodeSent ? (
              <form onSubmit={handleResetRequest}>
                <label className="field" htmlFor="recovery-email">
                  <span>Correo electrónico</span>
                  <span className="input-shell">
                    <input
                      id="recovery-email"
                      type="email"
                      value={recoveryEmail}
                      onChange={(event) => setRecoveryEmail(event.target.value)}
                      autoComplete="email"
                      required
                    />
                  </span>
                </label>
                <PasswordError message={error} />
                <button
                  className="primary-button"
                  disabled={pending}
                  type="submit"
                >
                  <span>{pending ? "Enviando..." : "Enviar código"}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            ) : (
              <form onSubmit={passwordActions.recover}>
                <label className="field" htmlFor="recovery-code">
                  <span>Código recibido por correo</span>
                  <span className="input-shell">
                    <input
                      id="recovery-code"
                      value={recoveryCode}
                      onChange={(event) => setRecoveryCode(event.target.value)}
                      autoComplete="one-time-code"
                      required
                    />
                  </span>
                </label>
                <PasswordInput
                  id="recovery-new-password"
                  label="Nueva contraseña"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                />
                <PasswordSuggestion onUse={useSuggestion} />
                <PasswordInput
                  id="recovery-confirmation"
                  label="Confirmar nueva contraseña"
                  value={confirmation}
                  onChange={setConfirmation}
                  autoComplete="new-password"
                />
                <PasswordError message={error} />
                <button
                  className="primary-button"
                  disabled={pending}
                  type="submit"
                >
                  <span>
                    {pending ? "Restableciendo..." : "Restablecer contraseña"}
                  </span>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
            {resetCodeSent && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setError("");
                  setRecoveryCode("");
                  setResetCodeSent(false);
                }}
              >
                Usar otro correo
              </button>
            )}
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setError("");
                setResetCodeSent(false);
                setPublicView("login");
              }}
            >
              Volver al inicio de sesión
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-layout">
      <AuthBrand />
      <section className="form-panel">
        <div className="form-wrap">
          <p className="eyebrow">Portal de operaciones</p>
          <h2>Ingresa a Gami</h2>
          <p className="supporting-copy">
            Usa el usuario y la contraseña asignados a tu cuenta.
          </p>
          <form onSubmit={handleLogin}>
            <label className="field" htmlFor="username">
              <span>Usuario</span>
              <span className="input-shell">
                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  required
                />
              </span>
            </label>
            <PasswordInput
              id="password"
              label="Contraseña"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <PasswordError message={error} />
            <button className="primary-button" disabled={pending} type="submit">
              <span>{pending ? "Ingresando..." : "Continuar"}</span>
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="form-footnote">
            Acceso exclusivo para tiendas y personal autorizado de Gami.
          </p>
          <div className="login-options">
            <button
              type="button"
              onClick={() => {
                setError("");
                setPublicView("reset-password");
              }}
            >
              Recuperar contraseña
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function AdministrativeContent({
  accessToken,
  section,
}: Readonly<{ accessToken: string; section: AdminSection }>) {
  if (section === "users") return <AdminPanel accessToken={accessToken} />;
  if (section === "stores")
    return <StoreManagement key={accessToken} accessToken={accessToken} />;
  return (
    <AdminInformation
      key={section}
      accessToken={accessToken}
      section={section}
    />
  );
}
