"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Search,
  Shirt,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import {
  type CatalogProduct,
  type CatalogFilters,
  type CatalogPage,
  type CatalogQuery,
  getCatalog,
  getCatalogFilters,
  getCatalogProduct,
  formatPrice,
} from "@/lib/catalog-api";
import "./catalog.css";

const SAVED_KEY = "gami.catalog.saved";
const EMPTY_PAGE: CatalogPage = { data: [], total: 0, page: 1, pages: 0 };
const INITIAL_QUERY: CatalogQuery = {
  search: "",
  category: "",
  storeId: "",
  sort: "newest",
  page: 1,
};

function subscribeSaved(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("gami-saved", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("gami-saved", callback);
  };
}
function savedSnapshot() {
  try {
    return localStorage.getItem(SAVED_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function parseSavedIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string").slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
function useSavedProducts() {
  const raw = useSyncExternalStore(subscribeSaved, savedSnapshot, () => "[]");
  const ids = parseSavedIds(raw);
  function toggle(id: string) {
    const next = ids.includes(id)
      ? ids.filter((savedId) => savedId !== id)
      : [...ids.slice(-99), id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("gami-saved"));
  }
  return { ids, raw, toggle };
}

function ProductPhoto({ product }: Readonly<{ product: CatalogProduct }>) {
  const [failed, setFailed] = useState(false);
  return product.imageUrl && !failed ? (
    <Image
      src={product.imageUrl}
      alt={
        product.imageIsReference
          ? `Imagen referencial de ${product.name}`
          : product.name
      }
      width={600}
      height={750}
      unoptimized
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="photo-placeholder">
      <Shirt size={36} strokeWidth={1} />
      <span>Foto no disponible</span>
    </span>
  );
}

function ProductCard({
  product,
  saved,
  onOpen,
  onSave,
}: Readonly<{
  product: CatalogProduct;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
}>) {
  const sizes = product.variants.length
    ? [...new Set(product.variants.map((variant) => variant.size))]
    : (product.declaredSizes ?? []);
  const colors = product.variants.length
    ? [...new Set(product.variants.map((variant) => variant.color))]
    : (product.declaredColors ?? []).map((color) => color.name);
  const stockKnown = product.stockKnown ?? product.variants.length > 0;
  const stockStatus = product.variants.some(
    (variant) => variant.availableStock > 0,
  )
    ? "Con stock"
    : "Agotado";
  return (
    <article className="product-card">
      <div className="product-photo">
        <button
          className="product-open"
          onClick={onOpen}
          aria-label={`Ver ${product.name}`}
        >
          <ProductPhoto product={product} />
        </button>
        {product.imageIsReference && (
          <span className="product-reference">Imagen referencial</span>
        )}
        <button
          className="product-save"
          onClick={onSave}
          aria-label={
            saved
              ? `Quitar ${product.name} de guardados`
              : `Guardar ${product.name}`
          }
          title={saved ? "Quitar de guardados" : "Guardar prenda"}
          aria-pressed={saved}
        >
          <Heart size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <p className="product-brand">{product.store.displayName}</p>
      <h3>
        <button onClick={onOpen}>{product.name}</button>
      </h3>
      <p className="product-options">
        {sizes.length} {sizes.length === 1 ? "talla" : "tallas"}
        {" · "}
        {colors.length} {colors.length === 1 ? "color" : "colores"}
      </p>
      <div className="product-meta">
        <strong>{formatPrice(product.unitPriceInCents)}</strong>
        <span>{stockKnown ? stockStatus : "Stock por confirmar"}</span>
      </div>
    </article>
  );
}

function CatalogTitle({
  view,
}: Readonly<{ view: "products" | "brands" | "saved" }>) {
  if (view === "brands") return <>Marcas de Gamarra</>;
  if (view === "saved") return <>Tus prendas guardadas</>;
  return (
    <>
      Moda de Gamarra,
      <br />
      <em>en un solo lugar.</em>
    </>
  );
}

function ProductGallery({ product }: Readonly<{ product: CatalogProduct }>) {
  const coverImages = product.imageUrl ? [product.imageUrl] : [];
  const images = product.imageUrls?.length ? product.imageUrls : coverImages;
  const [selected, setSelected] = useState(0);
  return (
    <fieldset className="detail-gallery" aria-label="Fotos del producto">
      <div className="detail-photo">
        <ProductPhoto
          key={images[selected] ?? product.id}
          product={{ ...product, imageUrl: images[selected] ?? null }}
        />
      </div>
      {images.length > 1 && (
        <>
          <div className="gallery-controls">
            <button
              className="icon-button bordered"
              aria-label="Foto anterior"
              title="Foto anterior"
              disabled={selected === 0}
              onClick={() => setSelected(selected - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <output aria-live="polite">
              {selected + 1} / {images.length}
            </output>
            <button
              className="icon-button bordered"
              aria-label="Foto siguiente"
              title="Foto siguiente"
              disabled={selected === images.length - 1}
              onClick={() => setSelected(selected + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="gallery-thumbnails">
            {images.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-label={`Ver foto ${index + 1}`}
                title={`Foto ${index + 1}`}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                <Image src={url} alt="" width={64} height={80} unoptimized />
              </button>
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}

const specificationLabels: Record<string, string> = {
  material: "Material",
  fit: "Corte",
  details: "Detalles",
  care: "Cuidados",
};

function ProductDetail({
  id,
  saved,
  onSave,
  onClose,
}: Readonly<{
  id: string;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [variantId, setVariantId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    getCatalogProduct(id, controller.signal)
      .then(setProduct)
      .catch((error_: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error_ instanceof Error
              ? error_.message
              : "No pudimos cargar la prenda.",
          );
      });
    return () => {
      controller.abort();
      document.body.style.overflow = previousOverflow;
    };
  }, [id]);
  const variant = product?.variants.find((item) => item.id === variantId);
  const variantStock = variant
    ? `${variant.availableStock} unidades disponibles`
    : "Selecciona talla y color para consultar el stock.";
  return (
    <dialog
      ref={dialog}
      className="product-dialog"
      aria-labelledby="product-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <button
        className="icon-button detail-close"
        aria-label="Cerrar detalle"
        title="Cerrar detalle"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      {error && (
        <div className="catalog-empty" role="alert">
          <h2 id="product-title">Prenda no disponible</h2>
          <p>{error}</p>
        </div>
      )}
      {!error && product && (
        <div className="product-detail-grid">
          <ProductGallery product={product} />
          <div className="detail-information">
            <p className="eyebrow">{product.store.displayName}</p>
            <h2 id="product-title">{product.name}</h2>
            {product.imageIsReference && (
              <p className="product-options">
                Imagen referencial; no corresponde al producto real.
              </p>
            )}
            <p className="detail-price">
              {formatPrice(product.unitPriceInCents)}
            </p>
            {product.wholesalePriceInCents !== null &&
              product.wholesaleMinimum !== null && (
                <p className="wholesale-price">
                  Por mayor: {formatPrice(product.wholesalePriceInCents)} desde{" "}
                  {product.wholesaleMinimum} unidades
                </p>
              )}
            <p className="product-description">
              {product.description ?? "Sin descripción adicional."}
            </p>
            {Object.keys(product.specifications ?? {}).length > 0 && (
              <dl className="product-specifications">
                {Object.entries(product.specifications ?? {}).map(
                  ([key, value]) => (
                    <div key={key}>
                      <dt>{specificationLabels[key] ?? key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ),
                )}
              </dl>
            )}
            {product.variants.length > 0 ? (
              <>
                <label className="field" htmlFor="product-variant">
                  <span>Talla y color</span>
                  <select
                    id="product-variant"
                    value={variantId}
                    onChange={(event) => setVariantId(event.target.value)}
                  >
                    <option value="">Selecciona una variante</option>
                    {product.variants.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.size} · {item.color}
                        {item.availableStock === 0 ? " · Agotado" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <output className="stock-label">
                  {product.stockKnown === false
                    ? "Stock por confirmar"
                    : variantStock}
                </output>
              </>
            ) : (
              <div className="declared-options">
                {!!product.declaredSizes?.length && (
                  <p>
                    <strong>Tallas declaradas:</strong>{" "}
                    {product.declaredSizes.join(" / ")}
                  </p>
                )}
                {!!product.declaredColors?.length && (
                  <div
                    className="declared-colors"
                    aria-label="Colores declarados"
                  >
                    {product.declaredColors.map((color) => (
                      <span key={color.name}>
                        {color.hex && (
                          <i
                            aria-hidden="true"
                            style={{ backgroundColor: color.hex }}
                          />
                        )}
                        {color.name}
                      </span>
                    ))}
                  </div>
                )}
                <output className="stock-label">Stock por confirmar</output>
              </div>
            )}
            {variant?.stockUpdatedAt && (
              <p className="stock-date">
                Actualizado el{" "}
                {new Intl.DateTimeFormat("es-PE", {
                  dateStyle: "medium",
                }).format(new Date(variant.stockUpdatedAt))}
              </p>
            )}
            <button
              className="save-detail"
              onClick={onSave}
              aria-pressed={saved}
            >
              <Heart size={18} fill={saved ? "currentColor" : "none"} />
              {saved ? "Quitar de guardados" : "Guardar prenda"}
            </button>
          </div>
        </div>
      )}
      {!error && !product && (
        <div className="catalog-empty">
          <h2 id="product-title">
            <output>Cargando prenda...</output>
          </h2>
        </div>
      )}
    </dialog>
  );
}

function EmptyProducts({
  saved,
  query,
  onReset,
}: Readonly<{ saved: boolean; query: CatalogQuery; onReset: () => void }>) {
  const canReset = Boolean(
    query.search || query.category || query.storeId || saved,
  );
  return (
    <div className="catalog-empty">
      <Shirt size={36} strokeWidth={1} />
      <h2>
        {saved
          ? "Todavía no tienes prendas guardadas"
          : "No hay prendas disponibles por ahora"}
      </h2>
      <p>
        {saved
          ? "Tus favoritos aparecerán aquí."
          : "Vuelve pronto o prueba con otra búsqueda."}
      </p>
      {canReset && (
        <button onClick={onReset}>
          Ver todas las prendas <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

export function Catalog() {
  const [view, setView] = useState<"products" | "brands" | "saved">("products");
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>({
    categories: [],
    stores: [],
  });
  const [result, setResult] = useState<CatalogPage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { ids: savedIds, raw: savedRaw, toggle } = useSavedProducts();
  const savedQuery = view === "saved" ? savedRaw : "[]";

  useEffect(() => {
    function restoreDetail() {
      setSelectedId(new URL(location.href).searchParams.get("producto"));
    }
    restoreDetail();
    window.addEventListener("popstate", restoreDetail);
    return () => window.removeEventListener("popstate", restoreDetail);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const nextFilters = await getCatalogFilters(controller.signal);
        let next: CatalogPage;
        if (view === "saved") {
          const ids = parseSavedIds(savedQuery);
          const products = await Promise.all(
            ids.map((id) =>
              getCatalogProduct(id, controller.signal).catch(
                (error_: unknown) => {
                  if (
                    error_ instanceof Error &&
                    error_.message === "Esta prenda ya no está disponible."
                  )
                    return null;
                  throw error_;
                },
              ),
            ),
          );
          const data = products.filter(
            (product): product is CatalogProduct => product !== null,
          );
          next = { data, total: data.length, page: 1, pages: 1 };
        } else next = await getCatalog(query, controller.signal);
        if (!controller.signal.aborted) {
          setFilters(nextFilters);
          setResult(next);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult(EMPTY_PAGE);
          setError(
            "No pudimos cargar el catálogo. Inténtalo de nuevo en un momento.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query, view, retry, savedQuery]);

  function changeView(next: typeof view) {
    setView(next);
    setQuery(INITIAL_QUERY);
    setSearch("");
  }
  function submitSearch(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setView("products");
    setQuery((current) => ({ ...current, search: search.trim(), page: 1 }));
  }
  function openDetail(id: string | null) {
    const url = new URL(location.href);
    if (id) url.searchParams.set("producto", id);
    else url.searchParams.delete("producto");
    history.pushState(null, "", url);
    setSelectedId(id);
  }
  function save(id: string) {
    try {
      toggle(id);
    } catch {
      setError(
        "No se pudo guardar en este navegador. Revisa los permisos de almacenamiento.",
      );
    }
  }

  return (
    <div className="storefront">
      <a className="skip-link" href="#catalog-content">
        Ir al catálogo
      </a>
      <div className="catalog-topline">Moda de Gamarra · Marcas locales</div>
      <header className="catalog-header">
        <Link href="/" className="catalog-wordmark" aria-label="Gami, inicio">
          gami<span aria-hidden="true">.</span>
        </Link>
        <nav className="catalog-navigation" aria-label="Catálogo">
          <button
            aria-current={view === "products" ? "page" : undefined}
            onClick={() => changeView("products")}
          >
            <Shirt size={17} />
            Prendas
          </button>
          <button
            aria-current={view === "brands" ? "page" : undefined}
            onClick={() => changeView("brands")}
          >
            <Store size={17} />
            Marcas
          </button>
          <button
            aria-current={view === "saved" ? "page" : undefined}
            onClick={() => changeView("saved")}
          >
            <Heart size={17} />
            Guardados
            {savedIds.length > 0 && (
              <span className="saved-count">{savedIds.length}</span>
            )}
          </button>
        </nav>
        <Link href="/portal" className="portal-entry">
          Ingresar al portal <ArrowUpRight size={17} />
        </Link>
      </header>

      <main id="catalog-content" className="catalog-main">
        <section className="catalog-intro">
          <div>
            <p className="eyebrow">Hecho cerca. Elegido por ti.</p>
            <h1>
              <CatalogTitle view={view} />
            </h1>
          </div>
          <p>
            {view === "saved"
              ? "Lo que te gustó, para volver a encontrarlo."
              : "Descubre prendas, tallas y colores de marcas locales. Encuentra lo que va contigo."}
          </p>
        </section>

        {view === "products" && (
          <>
            <form
              className="catalog-search"
              onSubmit={submitSearch}
              role="search"
            >
              <Search size={20} />
              <input
                aria-label="Buscar prendas o marcas"
                placeholder="¿Qué estás buscando?"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={120}
              />
              <button type="submit" aria-label="Buscar" title="Buscar">
                <ArrowRight size={20} />
              </button>
            </form>
            <div className="category-strip" aria-label="Categorías">
              <button
                aria-pressed={!query.category}
                onClick={() =>
                  setQuery((current) => ({ ...current, category: "", page: 1 }))
                }
              >
                Ver todo
              </button>
              {filters.categories.map((category) => (
                <button
                  key={category}
                  aria-pressed={query.category === category}
                  onClick={() =>
                    setQuery((current) => ({ ...current, category, page: 1 }))
                  }
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="catalog-controls">
              <h2>{query.category || "Todas las prendas"}</h2>
              <div>
                <label>
                  <SlidersHorizontal size={16} />
                  <span className="sr-only">Marca</span>
                  <select
                    aria-label="Filtrar por marca"
                    value={query.storeId}
                    onChange={(event) =>
                      setQuery((current) => ({
                        ...current,
                        storeId: event.target.value,
                        page: 1,
                      }))
                    }
                  >
                    <option value="">Todas las marcas</option>
                    {filters.stores.map((store) => (
                      <option value={store.id} key={store.id}>
                        {store.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <select
                  aria-label="Ordenar prendas"
                  value={query.sort}
                  onChange={(event) =>
                    setQuery((current) => ({
                      ...current,
                      sort: event.target.value,
                      page: 1,
                    }))
                  }
                >
                  <option value="newest">Recién llegado</option>
                  <option value="price-asc">Menor precio</option>
                  <option value="price-desc">Mayor precio</option>
                </select>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="catalog-error" role="alert">
            <p>{error}</p>
            <button onClick={() => setRetry((current) => current + 1)}>
              Reintentar
            </button>
          </div>
        )}
        {loading ? (
          <div className="catalog-loading">
            <output>Cargando catálogo...</output>
            <div className="catalog-skeletons" aria-hidden="true">
              {[1, 2, 3, 4].map((item) => (
                <span key={item} />
              ))}
            </div>
          </div>
        ) : (
          !error && (
            <>
              {view === "brands" ? (
                <div className="brand-directory">
                  {filters.stores.map((store) => (
                    <button
                      key={store.id}
                      onClick={() => {
                        setView("products");
                        setQuery({ ...INITIAL_QUERY, storeId: store.id });
                      }}
                    >
                      <Store size={24} />
                      <strong>{store.displayName}</strong>
                      <span>
                        Ver prendas <ArrowRight size={16} />
                      </span>
                    </button>
                  ))}
                  {!filters.stores.length && (
                    <div className="catalog-empty">
                      <Store size={32} strokeWidth={1} />
                      <h2>Las marcas están por llegar</h2>
                      <p>
                        Aquí encontrarás las tiendas con catálogo publicado.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <output className="catalog-result-count">
                    {result.total} {result.total === 1 ? "prenda" : "prendas"}
                  </output>
                  <div
                    className="catalog-grid"
                    data-compact={result.data.length <= 6}
                  >
                    {result.data.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        saved={savedIds.includes(product.id)}
                        onOpen={() => openDetail(product.id)}
                        onSave={() => save(product.id)}
                      />
                    ))}
                  </div>
                  {!result.data.length && (
                    <EmptyProducts
                      saved={view === "saved"}
                      query={query}
                      onReset={() => changeView("products")}
                    />
                  )}
                  {result.pages > 1 && (
                    <nav
                      className="catalog-pagination"
                      aria-label="Páginas del catálogo"
                    >
                      <button
                        className="icon-button bordered"
                        aria-label="Página anterior"
                        disabled={query.page === 1}
                        onClick={() =>
                          setQuery((current) => ({
                            ...current,
                            page: current.page - 1,
                          }))
                        }
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span>
                        Página {result.page} de {result.pages}
                      </span>
                      <button
                        className="icon-button bordered"
                        aria-label="Página siguiente"
                        disabled={query.page >= result.pages}
                        onClick={() =>
                          setQuery((current) => ({
                            ...current,
                            page: current.page + 1,
                          }))
                        }
                      >
                        <ChevronRight size={18} />
                      </button>
                    </nav>
                  )}
                </>
              )}
            </>
          )
        )}
      </main>
      <footer className="catalog-footer">
        <Image src="/gami-mark.svg" width={48} height={40} alt="Gami" />
        <p>Marcas locales. Tu próximo favorito.</p>
        <Link href="/portal">
          Portal de tiendas y administración <ArrowUpRight size={16} />
        </Link>
      </footer>
      {selectedId && (
        <ProductDetail
          key={selectedId}
          id={selectedId}
          saved={savedIds.includes(selectedId)}
          onSave={() => save(selectedId)}
          onClose={() => openDetail(null)}
        />
      )}
    </div>
  );
}
