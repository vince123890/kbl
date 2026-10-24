import type { SupabaseClient } from "@supabase/supabase-js";

/** Memuat nama untuk sekumpulan id (profil, kendaraan, dst) dalam satu query. */
export async function nameMap(
  supabase: SupabaseClient,
  table: "profiles" | "vehicles" | "spareparts" | "locations" | "vendors" | "branches" | "reason_codes",
  ids: (string | null | undefined)[],
  col = table === "vehicles" ? "plate_no" : "name",
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from(table).select(`id,${col}`).in("id", unique);
  return new Map(((data ?? []) as unknown as Record<string, string>[]).map((r) => [r.id, r[col]]));
}

/** Parameter pencarian aman untuk filter PostgREST `or(...)`. */
export function cleanQuery(v: string): string {
  return v.replace(/[,()%*\\]/g, " ").trim();
}

export function one(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

export function pageOf(sp: Record<string, string | string[] | undefined>): number {
  return Math.max(1, Number(one(sp, "page")) || 1);
}

/** Membuat pembuat href halaman berikutnya yang mempertahankan filter. */
export function hrefBuilder(base: string, sp: Record<string, string | string[] | undefined>) {
  return (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") next.set(k, v);
    next.set("page", String(p));
    return `${base}?${next.toString()}`;
  };
}
