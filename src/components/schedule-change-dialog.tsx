"use client";

import { FormDialog } from "@/components/master-form-dialog";
import { requestScheduleChangeAction, resubmitScheduleChangeAction } from "@/app/(app)/maintenance/actions";

export interface ReasonOpt {
  id: string;
  name: string;
  require_note: boolean;
}

const sel = "tap w-full rounded-lg border border-border bg-surface px-3 text-sm";

/** Dialog Ajukan Perubahan Jadwal. Dipakai dari detail WO, kalender (drag & drop), dan perbaikan pengajuan. */
export function ScheduleChangeDialog({
  woId,
  changeId,
  currentStart,
  currentEnd,
  initialStart,
  reasons,
  trigger = "Ajukan perubahan jadwal",
  triggerClassName,
  initialReason,
  initialNote,
}: {
  woId?: string;
  changeId?: string;
  currentStart: string;
  currentEnd?: string;
  initialStart?: string;
  reasons: ReasonOpt[];
  trigger?: string;
  triggerClassName?: string;
  initialReason?: string;
  initialNote?: string;
}) {
  const action = changeId ? resubmitScheduleChangeAction.bind(null, changeId) : requestScheduleChangeAction.bind(null, woId ?? "");
  return (
    <FormDialog trigger={trigger} title="Perubahan jadwal" action={action as never} submitLabel="Ajukan untuk approval" triggerClassName={triggerClassName}>
      {(state) => {
        const fe = state && !state.ok ? state.fieldErrors : undefined;
        return (
          <>
            <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted">
              Jadwal saat ini: <b>{currentStart}</b>
              {currentEnd ? ` – ${currentEnd}` : ""}. Setiap percepatan maupun penundaan melewati approval dan wajib punya alasan.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Jadwal baru (mulai) *</span>
              <input type="datetime-local" name="new_start" required defaultValue={initialStart} className={sel} />
              {fe?.new_start && <span className="text-xs text-danger">{fe.new_start}</span>}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Jadwal baru (selesai)</span>
              <input type="datetime-local" name="new_end" className={sel} />
              <span className="mt-1 block text-xs text-muted">Kosong = durasi sama dengan jadwal lama.</span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Kategori alasan<span className="text-danger"> *</span>
              </span>
              <select name="reason_code_id" required defaultValue={initialReason ?? ""} className={sel}>
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
              <textarea name="reason_note" rows={2} defaultValue={initialNote} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            </label>
          </>
        );
      }}
    </FormDialog>
  );
}
