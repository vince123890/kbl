import type { MasterDef } from "@/lib/masters";

interface PgLikeError {
  code?: string;
  message?: string;
  details?: string;
}

/** Terjemahkan galat Postgres/PostgREST menjadi pesan yang dapat dipahami pengguna. */
export function friendlyDbError(err: PgLikeError, def?: MasterDef): string {
  const msg = err.message ?? "Terjadi kesalahan";
  switch (err.code) {
    case "23505": {
      const hay = `${err.details ?? ""} ${msg}`;
      if (def?.uniqueMessages) {
        for (const [col, text] of Object.entries(def.uniqueMessages)) {
          if (hay.includes(col)) return text;
        }
      }
      if (/profiles_email_unique|email/.test(hay)) return "Email sudah terdaftar";
      return "Data dengan nilai yang sama sudah ada";
    }
    case "23514":
      if (/branches_hq_active/.test(msg)) return "Cabang pusat tidak dapat dinonaktifkan";
      return "Nilai tidak memenuhi aturan data";
    case "23502":
      return "Ada isian wajib yang kosong";
    case "42501":
      return "Anda tidak berwenang melakukan aksi ini";
    case "P0001":
      return msg; // pesan dari raise exception pada trigger sudah berbahasa pengguna
    default:
      return /row-level security/.test(msg) ? "Anda tidak berwenang melakukan aksi ini" : msg;
  }
}
