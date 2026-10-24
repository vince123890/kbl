"use server";

import { revalidatePath } from "next/cache";
import { authorize, type ActionResult } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/pg-errors";

export async function createRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const auth = await authorize("admin.role");
  if (auth.error) return auth.error;
  const name = String(formData.get("name") ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  const description = String(formData.get("description") ?? "").trim();
  if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(name)) {
    return { ok: false, error: "Nama role 2–40 karakter: huruf, angka, garis bawah", fieldErrors: { name: "Format tidak valid" } };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("roles").insert({ name, description: description || null });
  if (error) return { ok: false, error: error.code === "23505" ? "Nama role sudah dipakai" : friendlyDbError(error) };
  revalidatePath("/admin/roles");
  return { ok: true, message: "Role dibuat" };
}

/** Menyimpan permission sebuah role dengan diff (hanya menambah/menghapus yang berubah). */
export async function savePermissionsAction(roleId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const auth = await authorize("admin.role");
  if (auth.error) return auth.error;
  const want = new Set(formData.getAll("perm").map(String));

  const supabase = await createClient();
  const { data: valid } = await supabase.from("permissions").select("code");
  const validCodes = new Set((valid ?? []).map((p) => p.code));
  for (const c of want) if (!validCodes.has(c)) return { ok: false, error: `Permission tidak dikenal: ${c}` };

  const { data: current, error: readErr } = await supabase.from("role_permissions").select("permission_code").eq("role_id", roleId);
  if (readErr) return { ok: false, error: friendlyDbError(readErr) };
  const have = new Set((current ?? []).map((p) => p.permission_code));

  const toAdd = [...want].filter((c) => !have.has(c));
  const toRemove = [...have].filter((c) => !want.has(c));

  if (toRemove.length) {
    const { error } = await supabase.from("role_permissions").delete().eq("role_id", roleId).in("permission_code", toRemove);
    if (error) return { ok: false, error: friendlyDbError(error) };
  }
  if (toAdd.length) {
    const { error } = await supabase.from("role_permissions").insert(toAdd.map((permission_code) => ({ role_id: roleId, permission_code })));
    if (error) return { ok: false, error: friendlyDbError(error) };
  }
  revalidatePath("/admin/roles");
  return { ok: true, message: "Permission disimpan. Berlaku bagi user pada login berikutnya." };
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult> {
  const auth = await authorize("admin.role");
  if (auth.error) return auth.error;
  const supabase = await createClient();
  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/admin/roles");
  return { ok: true, message: "Role dihapus" };
}
