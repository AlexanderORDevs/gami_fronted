export type CatalogVariant = {
  id: string;
  size: string;
  color: string;
  availableStock: number;
  stockUpdatedAt: string | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  unitPriceInCents: number;
  wholesalePriceInCents: number | null;
  wholesaleMinimum: number | null;
  imageUrl: string | null;
  store: { id: string; displayName: string };
  variants: CatalogVariant[];
};

export type CatalogPage = {
  data: CatalogProduct[];
  total: number;
  page: number;
  pages: number;
};
export type CatalogFilters = {
  categories: string[];
  stores: { id: string; displayName: string }[];
};
export type CatalogQuery = {
  search: string;
  category: string;
  storeId: string;
  sort: string;
  page: number;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}/catalog/${path}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Esta prenda ya no está disponible."
        : "No pudimos cargar el catálogo. Inténtalo de nuevo.",
    );
  return response.json() as Promise<T>;
}

export function getCatalog(query: CatalogQuery, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== "") params.set(key, String(value));
  return get<CatalogPage>(`products?${params}`, signal);
}
export const getCatalogFilters = (signal?: AbortSignal) =>
  get<CatalogFilters>("filters", signal);
export const getCatalogProduct = (id: string, signal?: AbortSignal) =>
  get<CatalogProduct>(`products/${encodeURIComponent(id)}`, signal);
export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    cents / 100,
  );
