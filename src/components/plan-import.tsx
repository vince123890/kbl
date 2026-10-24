"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/form";
import { importPlansAction } from "@/app/(app)/maintenance/actions";

export function PlanImport() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(importPlansAction, null);
  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  return (
    <details className="mb-4 rounded-xl border border-border bg-surface p-3 text-sm print:hidden">
      <summary className="cursor-pointer font-medium">Impor rencana dari CSV (onboarding armada)</summary>
      <form ref={form} action={action} className="mt-3 flex flex-wrap items-center gap-2">
        {/* berkas unduhan, bukan halaman */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/maintenance/plans/template" className="tap inline-flex items-center rounded-lg border border-border px-4 hover:bg-brand-soft">
          Unduh template
        </a>
        <input type="file" name="file" accept=".csv,text/csv" className="max-w-full file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2" />
        <button disabled={pending} className="tap rounded-lg border border-border px-4 hover:bg-brand-soft disabled:opacity-60">
          {pending ? "Memproses…" : "Impor"}
        </button>
        {state && <Alert result={state} />}
      </form>
      <p className="mt-2 text-xs text-muted">Kolom: nopol; tugas; interval_hari; interval_km; terakhir_tanggal (yyyy-mm-dd); terakhir_km. Semua baris divalidasi dulu; bila ada galat tidak ada yang disimpan.</p>
    </details>
  );
}
