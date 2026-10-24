"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/form";
import { saveWoAction } from "@/app/(app)/maintenance/actions";

interface Opt {
  id: string;
  label: string;
}

export interface WoInitial {
  id?: string;
  version?: number;
  type: string;
  priority: string;
  vehicle_id: string;
  start: string;
  end: string;
  vendor_id: string;
  assignee_id: string;
  description: string;
  source_note: string;
  parts: { sparepart_id: string; qty: string; location_id: string }[];
  /** jadwal terkunci (WO Scheduled): diubah lewat Perubahan Jadwal */
  scheduleLocked?: boolean;
  typeLocked?: boolean;
}

const field = "tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand disabled:bg-background disabled:text-muted";

export function WoForm({
  initial,
  vehicles,
  vendors,
  assignees,
  spareparts,
  locations,
}: {
  initial: WoInitial;
  vehicles: Opt[];
  vendors: Opt[];
  assignees: Opt[];
  spareparts: Opt[];
  locations: Opt[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveWoAction.bind(null, initial.id ?? null), null);
  const [type, setType] = useState(initial.type);
  const [parts, setParts] = useState(initial.parts);

  useEffect(() => {
    if (state?.ok && state.data) {
      const w = state.data.warnings?.length ? `?warn=${encodeURIComponent(state.data.warnings.join(" · "))}` : "";
      router.push(`/maintenance/work-orders/${state.data.id}${w}`);
    }
  }, [state, router]);

  const emergency = type === "EMERGENCY";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="version" value={initial.version ?? ""} />
      <input type="hidden" name="parts" value={JSON.stringify(parts)} />
      <input type="hidden" name="type" value={type} />
      {initial.scheduleLocked && (
        <>
          <input type="hidden" name="start" value={initial.start} />
          <input type="hidden" name="end" value={initial.end} />
        </>
      )}

      <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Jenis *</span>
          <select value={type} disabled={initial.typeLocked} onChange={(e) => setType(e.target.value)} className={field}>
            <option value="PREVENTIVE">Preventif</option>
            <option value="CORRECTIVE">Korektif</option>
            <option value="EMERGENCY">Emergensi</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Prioritas *</span>
          <select name="priority" defaultValue={emergency ? "URGENT" : initial.priority} disabled={emergency} className={field}>
            <option value="LOW">Rendah</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Tinggi</option>
            <option value="URGENT">Darurat</option>
          </select>
          {emergency && <span className="mt-1 block text-xs text-muted">WO emergensi otomatis berprioritas tertinggi.</span>}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Kendaraan *</span>
          <select name="vehicle_id" defaultValue={initial.vehicle_id} disabled={!!initial.id} required className={field}>
            <option value="">— pilih kendaraan —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          {initial.id && <input type="hidden" name="vehicle_id" value={initial.vehicle_id} />}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Jadwal mulai {emergency ? "(kosong = sekarang)" : ""}</span>
          <input type="datetime-local" name="start" defaultValue={initial.start} disabled={initial.scheduleLocked} className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Jadwal selesai</span>
          <input type="datetime-local" name="end" defaultValue={initial.end} disabled={initial.scheduleLocked} className={field} />
          {initial.scheduleLocked && <span className="mt-1 block text-xs text-muted">Jadwal diubah lewat “Ajukan Perubahan Jadwal” di halaman detail.</span>}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Bengkel</span>
          <select name="vendor_id" defaultValue={initial.vendor_id} className={field}>
            <option value="">— internal / belum ada —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Teknisi</span>
          <select name="assignee_id" defaultValue={initial.assignee_id} className={field}>
            <option value="">— belum ditugaskan —</option>
            {assignees.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Sumber / keluhan</span>
          <input name="source_note" defaultValue={initial.source_note} placeholder="Mis. temuan mekanik: rem berdecit" className={field} />
        </label>
        <label className="block text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block font-medium">Deskripsi pekerjaan</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={initial.description}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-2 font-semibold">Kebutuhan sparepart (membuat reservasi stok)</div>
        <div className="space-y-2 p-4">
          {parts.map((p, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_5rem_minmax(0,1.3fr)_2.5rem] items-end gap-2">
              <select
                aria-label="Sparepart"
                value={p.sparepart_id}
                onChange={(e) => setParts((x) => x.map((y, j) => (j === i ? { ...y, sparepart_id: e.target.value } : y)))}
                className={field}
              >
                <option value="">— sparepart —</option>
                {spareparts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Qty rencana"
                inputMode="decimal"
                value={p.qty}
                onChange={(e) => setParts((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))}
                className={field}
              />
              <select
                aria-label="Lokasi reservasi"
                value={p.location_id}
                onChange={(e) => setParts((x) => x.map((y, j) => (j === i ? { ...y, location_id: e.target.value } : y)))}
                className={field}
              >
                <option value="">Tanpa reservasi</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    Ambil dari {l.label}
                  </option>
                ))}
              </select>
              <button type="button" aria-label="Hapus part" className="tap rounded-lg border border-border text-lg" onClick={() => setParts((x) => x.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="tap rounded-lg border border-border px-4 text-sm hover:bg-brand-soft" onClick={() => setParts((x) => [...x, { sparepart_id: "", qty: "1", location_id: locations[0]?.id ?? "" }])}>
            + Tambah part
          </button>
        </div>
      </div>

      {state && !state.ok && <Alert result={state} />}
      <button disabled={pending} className="tap rounded-lg bg-brand px-6 text-sm font-medium text-on-brand hover:bg-brand-strong disabled:opacity-60">
        {pending ? "Menyimpan…" : initial.id ? "Simpan perubahan" : "Buat Work Order"}
      </button>
    </form>
  );
}
