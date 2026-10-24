"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addIncidentDetailAction } from "@/app/(app)/emergency/actions";

/** Langkah 2 setelah laporan terkirim: keterangan dan jumlah korban (opsional). */
export function IncidentDetailForm({ id }: { id: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [cas, setCas] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const n = cas.trim() === "" ? null : Number(cas);
        if (n !== null && (!Number.isInteger(n) || n < 0)) return setMsg({ ok: false, text: "Jumlah korban harus bilangan bulat ≥ 0" });
        start(async () => {
          const r = await addIncidentDetailAction(id, text.trim(), n);
          setMsg({ ok: r.ok, text: r.ok ? "Keterangan terkirim ke pusat" : r.error });
          if (r.ok) {
            setText("");
            setCas("");
            router.refresh();
          }
        });
      }}
    >
      <label className="block">
        <span className="mb-1 block font-medium">Keterangan tambahan</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-surface px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Jumlah korban (bila ada)</span>
        <input value={cas} onChange={(e) => setCas(e.target.value)} inputMode="numeric" className="tap w-32 rounded-lg border border-border bg-surface px-3" />
      </label>
      <button disabled={pending} className="tap rounded-lg bg-brand px-4 font-medium text-on-brand disabled:opacity-60">
        {pending ? "Mengirim…" : "Kirim keterangan"}
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-muted" : "text-danger"}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
