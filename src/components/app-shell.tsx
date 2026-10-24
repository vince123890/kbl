"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { InstallButton } from "@/components/install-button";

export interface NavGroup {
  title: string;
  items: { href: string; label: string }[];
}

export function AppShell({
  nav,
  user,
  children,
}: {
  nav: NavGroup[];
  user: { name: string; branchName: string; roles: string[] };
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
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`tap flex items-center rounded-lg px-2 ${
                      active ? "bg-brand-soft font-medium text-brand-strong" : "hover:bg-background"
                    }`}
                  >
                    {item.label}
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
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:block">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-extrabold text-white">KBL</span>
          <span className="font-semibold">Perawatan & Sparepart</span>
        </div>
        {navigation}
      </aside>

      {/* drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/45" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface shadow-xl">{navigation}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
          <button
            className="tap -ml-2 flex w-11 items-center justify-center rounded-lg hover:bg-background md:hidden"
            aria-label="Buka menu"
            onClick={() => setOpen(true)}
          >
            <span aria-hidden className="text-xl">☰</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">
              {user.branchName} · {user.roles.join(", ") || "tanpa role"}
            </p>
          </div>
          <InstallButton />
          <Link href="/profile" className="tap hidden items-center rounded-lg px-3 text-sm hover:bg-background sm:flex">
            Profil
          </Link>
          <form action={logoutAction}>
            <button className="tap rounded-lg border border-border px-3 text-sm hover:bg-background">Keluar</button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
