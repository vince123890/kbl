import type { ReactNode } from "react";
import { InstallButton } from "@/components/install-button";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Karunia Beton Lestari</h1>
        <p className="mt-1 text-sm text-muted">Perawatan & Sparepart Kendaraan</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">{children}</div>
      <InstallButton className="text-center" />
    </main>
  );
}
