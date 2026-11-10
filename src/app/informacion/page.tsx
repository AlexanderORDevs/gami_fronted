import type { Metadata } from "next";
import Link from "next/link";
import "./informacion.css";

export const metadata: Metadata = {
  title: "Información para clientes | Gami",
  description:
    "Información de compra, privacidad, envíos, cambios, reclamos y soporte de Gami.",
};

const sections = [
  { id: "terminos", label: "Términos" },
  { id: "privacidad", label: "Privacidad" },
  { id: "envios", label: "Envíos" },
  { id: "cambios", label: "Cambios" },
  { id: "reclamos", label: "Reclamos" },
  { id: "soporte", label: "Soporte" },
];

export default function InformationPage() {
  return (
    <main className="public-information">
      <header className="public-information-header">
        <Link
          href="/"
          aria-label="Volver al catálogo de Gami"
          className="public-information-brand"
        >
          gami.
        </Link>
        <Link href="/" className="public-information-back">
          Volver al catálogo
        </Link>
      </header>
      <section className="public-information-intro">
        <p className="eyebrow">Atención a clientes</p>
        <h1>Información para clientes</h1>
        <p>
          Consulta el funcionamiento actual de Gami y el estado de las políticas
          que aún están pendientes de aprobación.
        </p>
      </section>
      <nav
        className="public-information-nav"
        aria-label="Secciones de información"
      >
        {sections.map((section) => (
          <Link key={section.id} href={`#${section.id}`}>
            {section.label}
          </Link>
        ))}
      </nav>
      <div className="public-information-content">
        <section id="terminos" className="public-information-section">
          <h2>Términos de uso</h2>
          <p>
            Gami permite explorar productos de marcas participantes y crear una
            orden desde el catálogo cuando hay stock conocido y una tarifa de
            envío configurada. El precio y el costo de envío se calculan antes
            de registrar la orden.
          </p>
          <p>
            Una orden nueva queda pendiente de pago. Ese estado no confirma un
            pago ni garantiza la disponibilidad final de cada prenda. Los
            términos contractuales completos, la entidad responsable y los datos
            legales están pendientes de aprobación y publicación.
          </p>
          <p className="public-information-status">
            Documento legal completo pendiente.
          </p>
        </section>

        <section id="privacidad" className="public-information-section">
          <h2>Privacidad</h2>
          <p>
            Para las funciones de cuenta y compra, Gami puede registrar los
            datos que ingresas, como nombre, teléfono, correo, dirección de
            entrega, carrito, favoritos y órdenes. La información de cuenta se
            usa para identificar tu sesión y mostrar las funciones asociadas a
            ella.
          </p>
          <p>
            El aviso integral con la identidad del responsable, canales para
            ejercer derechos y plazos de conservación está pendiente de revisión
            legal. No compartas información sensible que no sea necesaria para
            tu compra.
          </p>
          <p className="public-information-status">
            Aviso integral de privacidad pendiente.
          </p>
        </section>

        <section id="envios" className="public-information-section">
          <h2>Envíos</h2>
          <p>
            El costo de envío depende de la zona, el distrito cuando corresponda
            y la cantidad de prendas. Se muestra en el resumen antes de crear la
            orden. Si no existe una tarifa vigente para el destino y la
            cantidad, el sistema no permite registrarla.
          </p>
          <p>
            El plazo de entrega, las condiciones por zona y el seguimiento se
            comunicarán cuando esas reglas estén configuradas. Una orden
            pendiente de pago no inicia el despacho.
          </p>
          <p className="public-information-status">
            Los plazos y coberturas están pendientes de publicación.
          </p>
        </section>

        <section id="cambios" className="public-information-section">
          <h2>Cambios y devoluciones</h2>
          <p>
            El procedimiento, los plazos, las condiciones y los costos de
            cambios o devoluciones todavía no están definidos en la plataforma.
            No se aceptará una solicitud como aprobada hasta que se publique la
            política correspondiente.
          </p>
          <p className="public-information-status">
            Política pendiente de aprobación.
          </p>
        </section>

        <section id="reclamos" className="public-information-section">
          <h2>Reclamos</h2>
          <p>
            El sitio aún no ofrece un formulario público ni un canal oficial de
            reclamos. La responsable, el canal de recepción y los plazos de
            respuesta deben ser confirmados antes de publicarse aquí.
          </p>
          <p className="public-information-status">
            Canal oficial pendiente de configuración.
          </p>
        </section>

        <section id="soporte" className="public-information-section">
          <h2>Soporte</h2>
          <p>
            El canal oficial de atención de Gami aún no está configurado. No se
            muestran números de tiendas como soporte general de la plataforma.
          </p>
          <p className="public-information-status">
            Contacto de soporte pendiente de confirmación.
          </p>
        </section>
      </div>
      <footer className="public-information-footer">
        <span>Gami · Información para clientes</span>
        <Link href="/">Volver al catálogo</Link>
      </footer>
    </main>
  );
}
