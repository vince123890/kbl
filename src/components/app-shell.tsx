"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { InstallButton } from "@/components/install-button";

export interface NavGroup {
  title: string;
  items: { href: string; label: string; badge?: number }[];
}

export interface QuickItem {
  href: string;
  label: string;
  badge?: number;
  /** tampil menonjol (mis. Darurat) */
  urgent?: boolean;
}

export function AppShell({
  nav,
  quick = [],
  user,
  unread = 0,
  alertCount = 0,
  children,
}: {
  nav: NavGroup[];
  /** pintasan di bar bawah ponsel (maks 4); tombol Menu selalu ada */
  quick?: QuickItem[];
  user: { name: string; branchName: string; roles: string[] };
  unread?: number;
  /** insiden yang belum dikonfirmasi pusat (hanya untuk penangan insiden) */
  alertCount?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navigation = (
    <nav className="flex flex-col gap-5 p-4 text-sm" aria-label="Menu utama">
      {nav.map((group) => (
        <div key={group.title}>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.title}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`tap flex items-center rounded-lg px-2 ${
                      active ? "bg-brand-soft font-medium text-foreground" : "hover:bg-background"
                    }`}
                  >
                    <span className="flex-1">{item.label}</span>
                    {!!item.badge && (
                      <span className="ml-2 rounded-full bg-danger px-1.5 text-xs font-medium text-white" aria-label={`${item.badge} baru`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:block print:hidden">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="font-heading text-lg font-medium">Karunia Beton Lestari</span>
        </div>
        {navigation}
      </aside>

      {/* menu lengkap di ponsel: lembar dari bawah, berisi semua menu + akun */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/45" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted">
                  {user.branchName} · {user.roles.join(", ") || "tanpa role"}
                </p>
              </div>
              <button className="tap px-3 text-2xl" aria-label="Tutup menu" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <div className="overflow-y-auto">{navigation}</div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
              <Link href="/profile" onClick={() => setOpen(false)} className="tap flex flex-1 items-center justify-center rounded-lg border border-border px-3 text-sm">
                Profil
              </Link>
              <InstallButton />
              <form action={logoutAction} className="flex-1">
                <button className="tap w-full rounded-lg border border-danger/40 px-3 text-sm text-danger">Keluar</button>
              </form>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-3 md:px-4 print:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">
              {user.branchName} · {user.roles.join(", ") || "tanpa role"}
            </p>
          </div>
          <div className="hidden md:block">
            <InstallButton />
          </div>
          <Link
            href="/notifications"
            aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
            className="tap relative flex w-11 items-center justify-center rounded-lg hover:bg-background"
          >
            <span aria-hidden className="text-lg">🔔</span>
            {unread > 0 && (
              <span className="absolute right-1 top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>
            )}
          </Link>
          <Link href="/profile" className="tap hidden items-center rounded-lg px-3 text-sm hover:bg-background md:flex">
            Profil
          </Link>
          <form action={logoutAction} className="hidden md:block">
            <button className="tap rounded-lg border border-border px-3 text-sm hover:bg-background">Keluar</button>
          </form>
        </header>
        {alertCount > 0 && (
          <Link href="/emergency/incidents" role="alert" className="block bg-danger px-4 py-2 text-center text-sm font-semibold text-white print:hidden">
            🚨 {alertCount} insiden belum dikonfirmasi pusat. Ketuk untuk menangani.
          </Link>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 p-3 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* bar bawah ponsel: pintasan utama selalu terlihat */}
      <nav aria-label="Pintasan" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        {quick.map((q) => {
          const active = q.href === "/dashboard" ? pathname === q.href : pathname.startsWith(q.href);
          return (
            <Link
              key={q.href}
              href={q.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight ${
                q.urgent ? "font-semibold text-danger" : active ? "font-semibold text-foreground" : "text-muted"
              }`}
            >
              {active && <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-b bg-brand" />}
              {q.urgent && (
                <span aria-hidden className="text-lg leading-none">
                  🚨
                </span>
              )}
              <span className={`truncate ${q.urgent ? "" : "text-[13px]"}`}>{q.label}</span>
              {!!q.badge && <span className="absolute right-3 top-1 rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{q.badge}</span>}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] text-muted">
          <span className="text-[13px]">Menu ☰</span>
        </button>
      </nav>
    </div>
  );
}
