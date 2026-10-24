import type { ReactNode } from "react";
import { Barlow_Condensed, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./landing.css";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <div className={`kb ${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}
