import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCG Binder Tracker",
  description: "Binder Pokémon TCG français avec estimation Cardmarket.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TCG Binder", statusBarStyle: "black-translucent" },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#111827" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}</body></html>; }
