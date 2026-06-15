import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrecalificateRD — Tu Precalificación Hipotecaria en Minutos",
  description: "Simulador hipotecario de Perfect House SRL.",
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
