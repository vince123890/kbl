"use client";

import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { FormDialog } from "@/components/master-form-dialog";
import {
  ackIncidentAction,
  closeIncidentAction,
  correctTypeAction,
  createEmergencyWoAction,
  falseReportAction,
  incidentLogAction,
  resolveIncidentAction,
} from "@/app/(app)/emergency/actions";
import { TYPE_BUTTONS } from "@/lib/emergency-guide";

const sel = "tap w-full rounded-lg border border-border bg-surface px-3 text-sm";

/** Aksi cepat sisi pusat. Hak tampil dihitung di server; DB memeriksa ulang. */
export function IncidentActions({
  id,
  status,
  type,
  canHandle,
  canClose,
  canWo,
  hasWo,
  assignees,
}: {
  id: string;
  status: string;
  type: string;
  canHandle: boolean;
  canClose: boolean;
  canWo: boolean;
  hasWo: boolean;
  assignees: { id: string; label: string }[];
}) {
  const router = useRouter();
  const open = !["RESOLVED", "CLOSED"].includes(status);
  return (
    <div className="flex flex-wrap items-start gap-2">
      {canHandle && status === "REPORTED" && <ActionButton tone="primary" label="Acknowledge" action={() => ackIncidentAction(id)} />}
      {canHandle && open && (
        <>
          <ActionButton label="Tugaskan derek" noteLabel="Derek / rincian penugasan" action={incidentLogAction.bind(null, id, "ASSIGN_TOW")} />
          <ActionButton label="Tugaskan teknisi" noteLabel="Teknisi / rincian penugasan" action={incidentLogAction.bind(null, id, "ASSIGN_TECH")} />
          <ActionButton label="Kendaraan pengganti" noteLabel="Kendaraan pengganti" action={incidentLogAction.bind(null, id, "REPLACEMENT_VEHICLE")} />
          <ActionButton label="Tambah catatan" noteLabel="Catatan" action={incidentLogAction.bind(null, id, "NOTE")} />
        </>
      )}
      {canHandle && canWo && open && !hasWo && (
        <FormDialog
          trigger="Buat WO emergensi"
          title="Buat Work Order emergensi"
          submitLabel="Buat WO"
          action={createEmergencyWoAction.bind(null, id) as never}
          triggerClassName="tap rounded-lg border border-danger/40 px-4 text-sm font-medium text-danger hover:bg-danger-soft"
          onSuccess={(s) => {
            const wo = (s as { data?: string }).data;
            if (wo) router.push(`/maintenance/work-orders/${wo}`);
          }}
        >
          {() => (
            <>
              <p className="text-sm text-muted">WO dibuat langsung berprioritas tertinggi dan boleh dikerjakan lebih dulu; validasi dilakukan pasca-kejadian.</p>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Teknisi (opsional)</span>
                <select name="assignee_id" className={sel}>
                  <option value="">— tentukan nanti —</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </FormDialog>
      )}
      {canHandle && ["ACKNOWLEDGED", "IN_HANDLING"].includes(status) && (
        <ActionButton tone="primary" label="Selesaikan" noteLabel="Catatan hasil penanganan" action={resolveIncidentAction.bind(null, id)} />
      )}
      {canClose && status === "RESOLVED" && <ActionButton tone="primary" label="Tutup insiden" confirm="Tutup insiden ini setelah review?" action={() => closeIncidentAction(id)} />}
      {canHandle && status !== "CLOSED" && (
        <>
          <FormDialog
            trigger="Koreksi jenis"
            title="Koreksi jenis kejadian"
            action={(async (_p: unknown, fd: FormData) => correctTypeAction(id, String(fd.get("type")))) as never}
            triggerClassName="tap rounded-lg border border-border px-4 text-sm hover:bg-brand-soft"
          >
            {() => (
              <select name="type" defaultValue={type} className={sel} aria-label="Jenis kejadian">
                {TYPE_BUTTONS.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </FormDialog>
          <ActionButton tone="danger" label="Laporan keliru" noteLabel="Alasan" noteHelp="Insiden tidak dihapus; ditandai keliru dan ditutup." action={falseReportAction.bind(null, id)} />
        </>
      )}
    </div>
  );
}
