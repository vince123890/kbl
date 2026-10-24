"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createStatelessClient } from "@/lib/supabase/admin";
import { getCurrentUser, type ActionResult } from "@/lib/auth/session";
import { validatePassword } from "@/lib/password";
import {
  LOGIN_AT_COOKIE,
  afterFailure,
  isLocked,
  minutesLeft,
  CLEAN_LOCK_STATE,
  LOCK_MINUTES,
  type LockState,
} from "@/lib/lockout";

const GENERIC_LOGIN_ERROR = "Email atau password salah";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

async function logSecurity(userId: string | null, action: string, meta?: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.rpc("log_security_event", {
    p_user: userId,
    p_action: action,
    p_meta: meta ?? null,
    p_ip: await clientIp(),
  });
}

async function markLoginTime() {
  const store = await cookies();
  store.set(LOGIN_AT_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Email dan password wajib diisi" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,is_active,failed_attempts,locked_until")
    .eq("email", email)
    .maybeSingle();
  const now = new Date();
  const state: LockState = profile
    ? { failed_attempts: profile.failed_attempts, locked_until: profile.locked_until }
    : CLEAN_LOCK_STATE;

  if (profile && isLocked(state, now)) {
    await logSecurity(profile.id, "LOGIN_FAILED", { reason: "LOCKED" });
    return { ok: false, error: `Akun terkunci, coba lagi dalam ${minutesLeft(state, now)} menit` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (profile) {
      const next = afterFailure(state, now);
      await admin
        .from("profiles")
        .update({ failed_attempts: next.failed_attempts, locked_until: next.locked_until })
        .eq("id", profile.id);
      await logSecurity(profile.id, "LOGIN_FAILED", { reason: "BAD_PASSWORD", attempts: next.failed_attempts });
      if (next.justLocked) {
        await logSecurity(profile.id, "ACCOUNT_LOCKED", { minutes: LOCK_MINUTES });
        return { ok: false, error: `Akun terkunci, coba lagi dalam ${LOCK_MINUTES} menit` };
      }
    } else {
      await logSecurity(null, "LOGIN_FAILED", { reason: "UNKNOWN_EMAIL" });
    }
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    await logSecurity(profile?.id ?? null, "LOGIN_FAILED", { reason: "INACTIVE" });
    return { ok: false, error: "Akun tidak aktif, hubungi admin sistem" };
  }

  await admin
    .from("profiles")
    .update({ failed_attempts: 0, locked_until: null, last_login_at: now.toISOString() })
    .eq("id", profile.id);
  await logSecurity(profile.id, "LOGIN_SUCCESS");
  await markLoginTime();
  redirect("/dashboard");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (user) await logSecurity(user.id, "LOGOUT");
  await supabase.auth.signOut();
  (await cookies()).delete(LOGIN_AT_COOKIE);
  redirect("/login");
}

export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const generic: ActionResult = { ok: true, message: "Jika email terdaftar, link reset telah dikirim" };
  if (!email) return { ok: false, error: "Email wajib diisi" };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id,is_active").eq("email", email).maybeSingle();
  if (profile?.is_active) {
    const supabase = await createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/auth/callback?next=/reset-password` });
    await logSecurity(profile.id, "PASSWORD_RESET_REQUESTED");
  }
  return generic;
}

async function applyNewPassword(userId: string, password: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return /same|different/i.test(error.message) ? "Password baru harus berbeda" : error.message;
  }
  // akhiri semua sesi lain pengguna ini
  await supabase.auth.signOut({ scope: "others" });
  const admin = createAdminClient();
  await admin.from("profiles").update({ must_change_password: false, failed_attempts: 0, locked_until: null }).eq("id", userId);
  return null;
}

/** Ganti password dari halaman Ganti Password (wajib saat login pertama, atau sukarela). */
export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login kembali" };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const policy = validatePassword(next, current);
  if (policy) return { ok: false, error: policy, fieldErrors: { next: policy } };
  if (next !== confirm) return { ok: false, error: "Konfirmasi password tidak sama", fieldErrors: { confirm: "Tidak sama" } };

  // verifikasi password saat ini tanpa mengganti sesi aktif
  const { error: verifyError } = await createStatelessClient().auth.signInWithPassword({ email: user.email, password: current });
  if (verifyError) return { ok: false, error: "Password saat ini salah", fieldErrors: { current: "Salah" } };

  const err = await applyNewPassword(user.id, next);
  if (err) return { ok: false, error: err };
  await logSecurity(user.id, "PASSWORD_CHANGED");
  redirect("/dashboard");
}

/** Menyelesaikan reset password setelah pengguna membuka link email (sesi pemulihan dibuat di /auth/callback). */
export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const policy = validatePassword(next);
  if (policy) return { ok: false, error: policy, fieldErrors: { next: policy } };
  if (next !== confirm) return { ok: false, error: "Konfirmasi password tidak sama", fieldErrors: { confirm: "Tidak sama" } };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Link tidak berlaku" };

  const err = await applyNewPassword(data.user.id, next);
  if (err) return { ok: false, error: err };
  await logSecurity(data.user.id, "PASSWORD_RESET_DONE");
  await markLoginTime();
  redirect("/dashboard");
}

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login kembali" };
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { ok: false, error: "Nama wajib diisi", fieldErrors: { name: "Wajib diisi" } };

  // hanya nama dan telepon; field lain (role, cabang, email) sengaja diabaikan
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ name, phone: phone || null }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Profil diperbarui" };
}
