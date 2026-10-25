"use server";

import { getCurrentUser, type ActionResult } from "@/lib/auth/session";
import { callRpc } from "@/lib/rpc";
import { uploadAttachmentAction } from "@/app/(app)/attachments/actions";
import type { AttachmentEntity } from "@/lib/attachments";

/** Aksi antrean hanya dijalankan untuk akun yang membuatnya; akun lain yang kebetulan login tidak boleh mengirimkannya. */
async function owner(expected: string): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login kembali" };
  if (user.id !== expected) return { ok: false, error: "Sesi berakhir: antrean ini milik akun lain, login dengan akun yang membuatnya" };
  return null;
}

export async function syncWoStartAction(expected: string, woId: string): Promise<ActionResult> {
  return (await owner(expected)) ?? callRpc("wo_start", { p_id: woId });
}

export async function syncWoCompleteAction(expected: string, woId: string, odometer: number | null, note: string | null): Promise<ActionResult> {
  return (await owner(expected)) ?? callRpc("wo_complete", { p_id: woId, p_odometer: odometer, p_note: note });
}

export interface SyncCountLine {
  sparepart_id: string;
  counted_qty?: string;
  not_counted?: boolean;
  reason_code_id?: string;
  reason_note?: string;
}

/** Menyimpan beberapa baris hasil hitung sekaligus. Idempoten: nilai terakhir menimpa. */
export async function syncCountLinesAction(expected: string, countId: string, lines: SyncCountLine[]): Promise<ActionResult> {
  return (await owner(expected)) ?? callRpc("count_enter", { p_id: countId, p_lines: lines });
}

export async function syncAttachmentAction(expected: string, entity: AttachmentEntity, entityId: string, fd: FormData): Promise<ActionResult> {
  return (await owner(expected)) ?? uploadAttachmentAction(entity, entityId, null, fd);
}
