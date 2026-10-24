"use client";

import { useState } from "react";
import Link from "next/link";

export interface HeaderContact {
  waHref: string;
  mobileLabel: string;
  phoneLabel: string;
  phoneTel: string;
}

const PRODUK = [
  { href: "#produk", label: "Batu pecah dan agregat" },
  { href: "#produk", label: "Beton readymix" },
  { href: "#produk", label: "Concrete pump" },
];

const LINKS = [
  { href: "#beranda", label: "Beranda" },
  { href: "#tentang", label: "Tentang" },
];
const LINKS_AFTER = [
  { href: "#alur", label: "Alur pesanan" },
  { href: "#armada", label: "Armada" },
  { href: "#kontak", label: "Hubungi" },
];

export function SiteHeader({ contact }: { contact: HeaderContact }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <div className="kb-util">
        <div className="kb-wrap kb-util-row">
          <span className="kb-util-place">Sunggal, Deli Serdang, Sumatera Utara</span>
          <div className="kb-util-links">
            <a href={`tel:${contact.phoneTel}`}>{contact.phoneLabel}</a>
            <a className="kb-util-wa" href={contact.waHref} target="_blank" rel="noopener noreferrer">
              WhatsApp {contact.mobileLabel}
            </a>
            <Link href="/login">Masuk Aplikasi</Link>
          </div>
        </div>
      </div>

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
            <div className="kb-dd">
              <a href="#produk" onClick={close}>
                Produk <span aria-hidden="true">▾</span>
              </a>
              <ul className="kb-dd-menu">
                {PRODUK.map((p) => (
                  <li key={p.label}>
                    <a href={p.href} onClick={close}>
                      {p.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {LINKS_AFTER.map((l) => (
              <a key={l.href} href={l.href} onClick={close}>
                {l.label}
              </a>
            ))}
            <a className="kb-cta-nav" href={contact.waHref} target="_blank" rel="noopener noreferrer" onClick={close}>
              Konsultasi Kebutuhan Beton
            </a>
          </nav>
        </div>
      </header>
    </>
  );
}
