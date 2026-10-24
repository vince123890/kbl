import type { ReactNode } from "react";
import "./landing.css";
import "./landing-beranda.css";
import "./landing-modern.css";

// Font (Fraunces + Manrope) dimuat di app/layout.tsx dan dibagi dengan aplikasi.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <div className="kb">{children}</div>;
}
