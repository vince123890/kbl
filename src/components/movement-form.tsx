"use client";

import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/form";
import { SearchSelect } from "@/components/search-select";
import { saveMovementAction } from "@/app/(app)/inventory/actions";
import { fmtQty } from "@/lib/format";

export interface SparepartOpt {
  id: string;
  code: string;
  name: string;
  uom: string;
}
export interface LocationOpt {
  id: string;
  name: string;
}
export interface VehicleOpt {
  id: string;
  plate: string;
}
export interface WoOpt {
  id: string;
  label: string;
  vehicleId: string;
}

interface Line {
  sparepart_id: string;
  qty: string;
  notes: string;
}

export interface MovementInitial {
  id?: string;
  version?: number;
  type: string;
  doc_date: string;
  vehicle_id: string;
  work_order_id: string;
  from_location_id: string;
  to_location_id: string;
  notes: string;
  lines: Line[];
}

const TYPES = [
  { value: "IN", label: "Masuk" },
  { value: "OUT", label: "Keluar" },
  { value: "RETURN", label: "Retur" },
  { value: "TRANSFER", label: "Transfer" },
];

const field = "tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand";

/** Form mutasi sparepart. Draft disimpan otomatis di peramban sampai berhasil disimpan ke server. */
export function MovementForm({
  initial,
  branchId,
  spareparts,
  locations,
  vehicles,
  workOrders,
  available,
}: {
  initial: MovementInitial;
  branchId: string;
  spareparts: SparepartOpt[];
  locations: LocationOpt[];
  vehicles: VehicleOpt[];
  workOrders: WoOpt[];
  /** "sparepartId:locationId" → stok tersedia (on hand − reservasi) */
  available: Record<string, number>;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveMovementAction, null);
  const draftKey = `kbl-draft-movement-${initial.id ?? "new"}`;

  const [form, setForm] = useState({
    type: initial.type,
    doc_date: initial.doc_date,
    vehicle_id: initial.vehicle_id,
    work_order_id: initial.work_order_id,
    from_location_id: initial.from_location_id,
    to_location_id: initial.to_location_id,
    notes: initial.notes,
  });
  const [lines, setLines] = useState<Line[]>(initial.lines.length ? initial.lines : [{ sparepart_id: "", qty: "", notes: "" }]);
  const [dismissed, setDismissed] = useState(false);

  // draft di peramban (hanya dibaca lewat useSyncExternalStore agar aman dari hidrasi); ditawarkan, tidak diterapkan otomatis
  const draftRaw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => {
      try {
        return localStorage.getItem(draftKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const offerDraft = !!draftRaw && !initial.lines.length && !dismissed;

  const discardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* abaikan */
    }
    setDismissed(true);
  };
  const restoreDraft = () => {
    try {
      const saved = JSON.parse(draftRaw ?? "") as { form: typeof form; lines: Line[] };
      setForm(saved.form);
      setLines(saved.lines);
    } catch {
      /* draf rusak diabaikan */
    }
    setDismissed(true);
  };

  // simpan otomatis hanya bila sudah ada isian bermakna
  useEffect(() => {
    if (!lines.some((l) => l.sparepart_id || l.qty)) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ form, lines }));
    } catch {
      /* abaikan */
    }
  }, [form, lines, draftKey]);

  useEffect(() => {
    if (state?.ok && state.data) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* abaikan */
      }
      router.push(`/inventory/movements/${state.data.id}`);
    } else if (state && !state.ok && state.fieldErrors?.saved_id) {
      router.push(`/inventory/movements/${state.fieldErrors.saved_id}?error=${encodeURIComponent(state.error)}`);
    }
  }, [state, router, draftKey]);

  const spMap = useMemo(() => new Map(spareparts.map((s) => [s.id, s])), [spareparts]);
  const spOpts = useMemo(() => spareparts.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` })), [spareparts]);
  const needsFrom = form.type === "OUT" || form.type === "TRANSFER";
  const needsTo = form.type === "IN" || form.type === "RETURN" || form.type === "TRANSFER";
  const wo = workOrders.find((w) => w.id === form.work_order_id);
  const useWo = form.type === "OUT" || form.type === "RETURN";

  const setLine = (i: number, p: Partial<Line>) => setLines((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  return (
    <form action={action} className="space-y-5">
      {offerDraft && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">
          Ada draft yang belum tersimpan di peramban ini.{" "}
          <button type="button" className="font-medium underline" onClick={restoreDraft}>
            Pulihkan
          </button>{" "}
          ·{" "}
          <button type="button" className="underline" onClick={discardDraft}>
            Buang
          </button>
        </p>
      )}
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <input type="hidden" name="version" value={initial.version ?? ""} />
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="hidden" name="type" value={form.type} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Tipe *</span>
          <select
            value={form.type}
            disabled={!!initial.id}
            onChange={(e) => set({ type: e.target.value, work_order_id: "", vehicle_id: "" })}
            className={field}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Tanggal *</span>
          <input type="date" name="doc_date" value={form.doc_date} onChange={(e) => set({ doc_date: e.target.value })} className={field} />
        </label>
        {useWo && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">No. Work Order {form.type === "OUT" ? "" : "(opsional)"}</span>
            <select
              name="work_order_id"
              value={form.work_order_id}
              onChange={(e) => set({ work_order_id: e.target.value, vehicle_id: "" })}
              className={field}
            >
              <option value="">— tanpa WO —</option>
              {workOrders.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {form.type === "OUT" && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Kendaraan {wo ? "(dari WO)" : "*"}</span>
            <select
              name="vehicle_id"
              value={wo ? wo.vehicleId : form.vehicle_id}
              disabled={!!wo}
              onChange={(e) => set({ vehicle_id: e.target.value })}
              className={`${field} ${wo ? "bg-background text-muted" : ""}`}
            >
              <option value="">— pilih kendaraan —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                </option>
              ))}
            </select>
            {wo && <input type="hidden" name="vehicle_id" value={wo.vehicleId} />}
          </label>
        )}
        {needsFrom && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Dari lokasi *</span>
            <select name="from_location_id" value={form.from_location_id} onChange={(e) => set({ from_location_id: e.target.value })} className={field}>
              <option value="">— pilih —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {needsTo && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Ke lokasi *</span>
            <select name="to_location_id" value={form.to_location_id} onChange={(e) => set({ to_location_id: e.target.value })} className={field}>
              <option value="">— pilih —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block font-medium">Catatan</span>
          <textarea
            name="notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-2 font-semibold">Item</div>
        <div className="space-y-3 p-4">
          {lines.map((l, i) => {
            const sp = spMap.get(l.sparepart_id);
            const avail = sp && form.from_location_id ? available[`${sp.id}:${form.from_location_id}`] : undefined;
            const over = avail !== undefined && Number(l.qty.replace(",", ".")) > avail;
            return (
              <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,2fr)_6rem_5rem_6rem_minmax(0,1.2fr)_2.5rem]">
                <div className="col-span-2 text-sm sm:col-span-1">
                  <span className="mb-1 block text-xs text-muted">Sparepart</span>
                  <SearchSelect
                    ariaLabel="Sparepart"
                    placeholder="Cari sparepart (mis. rem)…"
                    value={l.sparepart_id}
                    onChange={(id) => setLine(i, { sparepart_id: id })}
                    options={spOpts}
                    className={field}
                  />
                </div>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-muted">Qty</span>
                  <input
                    inputMode="decimal"
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value })}
                    aria-invalid={over}
                    className={`${field} ${over ? "border-danger" : ""}`}
                  />
                </label>
                <div className="text-sm">
                  <span className="mb-1 block text-xs text-muted">Satuan</span>
                  <p className="tap flex items-center rounded-lg bg-background px-3 text-muted">{sp?.uom ?? "-"}</p>
                </div>
                <div className="text-sm">
                  <span className="mb-1 block text-xs text-muted">Tersedia</span>
                  <p className={`tap flex items-center rounded-lg bg-background px-3 ${over ? "font-medium text-danger" : "text-muted"}`}>
                    {avail === undefined ? "-" : fmtQty(avail)}
                  </p>
                </div>
                <label className="col-span-2 text-sm sm:col-span-1">
                  <span className="mb-1 block text-xs text-muted">Catatan</span>
                  <input value={l.notes} onChange={(e) => setLine(i, { notes: e.target.value })} className={field} />
                </label>
                <button
                  type="button"
                  aria-label="Hapus baris"
                  disabled={lines.length === 1}
                  onClick={() => setLines((x) => x.filter((_, j) => j !== i))}
                  className="tap rounded-lg border border-border text-lg disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setLines((x) => [...x, { sparepart_id: "", qty: "", notes: "" }])}
            className="tap rounded-lg border border-border px-4 text-sm hover:bg-brand-soft"
          >
            + Tambah item
          </button>
        </div>
      </div>

      {state && !state.ok && <Alert result={state} />}

      <div className="flex flex-wrap gap-2">
        <button
          name="intent"
          value="draft"
          disabled={pending}
          className="tap rounded-lg border border-border px-5 text-sm font-medium hover:bg-brand-soft disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : "Simpan draft"}
        </button>
        <button
          name="intent"
          value="submit"
          disabled={pending}
          className="tap rounded-lg bg-brand px-5 text-sm font-medium text-on-brand hover:bg-brand-strong disabled:opacity-60"
        >
          Ajukan untuk approval
        </button>
      </div>
    </form>
  );
}
