"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FLOW_METRICS, FLOW_OPS, type FlowStepInput } from "@/lib/flow-config";
import { saveFlowAction } from "@/app/(app)/admin/approval-flows/actions";

const blank = (role: string): FlowStepInput => ({ role, sla_hours: 24, metric: "", op: ">", value: "" });

export function FlowEditor({
  docType,
  name,
  roles,
  initial,
}: {
  docType: string;
  name: string;
  roles: string[];
  initial: FlowStepInput[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [steps, setSteps] = useState<FlowStepInput[]>(initial);
  const [flowName, setFlowName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const metrics = FLOW_METRICS[docType] ?? [];

  const patch = (i: number, p: Partial<FlowStepInput>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveFlowAction(docType, flowName, steps);
      if (!r.ok) return setError(r.error);
      ref.current?.close();
      router.refresh();
    });

  const field = "tap rounded-lg border border-border bg-surface px-2 text-sm";
  return (
    <>
      <button
        type="button"
        className="tap rounded-lg border border-border px-4 text-sm hover:bg-brand-soft"
        onClick={() => {
          setSteps(initial);
          setFlowName(name);
          setError(null);
          ref.current?.showModal();
        }}
      >
        Ubah alur
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(46rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/45"
      >
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-semibold">Ubah alur: {name}</h2>
            <button type="button" aria-label="Tutup" className="tap px-2 text-xl" onClick={() => ref.current?.close()}>
              ×
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm">
            <p className="rounded-lg bg-warn-soft px-3 py-2">
              Perubahan hanya berlaku untuk dokumen <b>baru</b>. Dokumen yang sedang berjalan tetap memakai alur saat diajukan. Tanpa level sama
              dengan otomatis disetujui.
            </p>
            <label className="block">
              <span className="mb-1 block font-medium">Nama alur</span>
              <input value={flowName} onChange={(e) => setFlowName(e.target.value)} className={`${field} w-full`} />
            </label>
            {steps.map((s, i) => (
              <fieldset key={i} className="space-y-2 rounded-xl border border-border p-3">
                <legend className="px-1 font-medium">Level {i + 1}</legend>
                <div className="flex flex-wrap items-end gap-3">
                  <label>
                    <span className="mb-1 block text-xs text-muted">Role approver</span>
                    <select value={s.role} onChange={(e) => patch(i, { role: e.target.value })} className={field}>
                      {roles.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-muted">SLA (jam)</span>
                    <input
                      type="number"
                      min={1}
                      value={s.sla_hours}
                      onChange={(e) => patch(i, { sla_hours: Number(e.target.value) })}
                      className={`${field} w-24`}
                    />
                  </label>
                  <button type="button" className="tap rounded-lg border border-danger/40 px-3 text-danger" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}>
                    Hapus level
                  </button>
                </div>
                {metrics.length > 0 && (
                  <div className="flex flex-wrap items-end gap-2">
                    <label>
                      <span className="mb-1 block text-xs text-muted">Berlaku bila (kosong = selalu)</span>
                      <select value={s.metric} onChange={(e) => patch(i, { metric: e.target.value })} className={field}>
                        <option value="">Selalu berlaku</option>
                        {metrics.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {s.metric && (
                      <>
                        <select aria-label="Operator" value={s.op} onChange={(e) => patch(i, { op: e.target.value })} className={field}>
                          {FLOW_OPS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                        <input
                          aria-label="Nilai"
                          inputMode="decimal"
                          value={s.value}
                          onChange={(e) => patch(i, { value: e.target.value })}
                          className={`${field} w-28`}
                        />
                      </>
                    )}
                  </div>
                )}
              </fieldset>
            ))}
            <button type="button" className="tap rounded-lg border border-border px-4" onClick={() => setSteps((s) => [...s, blank(roles[0])])}>
              + Tambah level
            </button>
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-danger">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button type="button" className="tap rounded-lg border border-border px-4 text-sm" onClick={() => ref.current?.close()}>
              Batal
            </button>
            <button type="button" disabled={pending} onClick={save} className="tap rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-strong disabled:opacity-60">
              {pending ? "Menyimpan…" : "Simpan versi baru"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
