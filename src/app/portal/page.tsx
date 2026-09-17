import type { Metadata } from "next";
import { AuthPortal } from "../auth-portal";

export const metadata: Metadata = {
  title: "Gami | Portal de tiendas y administración",
  robots: { index: false, follow: false },
};

export default function PortalPage() {
  return <AuthPortal />;
}
