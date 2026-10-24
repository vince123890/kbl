import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

// Judul: Fraunces (serif modern). Isi dan antarmuka: Manrope. Dipakai di situs profil dan aplikasi.
const display = Fraunces({ subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Karunia Beton Lestari — Perawatan & Sparepart", template: "%s · Karunia Beton Lestari" },
  description: "Manajemen perawatan, sparepart, dan emergensi kendaraan",
  applicationName: "Karunia Beton Lestari",
  appleWebApp: { capable: true, title: "Karunia Beton", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#141010",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
