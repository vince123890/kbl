import type { ReactNode } from "react";
import { InstallButton } from "@/components/install-button";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-lg font-extrabold text-white">
          KBL
        </div>
        <h1 className="text-xl font-semibold">Perawatan & Sparepart Kendaraan</h1>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">{children}</div>
      <InstallButton className="text-center" />
    </main>
  );
}
