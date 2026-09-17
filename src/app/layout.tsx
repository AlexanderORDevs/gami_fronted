import type { Metadata } from "next";
import { DM_Serif_Display, Geist } from "next/font/google";
import "./globals.css";

const bodyFont = Geist({ subsets: ["latin"], variable: "--font-body" });
const displayFont = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Gami | Moda de Gamarra",
  description:
    "Descubre prendas, marcas locales y disponibilidad por talla y color en Gami.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-PE"
      className={`${bodyFont.variable} ${displayFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
