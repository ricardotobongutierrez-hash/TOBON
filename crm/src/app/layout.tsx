import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CRM · José I. Tobón",
    template: "%s · CRM José I. Tobón",
  },
  description: "Sistema comercial interno de José I. Tobón, Expertos en Negociación. Contactos, negocios, propuestas, cobros y seguimiento en un solo lugar.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050834",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: "7px",
              border: "1px solid #e8e8ea",
              fontSize: "14px",
              color: "#050834",
            },
          }}
        />
      </body>
    </html>
  );
}
