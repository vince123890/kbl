"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/form";
import type { ActionResult } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";

interface Credential {
  email: string;
  name: string;
  password: string;
}

type ImportResult = ActionResult;

/** Impor massal dari CSV: unduh template, unggah, lihat ringkasan. Untuk impor user, kredensial sementara tampil sekali. */
export function CsvImport({
  action,
  templateHref,
  title,
  columns,
}: {
  action: (prev: ImportResult | null, fd: FormData) => Promise<ImportResult>;
  templateHref: string;
  title: string;
  columns: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const created = (state?.ok ? (state.data as { created?: Credential[] } | undefined)?.created : undefined) ?? [];
  const download = () => {
    const csv = toCsv(
      ["nama", "email", "password sementara"],
      created.map((c) => [c.name, c.email, c.password]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kredensial-user-baru.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="mb-4 rounded-xl border border-border bg-surface p-3 text-sm">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <form ref={form} action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        {/* berkas unduhan, bukan halaman */}
        <a href={templateHref} className="tap inline-flex items-center rounded-lg border border-border px-4 hover:bg-brand-soft">
          Unduh template
        </a>
        <input type="file" name="file" accept=".csv,text/csv" className="max-w-full file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2" />
        <button disabled={pending} className="tap rounded-lg border border-border px-4 hover:bg-brand-soft disabled:opacity-60">
          {pending ? "Memproses…" : "Impor"}
        </button>
      </form>
      {state && (
        <div className="mt-2">
          <Alert result={state} />
        </div>
      )}
      {created.length > 0 && (
        <div className="mt-3 rounded-lg border border-brand bg-brand-soft p-3">
          <p className="font-medium">Password sementara (hanya ditampilkan sekali; wajib diganti saat login pertama)</p>
          <ul className="mt-2 space-y-1">
            {created.map((c) => (
              <li key={c.email}>
                {c.email} · <code className="rounded bg-surface px-1.5 py-0.5">{c.password}</code>
              </li>
            ))}
          </ul>
          <button type="button" onClick={download} className="tap mt-2 rounded-lg border border-brand px-4">
            Unduh CSV kredensial
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Kolom: {columns}. Semua baris divalidasi dulu; bila ada galat tidak ada data yang disimpan.</p>
    </details>
  );
}
