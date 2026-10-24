import type { ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";
import "./landing.css";
import "./landing-beranda.css";
import "./landing-modern.css";

// Judul: Fraunces (serif modern, elegan). Isi dan UI: Manrope.
const display = Fraunces({ subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <div className={`kb ${display.variable} ${body.variable}`}>{children}</div>;
}
