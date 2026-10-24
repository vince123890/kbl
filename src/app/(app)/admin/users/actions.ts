"use server";

import { revalidatePath } from "next/cache";
import { authorize, type ActionResult } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyDbError } from "@/lib/pg-errors";
import { generateTempPassword } from "@/lib/password";
import { parseCsvObjects } from "@/lib/csv";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAN_FOREVER = "876000h";

interface UserInput {
  name: string;
  email: string;
  phone: string;
  branchId: string;
  roleIds: string[];
}

function parseUserForm(fd: FormData, requireEmail: boolean): { input: UserInput; errors: Record<string, string> } {
  const input: UserInput = {
    name: String(fd.get("name") ?? "").trim(),
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
    phone: String(fd.get("phone") ?? "").trim(),
    branchId: String(fd.get("branch_id") ?? ""),
    roleIds: fd.getAll("role_ids").map(String),
  };
  const errors: Record<string, string> = {};
  if (!input.name) errors.name = "Nama wajib diisi";
  if (requireEmail && !EMAIL_RE.test(input.email)) errors.email = "Email tidak valid";
  if (!input.phone) errors.phone = "Telepon wajib diisi (dipakai untuk notifikasi)";
  if (!input.branchId) errors.branch_id = "Cabang wajib dipilih";
  if (!input.roleIds.length) errors.role_ids = "Pilih minimal satu role";
  return { input, errors };
}

export async function createUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult<{ email: string; password: string }>> {
  const auth = await authorize("admin.user");
  if (auth.error) return auth.error;

  const { input, errors } = parseUserForm(formData, true);
  if (Object.keys(errors).length) return { ok: false, error: "Periksa isian yang bertanda merah", fieldErrors: errors };

  const supabase = await createClient();
  const { data: dup } = await supabase.from("profiles").select("id").ilike("email", input.email).maybeSingle();
  if (dup) return { ok: false, error: "Email sudah terdaftar", fieldErrors: { email: "Email sudah terdaftar" } };

  const password = generateTempPassword();
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({ email: input.email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    const taken = /already|registered|exists/i.test(created.error?.message ?? "");
    return { ok: false, error: taken ? "Email sudah terdaftar" : (created.error?.message ?? "Gagal membuat akun") };
  }
  const id = created.data.user.id;

  // profil dan role dibuat atas nama admin yang sedang login: RLS + audit mencatat pelakunya
  const { error: pErr } = await supabase.from("profiles").insert({
    id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    branch_id: input.branchId,
    must_change_password: true,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(id);
    return { ok: false, error: friendlyDbError(pErr) };
  }
  const { error: rErr } = await supabase.from("user_roles").insert(input.roleIds.map((role_id) => ({ user_id: id, role_id })));
  if (rErr) {
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
    return { ok: false, error: friendlyDbError(rErr) };
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "User dibuat", data: { email: input.email, password } };
}

export async function updateUserAction(
  userId: string,
  version: number,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await authorize("admin.user");
  if (auth.error) return auth.error;

  const { input, errors } = parseUserForm(formData, false);
  if (Object.keys(errors).length) return { ok: false, error: "Periksa isian yang bertanda merah", fieldErrors: errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ name: input.name, phone: input.phone, branch_id: input.branchId })
    .eq("id", userId)
    .eq("row_version", version)
    .select("id");
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data?.length) return { ok: false, error: "Data diubah oleh pengguna lain, muat ulang halaman lalu coba lagi" };

  const { data: current } = await supabase.from("user_roles").select("role_id").eq("user_id", userId);
  const have = new Set((current ?? []).map((r) => r.role_id));
  const want = new Set(input.roleIds);
  const toAdd = [...want].filter((r) => !have.has(r));
  const toRemove = [...have].filter((r) => !want.has(r));

  if (toAdd.length) {
    const { error: e } = await supabase.from("user_roles").insert(toAdd.map((role_id) => ({ user_id: userId, role_id })));
    if (e) return { ok: false, error: friendlyDbError(e) };
  }
  if (toRemove.length) {
    const { error: e } = await supabase.from("user_roles").delete().eq("user_id", userId).in("role_id", toRemove);
    if (e) return { ok: false, error: friendlyDbError(e) };
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "User diperbarui" };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize("admin.user");
  if (auth.error) return auth.error;
  if (!active && auth.user.id === userId) return { ok: false, error: "Anda tidak dapat menonaktifkan akun sendiri" };

  const supabase = await createClient();
  // trigger DB menolak bila ini SYS_ADMIN aktif terakhir
  const { data, error } = await supabase.from("profiles").update({ is_active: active }).eq("id", userId).select("id");
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data?.length) return { ok: false, error: "User tidak ditemukan" };

  // blokir sesi dan token yang masih beredar
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : BAN_FOREVER });
  revalidatePath("/admin/users");
  return { ok: true, message: active ? "User diaktifkan" : "User dinonaktifkan" };
}

export async function resetUserPasswordAction(userId: string): Promise<ActionResult<{ password: string }>> {
  const auth = await authorize("admin.user");
  if (auth.error) return auth.error;

  const password = generateTempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  await admin.from("profiles").update({ must_change_password: true, failed_attempts: 0, locked_until: null }).eq("id", userId);
  await admin.rpc("log_security_event", { p_user: userId, p_action: "PASSWORD_RESET_BY_ADMIN", p_meta: { by: auth.user.id }, p_ip: null });
  revalidatePath("/admin/users");
  return { ok: true, message: "Password direset", data: { password } };
}

export async function unlockUserAction(userId: string): Promise<ActionResult> {
  const auth = await authorize("admin.user");
  if (auth.error) return auth.error;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ failed_attempts: 0, locked_until: null }).eq("id", userId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/admin/users");
  return { ok: true, message: "Kunci dibuka" };
}

interface ImportedCredential {
  email: string;
  name: string;
  password: string;
}

/**
 * Impor user dari CSV: nama; email; telepon; cabang (kode); role (pisahkan dengan |).
 * Semua baris divalidasi lebih dulu; akun dibuat satu per satu. Password sementara ditampilkan sekali dan wajib diganti saat login pertama.
 */
export async function importUsersAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ created: ImportedCredential[] }>> {
  const auth = await authorize("admin.user");
  if (auth.error) return auth.error;
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Pilih berkas CSV terlebih dahulu" };
  const rows = parseCsvObjects(await file.text());
  if (!rows.length) return { ok: false, error: "Berkas kosong atau header tidak dikenali (nama; email; telepon; cabang; role)" };
  if (rows.length > 200) return { ok: false, error: "Maksimal 200 user per unggah" };

  const supabase = await createClient();
  const [{ data: branches }, { data: roles }] = await Promise.all([supabase.from("branches").select("id,code"), supabase.from("roles").select("id,name")]);
  const branchBy = new Map((branches ?? []).map((b) => [String(b.code).toLowerCase(), b.id as string]));
  const roleBy = new Map((roles ?? []).map((r) => [String(r.name).toLowerCase(), r.id as string]));
  const emails = rows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean);
  const { data: existing } = emails.length ? await supabase.from("profiles").select("email").in("email", emails) : { data: [] };
  const taken = new Set((existing ?? []).map((e) => String(e.email).toLowerCase()));

  const errors: string[] = [];
  const seen = new Set<string>();
  const parsed = rows.map((r, i) => {
    const line = i + 2;
    const email = (r.email ?? "").trim().toLowerCase();
    const roleIds = (r.role ?? "")
      .split(/[|,]/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .map((n) => roleBy.get(n));
    if (!r.nama) errors.push(`Baris ${line}: nama wajib diisi`);
    if (!EMAIL_RE.test(email)) errors.push(`Baris ${line}: email tidak valid`);
    else if (taken.has(email)) errors.push(`Baris ${line}: email ${email} sudah terdaftar`);
    else if (seen.has(email)) errors.push(`Baris ${line}: email ${email} dobel dalam berkas`);
    seen.add(email);
    if (!r.telepon) errors.push(`Baris ${line}: telepon wajib diisi`);
    const branchId = branchBy.get((r.cabang ?? "").trim().toLowerCase());
    if (!branchId) errors.push(`Baris ${line}: kode cabang "${r.cabang}" tidak dikenal`);
    if (!roleIds.length || roleIds.some((x) => !x)) errors.push(`Baris ${line}: role kosong atau tidak dikenal ("${r.role}")`);
    return { name: r.nama, email, phone: r.telepon, branchId: branchId ?? "", roleIds: roleIds.filter((x): x is string => !!x) };
  });
  if (errors.length) {
    return { ok: false, error: `${errors.slice(0, 6).join("; ")}${errors.length > 6 ? ` (+${errors.length - 6} galat lain)` : ""}. Tidak ada user yang dibuat.` };
  }

  const admin = createAdminClient();
  const created: ImportedCredential[] = [];
  const partial = (msg: string) => `${msg}. ${created.length} user sebelumnya sudah dibuat.`;
  for (const u of parsed) {
    const password = generateTempPassword();
    const res = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (res.error || !res.data.user) return { ok: false, error: partial(`${u.email}: ${res.error?.message ?? "gagal membuat akun"}`) };
    const id = res.data.user.id;
    const { error: pErr } = await supabase
      .from("profiles")
      .insert({ id, name: u.name, email: u.email, phone: u.phone, branch_id: u.branchId, must_change_password: true });
    if (pErr) {
      await admin.auth.admin.deleteUser(id);
      return { ok: false, error: partial(`${u.email}: ${friendlyDbError(pErr)}`) };
    }
    const { error: rErr } = await supabase.from("user_roles").insert(u.roleIds.map((role_id) => ({ user_id: id, role_id })));
    if (rErr) {
      await admin.from("profiles").delete().eq("id", id);
      await admin.auth.admin.deleteUser(id);
      return { ok: false, error: partial(`${u.email}: ${friendlyDbError(rErr)}`) };
    }
    created.push({ email: u.email, name: u.name, password });
  }
  revalidatePath("/admin/users");
  return { ok: true, message: `${created.length} user dibuat`, data: { created } };
}
