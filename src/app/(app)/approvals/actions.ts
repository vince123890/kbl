"use server";

import type { ActionResult } from "@/lib/auth/session";
import { callRpc } from "@/lib/rpc";

type Decision = "APPROVE" | "REJECT" | "REVISE";

const MESSAGE: Record<Decision, string> = {
  APPROVE: "Keputusan tersimpan: disetujui",
  REJECT: "Dokumen ditolak",
  REVISE: "Dokumen dikembalikan untuk direvisi",
};

export async function approvalActAction(requestId: string, action: Decision, note: string): Promise<ActionResult> {
  return callRpc("approval_act", { p_request: requestId, p_action: action, p_note: note || null }, { message: MESSAGE[action] });
}

export async function approvalOverrideAction(requestId: string, note: string): Promise<ActionResult> {
  return callRpc("approval_override", { p_request: requestId, p_note: note }, { message: "Override tercatat" });
}

export async function approvalEscalateAction(requestId: string, note: string): Promise<ActionResult> {
  return callRpc("approval_escalate", { p_request: requestId, p_note: note || null }, { message: "Dialihkan ke level berikutnya" });
}

export async function approvalRemindAction(requestId: string): Promise<ActionResult> {
  return callRpc("approval_remind", { p_request: requestId }, { message: "Pengingat dikirim" });
}

/** Approve massal (maksimal 20) untuk dokumen yang dicentang. Berhenti di galat pertama agar jelas mana yang gagal. */
export async function approvalBatchApproveAction(ids: string[]): Promise<ActionResult> {
  if (!ids.length) return { ok: false, error: "Pilih minimal satu dokumen" };
  if (ids.length > 20) return { ok: false, error: "Maksimal 20 dokumen per approve massal" };
  let done = 0;
  for (const id of ids) {
    const r = await callRpc("approval_act", { p_request: id, p_action: "APPROVE", p_note: null });
    if (!r.ok) return { ok: false, error: `${done} dokumen disetujui, lalu berhenti: ${r.error}` };
    done++;
  }
  return { ok: true, message: `${done} dokumen disetujui` };
}
