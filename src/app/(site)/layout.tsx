import type { ReactNode } from "react";
import { Archivo, Source_Serif_4 } from "next/font/google";
import "./landing.css";

const sans = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans" });
const serif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-serif" });

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <div className={`kb ${sans.variable} ${serif.variable}`}>{children}</div>;
}
