import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

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
    <html lang="id" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
