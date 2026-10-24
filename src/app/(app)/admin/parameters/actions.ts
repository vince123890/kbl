"use server";

import { revalidatePath } from "next/cache";
import { authorize, type ActionResult } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/pg-errors";

export async function updateParameterAction(
  key: string,
  version: number,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await authorize("admin.param");
  if (auth.error) return auth.error;
  const value = String(formData.get("value") ?? "").trim();
  if (!value) return { ok: false, error: "Nilai wajib diisi" };

  // tipe, minimum, dan maksimum divalidasi oleh trigger database
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_parameters")
    .update({ value })
    .eq("key", key)
    .eq("row_version", version)
    .select("key");
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data?.length) return { ok: false, error: "Data diubah oleh pengguna lain, muat ulang halaman lalu coba lagi" };
  revalidatePath("/admin/parameters");
  return { ok: true, message: "Tersimpan" };
}
