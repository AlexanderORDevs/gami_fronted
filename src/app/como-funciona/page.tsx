import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import "./como-funciona.css";

export const metadata: Metadata = {
  title: "Cómo funciona Gami | Moda de Gamarra",
  description:
    "Conoce cómo funcionan las órdenes, el pago, la confirmación de prendas, los envíos y la atención en Gami.",
};

const steps = [
  {
    title: "Elige tus prendas",
    description:
      "Revisa tallas, colores y disponibilidad. Las prendas con stock por confirmar no se pueden añadir al pedido.",
  },
  {
    title: "Revisa destino y monto",
    description:
      "El costo de envío se calcula con la tarifa vigente para tu zona, distrito y cantidad. Si no hay tarifa, no se crea la orden.",
  },
  {
    title: "La orden queda pendiente de pago",
    description:
      "Al confirmar se registra una orden pendiente. Gami todavía no verifica ni captura pagos automáticamente; pendiente no significa pagado.",
  },
  {
    title: "La tienda confirma las prendas",
    description:
      "Después de verificarse el pago, la tienda confirma las cantidades. Si falta stock, se registra una incidencia y verás el detalle en Mi espacio, en Órdenes.",
  },
  {
    title: "Consolidación y entrega",
    description:
      "La integración de consolidación, transportista, seguimiento y plazo de entrega aún no está habilitada. No se asigna una fecha de entrega garantizada.",
  },
  {
    title: "Atención",
    description:
      "Las incidencias quedan registradas para revisión. El canal oficial de soporte y reclamos está pendiente de configuración.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="customer-journey">
      <header className="customer-journey-header">
        <Link
          href="/"
          aria-label="Volver al catálogo de Gami"
          className="customer-journey-brand"
        >
          gami<span>.</span>
        </Link>
        <Link href="/" className="customer-journey-back">
          <ArrowLeft size={16} />
          Volver al catálogo
        </Link>
      </header>

      <div className="customer-journey-content">
        <section className="customer-journey-intro">
          <p className="eyebrow">Compra con información clara</p>
          <h1>Cómo funciona Gami</h1>
          <p>
            Conoce qué ocurre desde que eliges una prenda hasta la entrega y qué
            pasos todavía no están disponibles.
          </p>
        </section>

        <ol className="customer-journey-steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="customer-journey-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>

        <nav className="customer-journey-actions" aria-label="Siguientes pasos">
          <Link className="customer-journey-shop" href="/">
            Explorar prendas <ArrowRight size={17} />
          </Link>
          <Link
            className="customer-journey-information"
            href="/informacion#envios"
          >
            Envíos, cambios y atención
          </Link>
        </nav>
      </div>
    </main>
  );
}
