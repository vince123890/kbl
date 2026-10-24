"use client";

import { useState } from "react";
import Link from "next/link";

const LINKS = [
  { href: "#cerita", label: "Cerita" },
  { href: "#layanan", label: "Layanan" },
  { href: "#kontak", label: "Kontak" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="kb-header">
      <div className="kb-wrap kb-header-row">
        <Link href="/" className="kb-logo" aria-label="PT Karunia Beton Lestari, beranda" onClick={close}>
          <span className="kb-mark" aria-hidden="true">
            KBL
          </span>
          <span className="kb-logo-name">
            Karunia Beton Lestari
            <small>Stone &amp; Readymix</small>
          </span>
        </Link>

        <button
          type="button"
          className="kb-burger"
          aria-expanded={open}
          aria-controls="kb-nav"
          aria-label={open ? "Tutup menu" : "Buka menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" />
        </button>

        <nav id="kb-nav" className={`kb-nav ${open ? "is-open" : ""}`} aria-label="Navigasi utama">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={close}>
              {l.label}
            </a>
          ))}
          <Link className="kb-login" href="/login" onClick={close}>
            Masuk Aplikasi
          </Link>
        </nav>
      </div>
    </header>
  );
}
