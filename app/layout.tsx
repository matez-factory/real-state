import type { Metadata } from "next";
import { ViewTransitions } from "next-view-transitions";
import { RotateDeviceOverlay } from "@/components/shared/RotateDeviceOverlay";
import { ServiceWorkerRegistrar } from "@/components/shared/ServiceWorkerRegistrar";
import "./globals.css";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';

export const metadata: Metadata = {
  title: "Explorador Inmobiliario",
  description: "Explora proyectos inmobiliarios: loteos, edificios y más",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="es">
        <head>
          {supabaseOrigin && (
            <>
              <link rel="preconnect" href={supabaseOrigin} />
              <link rel="dns-prefetch" href={supabaseOrigin} />
            </>
          )}
        </head>
        <body className="antialiased bg-black text-white font-sans">
          <a href="#main-content" className="skip-nav">
            Saltar al contenido principal
          </a>
          {children}
          <RotateDeviceOverlay />
          <ServiceWorkerRegistrar />
        </body>
      </html>
    </ViewTransitions>
  );
}
