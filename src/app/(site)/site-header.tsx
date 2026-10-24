"use client";

import { useState } from "react";
import Link from "next/link";

export interface HeaderContact {
  whatsapp?: string;
  email?: string;
  phone?: string;
}

const MODULES = [
  { href: "#modul-stok", label: "Mutasi sparepart & kartu stok" },
  { href: "#modul-opname", label: "Stock opname" },
  { href: "#modul-jadwal", label: "Jadwal perawatan" },
  { href: "#modul-anomali", label: "Perubahan jadwal & alasan" },
  { href: "#modul-approval", label: "Approval berjenjang" },
  { href: "#modul-darurat", label: "Darurat di jalan" },
];

const LINKS = [
  { href: "#cerita", label: "Cerita" },
  { href: "#peran", label: "Peran" },
  { href: "#peta-jalan", label: "Peta jalan" },
  { href: "#faq", label: "FAQ" },
  { href: "#kontak", label: "Kontak" },
];

export function SiteHeader({ contact }: { contact: HeaderContact }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <div className="kb-topbar-strip">
        <div className="kb-wrap kb-strip-row">
          <span className="kb-strip-tag">Armada terawat, perjalanan terjaga</span>
          <div className="kb-strip-links">
            {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>}
            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
            {contact.whatsapp && (
              <a className="kb-strip-wa" href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            )}
            <Link href="/login">Masuk</Link>
          </div>
        </div>
      </div>

      <header className="kb-header">
        <div className="kb-wrap kb-header-row">
          <Link href="/" className="kb-brand" aria-label="KBL, beranda" onClick={close}>
            <span className="kb-brand-mark">
              <span>KBL</span>
              <i />
            </span>
            <small>Perawatan & Sparepart Armada</small>
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
            <a href="#beranda" onClick={close}>
              Beranda
            </a>
            <div className="kb-dd">
              <a href="#modul" onClick={close}>
                Modul <span aria-hidden="true">▾</span>
              </a>
              <ul className="kb-dd-menu">
                {MODULES.map((m) => (
                  <li key={m.href}>
                    <a href={m.href} onClick={close}>
                      {m.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={close}>
                {l.label}
              </a>
            ))}
            <Link className="kb-btn kb-btn-marka" href="/login" onClick={close}>
              Masuk ke aplikasi
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
