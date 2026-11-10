"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Search,
  Shirt,
  SlidersHorizontal,
  ShoppingBag,
  UserRound,
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
  getCatalogAvailability,
  stockFirst,
} from "@/lib/catalog-api";
import "./catalog.css";
import { useCart } from "@/lib/cart";
import type { CartItem } from "@/lib/checkout-api";
import { CheckoutDialog } from "./checkout";
import { CustomerProvider, useCustomer } from "@/lib/customer-session";
import { CustomerAccountDialog } from "./customer-account";

const EMPTY_PAGE: CatalogPage = { data: [], total: 0, page: 1, pages: 0 };
const INITIAL_QUERY: CatalogQuery = {
  search: "",
  category: "",
  storeId: "",
  sort: "newest",
  page: 1,
};

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
  const account = useCustomer();
  return {
    ids: account.favorites,
    raw: JSON.stringify(account.favorites),
    toggle: account.toggleFavorite,
  };
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
  canSave,
  savingDisabled,
  onOpen,
  onSave,
}: Readonly<{
  product: CatalogProduct;
  saved: boolean;
  canSave: boolean;
  savingDisabled: boolean;
  onOpen: () => void;
  onSave: () => void;
}>) {
  const sizes = product.variants.length
    ? [...new Set(product.variants.map((variant) => variant.size))]
    : (product.declaredSizes ?? []);
  const colors = product.variants.length
    ? [...new Set(product.variants.map((variant) => variant.color))]
    : (product.declaredColors ?? []).map((color) => color.name);
  const availability = getCatalogAvailability(product);
  const stockStatus = {
    available: "Con stock",
    "sold-out": "Agotado",
    unconfirmed: "Stock por confirmar",
  }[availability];
  return (
    <article className="product-card" data-availability={availability}>
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
        {availability !== "available" && (
          <span className="product-stock-badge">{stockStatus}</span>
        )}
        <button
          className="product-save"
          onClick={onSave}
          disabled={savingDisabled}
          aria-label={
            saved
              ? `Quitar ${product.name} de guardados`
              : `Guardar ${product.name}`
          }
          title={
            !canSave
              ? "Inicia sesión para guardar prendas"
              : "Guardar o quitar de favoritos"
          }
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
        <span>{stockStatus}</span>
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

function isOutsideDialog(element: HTMLDialogElement, event: MouseEvent) {
  if (event.target !== element) return false;
  const bounds = element.getBoundingClientRect();
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  );
}

function getPurchaseBlockReason(
  product: CatalogProduct | null,
  variant: CatalogProduct["variants"][number] | undefined,
  quantity: number,
) {
  if (
    product &&
    (product.stockKnown === false || product.variants.length === 0)
  )
    return "Esta prenda todavía no tiene stock confirmado. La tienda debe registrar sus tallas, colores y existencias antes de que puedas agregarla al carrito.";
  if (product && !variant)
    return "Selecciona una talla y un color en el campo de arriba para habilitar el carrito.";
  if (variant && variant.availableStock <= 0)
    return "Esta combinación de talla y color está agotada.";
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    return "Ingresa una cantidad entera mayor que cero.";
  if (variant && quantity > variant.availableStock)
    return `Solo hay ${variant.availableStock} unidades disponibles para esta talla y color.`;
  return "";
}

function ProductDetail({
  id,
  saved,
  canSave,
  savingDisabled,
  onSave,
  onClose,
  onAdd,
}: Readonly<{
  id: string;
  saved: boolean;
  canSave: boolean;
  savingDisabled: boolean;
  onSave: () => void;
  onClose: () => void;
  onAdd: (item: CartItem) => Promise<void>;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPressed = useRef(false);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [variantId, setVariantId] = useState("");
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseError, setPurchaseError] = useState("");
  const [adding, setAdding] = useState(false);
  const closeFromBackdrop = useEffectEvent(onClose);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const controller = new AbortController();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    const pointerDown = (event: PointerEvent) => {
      backdropPressed.current = isOutsideDialog(element, event);
    };
    const click = (event: MouseEvent) => {
      if (backdropPressed.current && isOutsideDialog(element, event))
        closeFromBackdrop();
      backdropPressed.current = false;
    };
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("click", click);
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
      element.removeEventListener("pointerdown", pointerDown);
      element.removeEventListener("click", click);
      document.body.style.overflow = previousOverflow;
    };
  }, [id]);
  const variant = product?.variants.find((item) => item.id === variantId);
  const favoriteLabel = saved ? "Quitar de guardados" : "Guardar prenda";
  const variantStock = variant
    ? `${variant.availableStock} unidades disponibles`
    : "Selecciona talla y color para consultar el stock.";
  const purchaseBlockReason = getPurchaseBlockReason(
    product,
    variant,
    quantity,
  );
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
                    onChange={(event) => {
                      setVariantId(event.target.value);
                      setQuantity(1);
                      setPurchaseMessage("");
                      setPurchaseError("");
                    }}
                  >
                    <option value="">Selecciona una variante</option>
                    {product.variants.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={item.availableStock <= 0}
                      >
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
            <div className="detail-purchase">
              <label className="field">
                <span>Cantidad</span>
                <input
                  type="number"
                  aria-label="Cantidad a agregar"
                  min={1}
                  max={variant?.availableStock ?? 1}
                  step={1}
                  value={quantity || ""}
                  disabled={!variant || product.stockKnown === false}
                  onChange={(event) => {
                    setQuantity(Number(event.target.value));
                    setPurchaseMessage("");
                  }}
                />
              </label>
              <button
                type="button"
                className="primary-button"
                disabled={adding || Boolean(purchaseBlockReason)}
                title={
                  purchaseBlockReason ||
                  "Agregar la variante seleccionada al carrito"
                }
                aria-describedby={
                  purchaseBlockReason ? "purchase-availability" : undefined
                }
                onClick={async () => {
                  if (!variant) return;
                  setAdding(true);
                  try {
                    await onAdd({
                      productId: product.id,
                      variantId: variant.id,
                      name: product.name,
                      storeName: product.store.displayName,
                      imageUrl: product.imageUrl,
                      size: variant.size,
                      color: variant.color,
                      unitPriceInCents: product.unitPriceInCents,
                      availableStock: variant.availableStock,
                      quantity,
                    });
                    setPurchaseMessage("Agregado al carrito.");
                    setPurchaseError("");
                  } catch (error_) {
                    setPurchaseError(
                      error_ instanceof Error
                        ? error_.message
                        : "No se pudo actualizar el carrito.",
                    );
                  } finally {
                    setAdding(false);
                  }
                }}
              >
                <ShoppingBag size={18} />
                {adding ? "Agregando..." : "Agregar al carrito"}
              </button>
              {purchaseBlockReason && (
                <output id="purchase-availability" className="product-options">
                  {purchaseBlockReason}
                </output>
              )}
              {purchaseMessage && <output>{purchaseMessage}</output>}
              {purchaseError && <p role="alert">{purchaseError}</p>}
            </div>
            <button
              className="save-detail"
              onClick={onSave}
              disabled={savingDisabled}
              title={
                canSave
                  ? "Guardar o quitar de favoritos"
                  : "Inicia sesión para guardar prendas"
              }
              aria-pressed={saved}
            >
              <Heart size={18} fill={saved ? "currentColor" : "none"} />
              {canSave ? favoriteLabel : "Inicia sesión para guardar prendas"}
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
  return (
    <CustomerProvider>
      <SessionCatalog />
      <CustomerAccountDialog />
    </CustomerProvider>
  );
}

function SessionCatalog() {
  const account = useCustomer();
  return <CatalogContent key={account.session?.user.id ?? "visitor"} />;
}

function CatalogContent() {
  const account = useCustomer();
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
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
          const data = products
            .filter((product): product is CatalogProduct => product !== null)
            .sort(stockFirst);
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
  async function save(id: string) {
    if (!account.session || account.session.user.mustChangePassword) {
      openDetail(null);
      account.open("login");
      return;
    }
    try {
      await toggle(id);
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : "No se pudo guardar la prenda.",
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
          {account.session && !account.session.user.mustChangePassword && (
            <button
              aria-current={view === "saved" ? "page" : undefined}
              onClick={() => {
                if (!account.session) account.open("login");
                else changeView("saved");
              }}
            >
              <Heart size={17} />
              Guardados
              {savedIds.length > 0 && (
                <span className="saved-count">{savedIds.length}</span>
              )}
            </button>
          )}
        </nav>
        <button
          type="button"
          className="secondary-button catalog-cart-button"
          disabled={account.loading}
          onClick={() => {
            if (!account.session || account.session.user.mustChangePassword)
              account.open("login");
            else setCartOpen(true);
          }}
        >
          <ShoppingBag size={18} />
          Carrito{" "}
          <span>
            {cart.items.reduce((total, item) => total + item.quantity, 0)}
          </span>
        </button>
        <button
          type="button"
          className="secondary-button catalog-account-button"
          disabled={account.loading}
          onClick={() => account.open(account.session ? "profile" : "login")}
          title={account.profile?.fullName ?? "Acceder a Gami"}
        >
          <UserRound size={18} />
          <span>{account.session ? "Mi espacio" : "Acceder"}</span>
        </button>
      </header>
      {account.error && (
        <p className="catalog-account-status" role="alert">
          {account.error}
          <button
            type="button"
            className="text-button"
            onClick={() => account.open("profile")}
          >
            Revisar mi cuenta
          </button>
        </p>
      )}

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
                        canSave={
                          !!account.session &&
                          !account.session.user.mustChangePassword &&
                          !account.loading &&
                          !account.busy
                        }
                        savingDisabled={account.loading || account.busy}
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
      </footer>
      {selectedId && (
        <ProductDetail
          key={selectedId}
          id={selectedId}
          saved={savedIds.includes(selectedId)}
          canSave={
            !!account.session &&
            !account.session.user.mustChangePassword &&
            !account.loading &&
            !account.busy
          }
          savingDisabled={account.loading || account.busy}
          onSave={() => save(selectedId)}
          onClose={() => openDetail(null)}
          onAdd={async (item) => {
            if (!account.session || account.session.user.mustChangePassword) {
              openDetail(null);
              account.open("login");
              throw new Error("Inicia sesión con tu cuenta de cliente.");
            }
            await cart.add(item);
          }}
        />
      )}
      {cartOpen &&
        account.session &&
        !account.session.user.mustChangePassword && (
          <CheckoutDialog onClose={() => setCartOpen(false)} />
        )}
    </div>
  );
}
