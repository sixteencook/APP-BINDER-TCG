import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCG Binder",
  description: "Binder Pokémon TCG virtuel : placez vos cartes, suivez les prix Cardmarket, vos cartes recherchées et vos produits scellés.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TCG Binder", statusBarStyle: "black-translucent" },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0f1a" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
