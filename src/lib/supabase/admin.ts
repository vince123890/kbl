import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Klien service_role: melewati RLS. Hanya untuk server action setelah pemeriksaan permission
 * (login/penguncian, pembuatan akun auth, event keamanan). Jangan pernah diimpor di komponen klien.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Klien anon tanpa penyimpanan sesi, dipakai untuk memverifikasi password tanpa mengganti sesi aktif. */
export function createStatelessClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
