"use client";

import { ActionButton } from "@/components/action-button";
import {
  approvalActAction,
  approvalEscalateAction,
  approvalOverrideAction,
  approvalRemindAction,
} from "@/app/(app)/approvals/actions";

/** Tombol keputusan approval. Hak tampil dihitung di server; DB tetap memeriksa ulang setiap aksi. */
export function ApprovalPanel({
  requestId,
  canDecide,
  canOverride,
  isLast,
}: {
  requestId: string;
  canDecide: boolean;
  canOverride: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {canDecide && (
        <>
          <ActionButton
            tone="primary"
            label="Setujui"
            noteLabel="Catatan (opsional)"
            noteRequired={false}
            action={approvalActAction.bind(null, requestId, "APPROVE")}
          />
          <ActionButton tone="danger" label="Tolak" noteLabel="Alasan penolakan" action={approvalActAction.bind(null, requestId, "REJECT")} />
          <ActionButton label="Minta revisi" noteLabel="Catatan revisi" action={approvalActAction.bind(null, requestId, "REVISE")} />
        </>
      )}
      {canOverride && (
        <>
          <ActionButton
            tone="danger"
            label="Override"
            noteLabel="Alasan override"
            noteHelp="Melompati level yang tersisa. Tercatat permanen sebagai OVERRIDE."
            action={approvalOverrideAction.bind(null, requestId)}
          />
          {!isLast && (
            <ActionButton
              label="Eskalasi ke level berikutnya"
              noteLabel="Catatan (opsional)"
              noteRequired={false}
              action={approvalEscalateAction.bind(null, requestId)}
            />
          )}
          <ActionButton label="Ingatkan approver" action={approvalRemindAction.bind(null, requestId)} />
        </>
      )}
    </div>
  );
}
