import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://precalificaterd.com";
const TITLE = "PrecalificateRD | Tu primer paso hacia la vivienda propia";
const DESCRIPTION = "Evalúa tu perfil gratis, sin afectar tu historial crediticio y recibe orientación para tomar mejores decisiones.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "PrecalificateRD",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "PrecalificateRD" }],
    locale: "es_DO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
