import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  branchId: string;
  branchName: string;
  isHq: boolean;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

interface ProfileRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  branch_id: string;
  is_active: boolean;
  must_change_password: boolean;
  branches: { name: string; is_hq: boolean } | null;
  user_roles: { roles: { name: string; role_permissions: { permission_code: string }[] } | null }[];
}

/** Pengguna login + role + permission (satu kali per permintaan). null bila tidak login atau nonaktif. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  // Identitas dari klaim JWT yang sudah diverifikasi (tanpa perjalanan jaringan ke Auth pada kunci asimetris).
  // Akun nonaktif tetap langsung terblokir: profil dibaca dan is_active diperiksa di bawah, dan RLS memeriksanya lagi.
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "id,email,name,phone,branch_id,is_active,must_change_password,branches(name,is_hq),user_roles(roles(name,role_permissions(permission_code)))",
    )
    .eq("id", uid)
    .maybeSingle<ProfileRow>();

  if (!data || !data.is_active) return null;

  const roles = data.user_roles.map((ur) => ur.roles?.name).filter((x): x is string => !!x);
  const permissions = [
    ...new Set(data.user_roles.flatMap((ur) => ur.roles?.role_permissions.map((p) => p.permission_code) ?? [])),
  ];
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    phone: data.phone,
    branchId: data.branch_id,
    branchName: data.branches?.name ?? "-",
    isHq: data.branches?.is_hq ?? false,
    mustChangePassword: data.must_change_password,
    roles,
    permissions,
  };
});

/** Mencatat penolakan akses (403) ke audit log. Gagal mencatat tidak boleh mengubah hasil otorisasi. */
async function logAccessDenied(userId: string, permission: string, where: string) {
  try {
    await createAdminClient().rpc("log_security_event", {
      p_user: userId,
      p_action: "ACCESS_DENIED",
      p_meta: { permission, where },
      p_ip: null,
    });
  } catch {
    /* abaikan */
  }
}

export function can(user: CurrentUser | null, permission: string): boolean {
  return !!user && user.permissions.includes(permission);
}

/** Untuk halaman: wajib login dan tidak sedang dipaksa ganti password. */
export async function requireUser(opts: { allowMustChange?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowMustChange) redirect("/change-password");
  return user;
}

/** Untuk halaman: wajib punya permission, jika tidak diarahkan ke /forbidden. */
export async function requirePermission(permission: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, permission)) {
    await logAccessDenied(user.id, permission, "page");
    redirect("/forbidden");
  }
  return user;
}

export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Untuk server action: mengembalikan hasil galat alih-alih redirect. */
export async function authorize(
  permission: string,
): Promise<{ user: CurrentUser; error?: undefined } | { user?: undefined; error: ActionResult & { ok: false } }> {
  const user = await getCurrentUser();
  if (!user) return { error: { ok: false, error: "Sesi berakhir, silakan login kembali" } };
  if (user.mustChangePassword) return { error: { ok: false, error: "Ganti password terlebih dahulu" } };
  if (!can(user, permission)) {
    await logAccessDenied(user.id, permission, "action");
    return { error: { ok: false, error: "Anda tidak berwenang melakukan aksi ini" } };
  }
  return { user };
}
