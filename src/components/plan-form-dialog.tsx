"use client";

import { useState } from "react";
import { FormDialog } from "@/components/master-form-dialog";
import { TextField } from "@/components/form";
import { savePlanAction } from "@/app/(app)/maintenance/actions";

export interface PlanFormPlan {
  id: string;
  task_name: string;
  interval_days: number | null;
  interval_km: number | null;
  last_done_at: string | null;
  last_done_km: string | number | null;
  vendor_id: string | null;
  lead_days: number | null;
  lead_km: number | null;
  notes: string | null;
  parts: { sparepart_id: string; qty: string }[];
}

interface Opt {
  id: string;
  label: string;
}

const sel = "tap w-full rounded-lg border border-border bg-surface px-3 text-sm";

function Parts({ spareparts, initial }: { spareparts: Opt[]; initial: { sparepart_id: string; qty: string }[] }) {
  const [rows, setRows] = useState(initial);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Sparepart standar (opsional)</legend>
      <input type="hidden" name="parts" value={JSON.stringify(rows)} />
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <select
            aria-label="Sparepart"
            value={r.sparepart_id}
            onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, sparepart_id: e.target.value } : y)))}
            className={sel}
          >
            <option value="">— pilih —</option>
            {spareparts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Qty"
            inputMode="decimal"
            value={r.qty}
            onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))}
            className="tap w-20 rounded-lg border border-border bg-surface px-2 text-sm"
          />
          <button type="button" aria-label="Hapus" className="tap rounded-lg border border-border px-3" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="tap rounded-lg border border-border px-3 text-sm" onClick={() => setRows((x) => [...x, { sparepart_id: "", qty: "1" }])}>
        + Tambah part
      </button>
    </fieldset>
  );
}

export function PlanFormDialog({
  plan,
  vehicles,
  spareparts,
  vendors,
  compact,
}: {
  plan?: PlanFormPlan;
  vehicles: Opt[];
  spareparts: Opt[];
  vendors: Opt[];
  compact?: boolean;
}) {
  const editing = !!plan;
  return (
    <FormDialog
      trigger={editing ? "Ubah" : "+ Rencana Baru"}
      title={editing ? "Ubah rencana perawatan" : "Rencana perawatan baru"}
      action={savePlanAction.bind(null, plan?.id ?? null)}
      triggerClassName={
        compact
          ? "tap rounded-lg border border-border px-3 text-sm hover:bg-background"
          : "tap rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-strong"
      }
    >
      {(state) => {
        const fe = state && !state.ok ? state.fieldErrors : undefined;
        return (
          <>
            {!editing && (
              <fieldset>
                <legend className="mb-1 text-sm font-medium">
                  Kendaraan<span className="text-danger"> *</span>
                </legend>
                <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
                  {vehicles.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="vehicle_ids" value={v.id} />
                      {v.label}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">Pilih lebih dari satu untuk membuat rencana yang sama pada banyak kendaraan.</p>
                {fe?.vehicle_ids && <span className="text-xs text-danger">{fe.vehicle_ids}</span>}
              </fieldset>
            )}
            <TextField name="task_name" label="Nama tugas" required defaultValue={plan?.task_name} error={fe?.task_name} placeholder="Mis. Ganti oli mesin" />
            <div className="grid grid-cols-2 gap-3">
              <TextField name="interval_days" label="Interval (hari)" defaultValue={plan?.interval_days} error={fe?.interval_days} help="Isi hari dan/atau km" />
              <TextField name="interval_km" label="Interval (km)" defaultValue={plan?.interval_km} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField name="last_done_at" label="Terakhir dilakukan (tanggal)" type="date" defaultValue={plan?.last_done_at} />
              <TextField name="last_done_km" label="Terakhir dilakukan (km)" defaultValue={plan?.last_done_km} />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Bengkel default</span>
              <select name="vendor_id" defaultValue={plan?.vendor_id ?? ""} className={sel}>
                <option value="">— tidak ada —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <TextField name="lead_days" label="Lead time (hari)" defaultValue={plan?.lead_days} help="Kosong = parameter sistem" />
              <TextField name="lead_km" label="Lead time (km)" defaultValue={plan?.lead_km} help="Kosong = parameter sistem" />
            </div>
            <Parts spareparts={spareparts} initial={plan?.parts ?? []} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Catatan</span>
              <textarea name="notes" rows={2} defaultValue={plan?.notes ?? ""} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            </label>
          </>
        );
      }}
    </FormDialog>
  );
}
