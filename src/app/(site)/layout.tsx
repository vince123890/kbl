import type { ReactNode } from "react";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./landing.css";

// Font situs profil (tema industrial slate): Fira Sans untuk isi dan judul, Fira Code untuk label teknis.
const sans = Fira_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-fira-sans" });
const mono = Fira_Code({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fira-code" });

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <div className={`kb ${sans.variable} ${mono.variable}`}>{children}</div>;
}
