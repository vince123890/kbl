"use server";

import { revalidatePath } from "next/cache";
import { authorize, type ActionResult } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMaster, parseMasterInput } from "@/lib/masters";
import { friendlyDbError } from "@/lib/pg-errors";
import { parseCsvObjects } from "@/lib/csv";

const CONFLICT = "Data diubah oleh pengguna lain, muat ulang halaman lalu coba lagi";

/** Pesan konflik versi dengan nama pengubah terakhir bila dapat diketahui. */
async function conflictMessage(table: string, id: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("updated_by").eq("id", id).maybeSingle();
  if (data?.updated_by) {
    const { data: p } = await supabase.from("profiles").select("name").eq("id", data.updated_by).maybeSingle();
    if (p?.name) return `Data diubah oleh ${p.name}, muat ulang?`;
  }
  return CONFLICT;
}

export async function saveMasterAction(
  slug: string,
  id: string | null,
  version: number | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const def = getMaster(slug);
  if (!def) return { ok: false, error: "Master tidak dikenal" };
  const auth = await authorize("master.write");
  if (auth.error) return auth.error;

  const supabase = await createClient();
  const { data: branches } = await supabase.from("branches").select("id");
  const raw = Object.fromEntries(formData.entries());
  const { values, errors } = parseMasterInput(
    def,
    raw,
    id ? "edit" : "create",
    (branches ?? []).map((b) => b.id),
  );
  if (Object.keys(errors).length) return { ok: false, error: "Periksa isian yang bertanda merah", fieldErrors: errors };

  if (id) {
    if (version === null) return { ok: false, error: CONFLICT };
    const { data, error } = await supabase
      .from(def.table)
      .update(values)
      .eq("id", id)
      .eq("row_version", version)
      .select("id");
    if (error) return { ok: false, error: friendlyDbError(error, def) };
    if (!data?.length) return { ok: false, error: await conflictMessage(def.table, id) };
  } else {
    const { error } = await supabase.from(def.table).insert(values);
    if (error) return { ok: false, error: friendlyDbError(error, def) };
  }
  revalidatePath(`/master/${slug}`);
  return { ok: true, message: id ? `${def.singular} diperbarui` : `${def.singular} ditambahkan` };
}

export async function toggleActiveAction(
  slug: string,
  id: string,
  version: number,
  active: boolean,
): Promise<ActionResult> {
  const def = getMaster(slug);
  if (!def) return { ok: false, error: "Master tidak dikenal" };
  const auth = await authorize("master.write");
  if (auth.error) return auth.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(def.table)
    .update({ is_active: active })
    .eq("id", id)
    .eq("row_version", version)
    .select("id");
  if (error) return { ok: false, error: friendlyDbError(error, def) };
  if (!data?.length) return { ok: false, error: await conflictMessage(def.table, id) };
  revalidatePath(`/master/${slug}`);
  return { ok: true, message: active ? "Diaktifkan kembali" : "Dinonaktifkan" };
}

export async function updateOdometerAction(
  vehicleId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await authorize("master.write");
  if (auth.error) return auth.error;

  const value = Number(String(formData.get("odometer") ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: "Odometer harus berupa angka ≥ 0", fieldErrors: { odometer: "Angka tidak valid" } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicles").update({ odometer: value }).eq("id", vehicleId).select("id");
  if (error) return { ok: false, error: friendlyDbError(error), fieldErrors: { odometer: friendlyDbError(error) } };
  if (!data?.length) return { ok: false, error: "Kendaraan tidak ditemukan" };
  revalidatePath("/master/vehicles");
  revalidatePath(`/master/vehicles/${vehicleId}`);
  return { ok: true, message: "Odometer diperbarui" };
}

// kolom CSV (huruf kecil) menuju nama field master. "cabang" berisi kode cabang.
const IMPORT_COLUMNS: Record<string, Record<string, string>> = {
  vehicles: { nopol: "plate_no", tipe: "type", model: "model", tahun: "year", cabang: "branch_id", odometer: "odometer", status: "status", catatan: "notes" },
  spareparts: { kode: "code", nama: "name", kategori: "category", satuan: "uom", stok_min: "min_stock", deskripsi: "description" },
};

/** Impor massal master (kendaraan, sparepart) dari CSV. Semua baris divalidasi; bila ada galat tidak ada yang disimpan. */
export async function importMasterAction(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const def = getMaster(slug);
  const cols = IMPORT_COLUMNS[slug];
  if (!def || !cols) return { ok: false, error: "Impor CSV tidak tersedia untuk master ini" };
  const auth = await authorize("master.write");
  if (auth.error) return auth.error;
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Pilih berkas CSV terlebih dahulu" };
  const rows = parseCsvObjects(await file.text());
  if (!rows.length) return { ok: false, error: `Berkas kosong atau header tidak dikenali (kolom: ${Object.keys(cols).join("; ")})` };
  if (rows.length > 1000) return { ok: false, error: "Maksimal 1.000 baris per unggah" };

  const supabase = await createClient();
  const { data: branches } = await supabase.from("branches").select("id,code");
  const branchByCode = new Map((branches ?? []).map((b) => [String(b.code).toLowerCase(), b.id as string]));

  const errors: string[] = [];
  const inserts: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const keyField = slug === "vehicles" ? "plate_no" : "code";
  rows.forEach((r, i) => {
    const raw: Record<string, string> = {};
    for (const [csv, field] of Object.entries(cols)) {
      const v = (r[csv] ?? "").trim();
      if (field === "branch_id" && v) {
        const id = branchByCode.get(v.toLowerCase());
        if (!id) {
          errors.push(`Baris ${i + 2}: kode cabang "${v}" tidak dikenal`);
          continue;
        }
        raw[field] = id;
      } else if (v) raw[field] = v;
    }
    const { values, errors: fe } = parseMasterInput(def, raw, "create", [...branchByCode.values()]);
    for (const [f, m] of Object.entries(fe)) errors.push(`Baris ${i + 2} (${f}): ${m}`);
    const key = String(values[keyField] ?? "").toUpperCase().replace(/\s/g, "");
    if (key && seen.has(key)) errors.push(`Baris ${i + 2}: ${values[keyField]} dobel dalam berkas`);
    seen.add(key);
    inserts.push(values);
  });
  if (errors.length) {
    return { ok: false, error: `${errors.slice(0, 6).join("; ")}${errors.length > 6 ? ` (+${errors.length - 6} galat lain)` : ""}. Tidak ada data yang disimpan.` };
  }

  const { error } = await supabase.from(def.table).insert(inserts);
  if (error) return { ok: false, error: friendlyDbError(error, def) };
  revalidatePath(`/master/${slug}`);
  return { ok: true, message: `${inserts.length} ${def.singular.toLowerCase()} diimpor` };
}
