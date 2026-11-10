"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  login as loginAccount,
  logout,
  refreshSession,
  type AuthSession,
} from "./auth-api";
import type { CartItem } from "./checkout-api";

export type CustomerProfile = {
  fullName: string;
  email: string | null;
  phone: string;
  user: { username: string };
};
export type RegisterCustomer = {
  username: string;
  displayName: string;
  email: string;
  phone: string;
  password: string;
};
export type AccountView =
  | "login"
  | "register"
  | "profile"
  | "orders"
  | "password"
  | "forgot"
  | "recover";
const KEY = "gami.customer.session";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";
let refreshing: Promise<AuthSession> | null = null;
function rotate(refreshToken: string) {
  refreshing ??= refreshSession(refreshToken).finally(() => {
    refreshing = null;
  });
  return refreshing;
}
function customerOnly(session: AuthSession) {
  if (session.user.roles.length !== 1 || session.user.roles[0] !== "CUSTOMER")
    throw new Error(
      "Esta cuenta corresponde al portal de tiendas y administración.",
    );
  return session;
}

async function request<T>(
  path: string,
  method: string,
  input?: object,
  token?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
    signal,
    cache: "no-store",
  }).catch(() => {
    throw new Error("No pudimos conectar con Gami. Inténtalo nuevamente.");
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message =
      response.status === 401
        ? "La sesión o las credenciales no son válidas."
        : response.status === 429
          ? "Demasiados intentos. Espera un minuto."
          : typeof body?.message === "string"
            ? body.message
            : "Revisa los campos obligatorios y sus formatos.";
    throw new ApiError(message, response.status);
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

type CustomerContextValue = {
  session: AuthSession | null;
  profile: CustomerProfile | null;
  cart: CartItem[];
  favorites: string[];
  loading: boolean;
  busy: boolean;
  error: string;
  view: AccountView | null;
  open: (view?: AccountView) => void;
  close: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (input: RegisterCustomer) => Promise<void>;
  signOut: () => Promise<void>;
  acceptSession: (session: AuthSession) => void;
  api: <T>(
    path: string,
    method?: string,
    input?: object,
    signal?: AbortSignal,
  ) => Promise<T>;
  reload: () => Promise<void>;
  add: (item: CartItem) => Promise<void>;
  change: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  toggleFavorite: (productId: string) => Promise<void>;
};
const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const current = useRef<AuthSession | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<AccountView | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  function acceptSession(next: AuthSession) {
    customerOnly(next);
    sessionStorage.removeItem("gami.auth.session");
    if (current.current?.user.id !== next.user.id) {
      setCart([]);
      setFavorites([]);
      setProfile(null);
    }
    current.current = next;
    setSession(next);
    sessionStorage.setItem(KEY, JSON.stringify(next));
  }
  function clearSession() {
    current.current = null;
    setSession(null);
    setCart([]);
    setFavorites([]);
    setProfile(null);
    sessionStorage.removeItem(KEY);
    setLoading(false);
  }
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const stored = sessionStorage.getItem(KEY);
        if (!stored) return;
        const saved = customerOnly(JSON.parse(stored) as AuthSession);
        const next = await rotate(saved.tokens.refreshToken);
        if (active) acceptSession(next);
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setLoading(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);

  async function api<T>(
    path: string,
    method = "GET",
    input?: object,
    signal?: AbortSignal,
  ): Promise<T> {
    const original = current.current;
    if (!original) {
      setView("login");
      throw new Error("Inicia sesión con tu cuenta de cliente.");
    }
    try {
      return await request<T>(
        path,
        method,
        input,
        original.tokens.accessToken,
        signal,
      );
    } catch (error_) {
      if (!(error_ instanceof ApiError) || error_.status !== 401) throw error_;
      let next: AuthSession;
      try {
        next = customerOnly(await rotate(original.tokens.refreshToken));
      } catch {
        if (current.current?.user.id === original.user.id) {
          clearSession();
          setView("login");
        }
        throw new Error("Tu sesión terminó. Vuelve a ingresar.");
      }
      if (current.current?.user.id !== original.user.id)
        throw new Error("La cuenta cambió. Vuelve a intentar.");
      acceptSession(next);
      return request<T>(path, method, input, next.tokens.accessToken, signal);
    }
  }
  async function reload() {
    const owner = current.current?.user.id;
    if (!owner || current.current?.user.mustChangePassword) return;
    const [nextCart, nextFavorites, nextProfile] = await Promise.all([
      api<CartItem[]>("/customers/me/cart"),
      api<string[]>("/customers/me/favorites"),
      api<CustomerProfile>("/customers/me"),
    ]);
    if (current.current?.user.id === owner) {
      setCart(nextCart);
      setFavorites(nextFavorites);
      setProfile(nextProfile);
      setError("");
    }
  }
  const reloadAccount = useEffectEvent(() => reload());
  useEffect(() => {
    let active = true;
    async function load() {
      if (!current.current || current.current.user.mustChangePassword) return;
      setLoading(true);
      try {
        await reloadAccount();
      } catch (error_) {
        if (active)
          setError(
            error_ instanceof Error
              ? error_.message
              : "No se pudo cargar tu cuenta.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [session?.user.id, session?.user.mustChangePassword]);

  async function authenticate(path: string, input: object) {
    const result = await request<AuthSession>(path, "POST", input);
    acceptSession(result);
    setError("");
    setView(result.user.mustChangePassword ? "password" : null);
  }
  async function signOut() {
    const token = current.current?.tokens.accessToken;
    try {
      if (token) await logout(token);
    } finally {
      clearSession();
      setView(null);
      setError("");
    }
  }
  function mutate(operation: () => Promise<unknown>) {
    const owner = current.current?.user.id;
    if (!owner) {
      setView("login");
      return Promise.reject(
        new Error("Inicia sesión para personalizar tu cuenta."),
      );
    }
    const next = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (current.current?.user.id !== owner)
          throw new Error("La cuenta cambió. Vuelve a intentar.");
        setBusy(true);
        try {
          await operation();
          await reload();
        } finally {
          setBusy(false);
        }
      });
    queue.current = next;
    return next;
  }
  const value: CustomerContextValue = {
    session,
    profile,
    cart,
    favorites,
    loading,
    busy,
    error,
    view,
    open: (next = "profile") =>
      setView(
        current.current
          ? current.current.user.mustChangePassword
            ? "password"
            : next
          : ["login", "register", "forgot", "recover"].includes(next)
            ? next
            : "login",
      ),
    close: () => setView(null),
    login: async (username, password) => {
      const result = await loginAccount(username, password);
      const isCustomer =
        result.user.roles.length === 1 && result.user.roles[0] === "CUSTOMER";
      if (!isCustomer) {
        clearSession();
        sessionStorage.setItem("gami.auth.session", JSON.stringify(result));
        setView(null);
        router.push("/portal");
        return;
      }
      acceptSession(result);
      setError("");
      setView(result.user.mustChangePassword ? "password" : null);
    },
    register: (input) => authenticate("/customers/register", input),
    signOut,
    acceptSession,
    api,
    reload,
    add: (item) =>
      mutate(async () => {
        const latest = await api<CartItem[]>("/customers/me/cart");
        const quantity =
          (latest.find((row) => row.variantId === item.variantId)?.quantity ??
            0) + item.quantity;
        await api(
          `/customers/me/cart/${encodeURIComponent(item.variantId)}`,
          "PUT",
          { quantity },
        );
      }),
    change: (variantId, quantity) =>
      mutate(() =>
        api(`/customers/me/cart/${encodeURIComponent(variantId)}`, "PUT", {
          quantity,
        }),
      ),
    remove: (variantId) =>
      mutate(() =>
        api(`/customers/me/cart/${encodeURIComponent(variantId)}`, "DELETE"),
      ),
    toggleFavorite: (productId) =>
      mutate(async () => {
        const latest = await api<string[]>("/customers/me/favorites");
        await api(
          `/customers/me/favorites/${encodeURIComponent(productId)}`,
          latest.includes(productId) ? "DELETE" : "PUT",
        );
      }),
  };
  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}
export function useCustomer() {
  const value = useContext(CustomerContext);
  if (!value) throw new Error("CustomerProvider is required.");
  return value;
}
