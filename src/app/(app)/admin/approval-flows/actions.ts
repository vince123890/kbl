"use server";

import type { ActionResult } from "@/lib/auth/session";
import { callRpc } from "@/lib/rpc";
import type { FlowStepInput } from "@/lib/flow-config";

export async function saveFlowAction(docType: string, name: string, steps: FlowStepInput[]): Promise<ActionResult> {
  const payload = steps.map((s) => ({
    role: s.role,
    sla_hours: Number(s.sla_hours) || 24,
    metric: s.metric || null,
    op: s.metric ? s.op : null,
    value: s.metric ? s.value : null,
  }));
  return callRpc("approval_flow_save", { p_doc_type: docType, p_name: name, p_steps: payload }, { message: "Alur disimpan sebagai versi baru" });
}
