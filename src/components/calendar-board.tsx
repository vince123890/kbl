"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/form";
import { requestScheduleChangeAction } from "@/app/(app)/maintenance/actions";
import { DAY_NAMES } from "@/lib/calendar";

export interface CalEvent {
  id: string;
  woNo: string;
  type: string;
  status: string;
  plate: string;
  tech: string | null;
  vendor: string | null;
  /** tanggal (WIB, yyyy-mm-dd) tempat acara ditampilkan */
  date: string;
  /** jam mulai–selesai bila terjadwal */
  time: string | null;
  /** nilai datetime-local WIB dari jadwal mulai (kosong bila belum dijadwalkan) */
  startLocal: string;
  overdue: boolean;
  unscheduled: boolean;
  movable: boolean;
}

const COLORS: Record<string, string> = {
  PREVENTIVE: "border-sky-300 bg-sky-100 text-sky-900",
  CORRECTIVE: "border-amber-300 bg-brand-soft text-foreground",
  EMERGENCY: "border-danger/50 bg-danger-soft text-danger",
};

export function CalendarLegend() {
  return (
    <ul className="flex flex-wrap gap-3 text-xs">
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded border border-sky-300 bg-sky-100" /> Preventif
      </li>
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded border border-amber-300 bg-brand-soft" /> Korektif
      </li>
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded border border-danger/50 bg-danger-soft" /> Emergensi
      </li>
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded ring-2 ring-danger" /> Overdue
      </li>
    </ul>
  );
}

/** Grid bulan/minggu. Menyeret WO ke hari lain membuka dialog Perubahan Jadwal (alasan wajib), bukan memindahkan langsung. */
export function CalendarBoard({
  days,
  events,
  inMonth,
  today,
  tall,
  reasons,
}: {
  days: string[];
  events: CalEvent[];
  inMonth?: string;
  today: string;
  tall?: boolean;
  reasons: { id: string; name: string; require_note: boolean }[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [drag, setDrag] = useState<CalEvent | null>(null);
  const [target, setTarget] = useState<{ ev: CalEvent; date: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof requestScheduleChangeAction>> | null, fd: FormData) => {
    const r = await requestScheduleChangeAction(target?.ev.id ?? "", prev, fd);
    if (r.ok) {
      dialog.current?.close();
      setTarget(null);
      router.refresh();
    }
    return r;
  }, null);

  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const drop = (date: string) => {
    setOver(null);
    if (!drag || !drag.movable || drag.date === date) return setDrag(null);
    setTarget({ ev: drag, date });
    setDrag(null);
    setTimeout(() => dialog.current?.showModal(), 0);
  };

  return (
    <>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-sm">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-background px-2 py-1 text-center text-xs font-medium uppercase text-muted">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const list = byDate.get(d) ?? [];
          const dim = inMonth && d.slice(0, 7) !== inMonth;
          return (
            <div
              key={d}
              onDragOver={(e) => {
                if (drag?.movable) {
                  e.preventDefault();
                  setOver(d);
                }
              }}
              onDragLeave={() => setOver((o) => (o === d ? null : o))}
              onDrop={() => drop(d)}
              className={`min-w-0 bg-surface p-1 ${tall ? "min-h-56" : "min-h-24"} ${dim ? "opacity-50" : ""} ${over === d ? "outline outline-2 -outline-offset-2 outline-brand" : ""}`}
            >
              <p className={`mb-1 text-right text-xs ${d === today ? "font-bold" : "text-muted"}`}>
                <span className={d === today ? "rounded-full bg-brand px-1.5 py-0.5 text-on-brand" : ""}>{Number(d.slice(8))}</span>
              </p>
              <ul className="space-y-1">
                {list.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/maintenance/work-orders/${e.id}`}
                      draggable={e.movable}
                      onDragStart={() => setDrag(e)}
                      onDragEnd={() => setDrag(null)}
                      title={`${e.woNo} · ${e.plate}${e.tech ? ` · ${e.tech}` : ""}${e.vendor ? ` · ${e.vendor}` : ""}`}
                      className={`block truncate rounded border px-1.5 py-0.5 text-xs ${COLORS[e.type] ?? COLORS.CORRECTIVE} ${e.overdue ? "ring-2 ring-danger" : ""} ${e.movable ? "cursor-grab" : ""} ${e.status === "COMPLETED" ? "opacity-60 line-through" : ""}`}
                    >
                      {e.time && <b>{e.time} </b>}
                      {e.plate}
                      {e.unscheduled && " (jatuh tempo)"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <dialog
        ref={dialog}
        onClose={() => setTarget(null)}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/45"
      >
        {target && (
          <form action={action} className="space-y-3 p-5">
            <h2 className="font-semibold">Ajukan perubahan jadwal</h2>
            <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted">
              {target.ev.woNo} · {target.ev.plate}. Memindahkan WO tidak langsung berlaku; pengajuan ini melewati approval dan wajib punya alasan.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Jadwal baru (mulai) *</span>
              <input
                type="datetime-local"
                name="new_start"
                required
                defaultValue={`${target.date}T${target.ev.startLocal.slice(11) || "08:00"}`}
                className="tap w-full rounded-lg border border-border bg-surface px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Kategori alasan *</span>
              <select name="reason_code_id" required className="tap w-full rounded-lg border border-border bg-surface px-3">
                <option value="">— pilih alasan —</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.require_note ? " (wajib keterangan)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Keterangan</span>
              <textarea name="reason_note" rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2" />
            </label>
            {state && !state.ok && <Alert result={state} />}
            <div className="flex justify-end gap-2">
              <button type="button" className="tap rounded-lg border border-border px-4 text-sm" onClick={() => dialog.current?.close()}>
                Batal
              </button>
              <button disabled={pending} className="tap rounded-lg bg-brand px-4 text-sm font-medium text-on-brand disabled:opacity-60">
                {pending ? "Mengajukan…" : "Ajukan untuk approval"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
