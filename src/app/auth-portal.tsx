"use client";

import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { SyntheticEvent, useEffect, useState } from "react";
import {
  ApiError,
  AuthSession,
  changePassword,
  getCurrentUser,
  login,
  logout,
  refreshSession,
} from "@/lib/auth-api";
import { AdminPanel } from "./admin-panel";

const SESSION_KEY = "gami.auth.session";
let refreshInFlight: Promise<AuthSession> | null = null;

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
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

export function AuthPortal() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
        window.sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
      }
    }, renewAfter);
    return () => window.clearTimeout(timer);
  }, [session]);

  function persist(nextSession: AuthSession) {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
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
        "We could not sign you in. Check your credentials and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handlePasswordChange(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setPending(true);
    try {
      persist(
        await changePassword(
          session!.tokens.accessToken,
          password,
          newPassword,
        ),
      );
      setPassword("");
      setNewPassword("");
      setConfirmation("");
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "The password could not be changed.",
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
      window.sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
      setPending(false);
    }
  }

  if (!ready) {
    return <main className="loading-screen" aria-label="Loading session" />;
  }

  if (session?.user.mustChangePassword) {
    return (
      <main className="auth-layout">
        <section className="brand-panel">
          <div className="brand-mark">G</div>
          <div className="brand-copy">
            <p>Gami operations</p>
            <h1>Secure access starts with you.</h1>
            <p>
              Replace your temporary password before entering the operational
              workspace.
            </p>
          </div>
          <div className="security-note">
            <ShieldCheck size={20} />
            <span>Your previous sessions will be closed automatically.</span>
          </div>
        </section>

        <section className="form-panel">
          <div className="form-wrap">
            <div className="section-icon">
              <KeyRound size={24} />
            </div>
            <p className="eyebrow">Required security step</p>
            <h2>Create a permanent password</h2>
            <p className="supporting-copy">
              Welcome, {session.user.displayName}. Use at least 12 characters.
            </p>
            <form onSubmit={handlePasswordChange}>
              <PasswordInput
                id="current-password"
                label="Temporary password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
              <PasswordInput
                id="new-password"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              <PasswordInput
                id="confirmation"
                label="Confirm new password"
                value={confirmation}
                onChange={setConfirmation}
                autoComplete="new-password"
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary-button"
                disabled={pending}
                type="submit"
              >
                <span>{pending ? "Updating..." : "Update password"}</span>
                <ArrowRight size={18} />
              </button>
            </form>
            <button
              className="text-button"
              type="button"
              onClick={handleLogout}
              disabled={pending}
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (session) {
    const canAdministerUsers = session.user.roles.includes("SUPER_ADMIN");
    return (
      <main className="workspace">
        <header className="workspace-header">
          <div className="brand-lockup">
            <span className="brand-mark small">G</span>
            <strong>Gami</strong>
          </div>
          <div className="profile">
            <span>{session.user.displayName}</span>
            <button
              className="icon-button bordered"
              onClick={handleLogout}
              disabled={pending}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {canAdministerUsers ? (
          <AdminPanel accessToken={session.tokens.accessToken} />
        ) : (
          <section className="workspace-content">
            <p className="eyebrow">Operations workspace</p>
            <h1>Good to see you, {session.user.displayName.split(" ")[0]}.</h1>
            <p className="supporting-copy">
              Your identity is verified and your workspace is ready.
            </p>
            <div className="module-grid">
              <article>
                <Users size={22} />
                <div>
                  <h2>Users & access</h2>
                  <p>Manage roles, sessions and store memberships.</p>
                </div>
                <span>Ready</span>
              </article>
              <article>
                <Store size={22} />
                <div>
                  <h2>Stores</h2>
                  <p>Store operations will be connected in the next module.</p>
                </div>
                <span className="muted-status">Next</span>
              </article>
            </div>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <div className="brand-mark">G</div>
        <div className="brand-copy">
          <p>Gami marketplace</p>
          <h1>Every operation, in one clear view.</h1>
          <p>
            Manage commerce, stores and teams from a workspace built for daily
            decisions.
          </p>
        </div>
        <div className="signal-row">
          <span>Identity</span>
          <span>Inventory</span>
          <span>Operations</span>
        </div>
      </section>
      <section className="form-panel">
        <div className="form-wrap">
          <p className="eyebrow">Operations portal</p>
          <h2>Sign in to Gami</h2>
          <p className="supporting-copy">
            Use your assigned platform credentials.
          </p>
          <form onSubmit={handleLogin}>
            <label className="field" htmlFor="username">
              <span>Username</span>
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
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={pending} type="submit">
              <span>{pending ? "Signing in..." : "Continue"}</span>
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="form-footnote">
            Access is restricted to authorized Gami team members.
          </p>
        </div>
      </section>
    </main>
  );
}
