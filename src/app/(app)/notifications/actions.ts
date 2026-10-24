"use server";

import { revalidatePath } from "next/cache";
import { authorize, type ActionResult } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/rpc";
import { dispatchQueued } from "@/lib/notify-dispatch";

export async function markReadAction(): Promise<ActionResult> {
  return callRpc("notification_mark_read", { p_ids: null });
}

/** Mengantrekan ulang notifikasi gagal lalu mencoba mengirim (admin.notif). */
export async function resendNotificationsAction(ids: string[] | null): Promise<ActionResult> {
  const auth = await authorize("admin.notif");
  if (auth.error) return auth.error;
  const db = createAdminClient();
  let q = db.from("notifications").update({ status: "QUEUED", attempts: 0, last_error: null }).eq("status", "FAILED").neq("channel", "INAPP");
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  const r = await dispatchQueued(100);
  revalidatePath("/admin/notifications");
  return { ok: true, message: `${r.sent} terkirim, ${r.failed} gagal` };
}
