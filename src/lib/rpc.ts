import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCurrentUser, type ActionResult } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/pg-errors";
import { dispatchQueued } from "@/lib/notify-dispatch";

interface RpcOptions {
  /** halaman yang perlu dimuat ulang setelah sukses */
  paths?: string[];
  message?: string;
}

/**
 * Memanggil fungsi Postgres atas nama pengguna login. Otorisasi dan aturan bisnis ada di fungsi itu sendiri
 * (security definer + pemeriksaan permission), jadi server action cukup meneruskan dan menerjemahkan galat.
 * Fungsi yang mengembalikan {ok:false,error} (mis. posting gagal) diteruskan sebagai galat.
 */
export async function callRpc<T = unknown>(
  fn: string,
  args: Record<string, unknown>,
  opts: RpcOptions = {},
): Promise<ActionResult<T>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login kembali" };
  if (user.mustChangePassword) return { ok: false, error: "Ganti password terlebih dahulu" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: friendlyDbError(error) };

  const body = data as { ok?: boolean; error?: string; message?: string } | null;
  if (body && typeof body === "object" && body.ok === false) return { ok: false, error: body.error ?? "Aksi gagal diproses" };

  after(() => dispatchQueued().catch(() => undefined)); // kirim notifikasi antre di luar jalur respons
  revalidatePath("/", "layout"); // status dokumen memengaruhi daftar, detail, dashboard, dan antrean sekaligus
  for (const p of opts.paths ?? []) revalidatePath(p);
  return { ok: true, data: data as T, message: opts.message ?? body?.message };
}

/** Teks wajib dari FormData ("" bila kosong). */
export function text(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** Teks opsional dari FormData (null bila kosong). */
export function textOrNull(fd: FormData, name: string): string | null {
  return text(fd, name) || null;
}
