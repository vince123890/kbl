"use server";

import { revalidatePath } from "next/cache";
import { authorize, type ActionResult } from "@/lib/auth/session";
import { callRpc, text, textOrNull } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/pg-errors";
import { fromLocalInput } from "@/lib/format";
import { parseCsvObjects } from "@/lib/csv";

// ---------------------------------------------------------------- rencana perawatan
interface PartInput {
  sparepart_id: string;
  qty: string;
}

function intOrNull(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

/** Buat rencana (satu per kendaraan terpilih) atau ubah satu rencana. */
export async function savePlanAction(planId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const auth = await authorize("plan.write");
  if (auth.error) return auth.error;

  const task = text(fd, "task_name");
  if (!task) return { ok: false, error: "Nama tugas wajib diisi", fieldErrors: { task_name: "Wajib diisi" } };
  const days = intOrNull(text(fd, "interval_days"));
  const km = intOrNull(text(fd, "interval_km"));
  if (Number.isNaN(days) || Number.isNaN(km)) return { ok: false, error: "Interval harus bilangan bulat" };
  if (!days && !km) return { ok: false, error: "Isi interval hari atau interval km (minimal salah satu)", fieldErrors: { interval_days: "Isi salah satu" } };
  const leadDays = intOrNull(text(fd, "lead_days"));
  const leadKm = intOrNull(text(fd, "lead_km"));
  if (Number.isNaN(leadDays) || Number.isNaN(leadKm)) return { ok: false, error: "Lead time harus bilangan bulat" };
  const lastKmRaw = text(fd, "last_done_km");
  const lastKm = lastKmRaw ? Number(lastKmRaw.replace(",", ".")) : null;
  if (lastKm !== null && (!Number.isFinite(lastKm) || lastKm < 0)) return { ok: false, error: "Km terakhir tidak valid" };

  let parts: PartInput[] = [];
  try {
    parts = (JSON.parse(text(fd, "parts") || "[]") as PartInput[]).filter((p) => p.sparepart_id);
  } catch {
    return { ok: false, error: "Daftar part tidak valid" };
  }
  for (const p of parts) if (!(Number(p.qty.replace(",", ".")) > 0)) return { ok: false, error: "Qty part harus lebih dari 0" };

  const values = {
    task_name: task,
    interval_days: days,
    interval_km: km,
    last_done_at: textOrNull(fd, "last_done_at"),
    last_done_km: lastKm,
    vendor_id: textOrNull(fd, "vendor_id"),
    lead_days: leadDays,
    lead_km: leadKm,
    notes: textOrNull(fd, "notes"),
  };

  const supabase = await createClient();
  const vehicleIds = planId ? [null] : fd.getAll("vehicle_ids").filter((x): x is string => typeof x === "string" && !!x);
  if (!planId && !vehicleIds.length) return { ok: false, error: "Pilih minimal satu kendaraan", fieldErrors: { vehicle_ids: "Pilih kendaraan" } };

  const ids: string[] = [];
  if (planId) {
    const { error } = await supabase.from("maintenance_plans").update(values).eq("id", planId);
    if (error) return { ok: false, error: friendlyDbError(error) };
    ids.push(planId);
  } else {
    for (const v of vehicleIds) {
      const { data, error } = await supabase
        .from("maintenance_plans")
        .insert({ ...values, vehicle_id: v, branch_id: auth.user.branchId })
        .select("id")
        .single();
      if (error) return { ok: false, error: friendlyDbError(error) };
      ids.push(data.id);
    }
  }
  for (const id of ids) {
    await supabase.from("maintenance_plan_parts").delete().eq("plan_id", id);
    if (parts.length) {
      const { error } = await supabase.from("maintenance_plan_parts").insert(parts.map((p) => ({ plan_id: id, sparepart_id: p.sparepart_id, qty: Number(p.qty.replace(",", ".")) })));
      if (error) return { ok: false, error: friendlyDbError(error) };
    }
  }
  revalidatePath("/maintenance/plans");
  return { ok: true, message: planId ? "Rencana diperbarui" : `${ids.length} rencana dibuat` };
}

export async function togglePlanAction(planId: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize("plan.write");
  if (auth.error) return auth.error;
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_plans").update({ is_active: active }).eq("id", planId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/maintenance/plans");
  return { ok: true, message: active ? "Rencana diaktifkan" : "Rencana dinonaktifkan. WO aktif tidak ikut dibatalkan." };
}

/** Impor massal rencana dari CSV: nopol; tugas; interval_hari; interval_km; terakhir_tanggal; terakhir_km. */
export async function importPlansAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const auth = await authorize("plan.write");
  if (auth.error) return auth.error;
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Pilih berkas CSV terlebih dahulu" };
  const rows = parseCsvObjects(await file.text());
  if (!rows.length) return { ok: false, error: "Berkas kosong atau header tidak dikenali" };
  if (rows.length > 500) return { ok: false, error: "Maksimal 500 baris per unggah" };

  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("id,plate_norm").eq("branch_id", auth.user.branchId);
  const byPlate = new Map((vehicles ?? []).map((v) => [v.plate_norm as string, v.id as string]));
  const inserts: Record<string, unknown>[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const plate = (r.nopol ?? "").toUpperCase().replace(/\s/g, "");
    const vid = byPlate.get(plate);
    if (!vid) return void errors.push(`Baris ${line}: nopol "${r.nopol}" tidak ditemukan di cabang Anda`);
    if (!r.tugas) return void errors.push(`Baris ${line}: tugas wajib diisi`);
    const d = intOrNull(r.interval_hari ?? "");
    const k = intOrNull(r.interval_km ?? "");
    if (Number.isNaN(d) || Number.isNaN(k) || (!d && !k)) return void errors.push(`Baris ${line}: isi interval_hari atau interval_km (bilangan bulat)`);
    const lk = r.terakhir_km ? Number(r.terakhir_km.replace(",", ".")) : null;
    if (lk !== null && !Number.isFinite(lk)) return void errors.push(`Baris ${line}: terakhir_km tidak valid`);
    inserts.push({
      vehicle_id: vid,
      branch_id: auth.user.branchId,
      task_name: r.tugas,
      interval_days: d,
      interval_km: k,
      last_done_at: r.terakhir_tanggal || null,
      last_done_km: lk,
    });
  });
  if (errors.length) return { ok: false, error: `${errors.slice(0, 5).join("; ")}${errors.length > 5 ? ` (+${errors.length - 5} galat lain)` : ""}. Tidak ada data yang disimpan.` };
  const { error } = await supabase.from("maintenance_plans").insert(inserts);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/maintenance/plans");
  return { ok: true, message: `${inserts.length} rencana diimpor` };
}

// ---------------------------------------------------------------- work order
interface WoPartInput {
  sparepart_id: string;
  qty: string;
  location_id?: string;
}

export async function saveWoAction(
  woId: string | null,
  _prev: ActionResult<{ id: string; warnings: string[] }> | null,
  fd: FormData,
): Promise<ActionResult<{ id: string; warnings: string[] }>> {
  let parts: WoPartInput[] = [];
  try {
    parts = (JSON.parse(text(fd, "parts") || "[]") as WoPartInput[]).filter((p) => p.sparepart_id);
  } catch {
    return { ok: false, error: "Daftar part tidak valid" };
  }
  const r = await callRpc<{ id: string; warnings: string[] }>("wo_save", {
    p_id: woId,
    p_type: textOrNull(fd, "type"),
    p_priority: textOrNull(fd, "priority"),
    p_vehicle: textOrNull(fd, "vehicle_id"),
    p_start: fromLocalInput(text(fd, "start")),
    p_end: fromLocalInput(text(fd, "end")),
    p_vendor: textOrNull(fd, "vendor_id"),
    p_assignee: textOrNull(fd, "assignee_id"),
    p_description: textOrNull(fd, "description"),
    p_parts: parts.map((p) => ({ ...p, location_id: p.location_id || null })),
    p_source: textOrNull(fd, "source_note"),
    p_version: textOrNull(fd, "version") ? Number(text(fd, "version")) : null,
  });
  if (!r.ok) return r;
  return { ok: true, data: r.data as { id: string; warnings: string[] }, message: "Work Order tersimpan" };
}

export async function startWoAction(id: string): Promise<ActionResult> {
  return callRpc("wo_start", { p_id: id }, { message: "Pekerjaan dimulai. Status kendaraan: Dalam Perawatan" });
}

export async function completeWoAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const odo = text(fd, "odometer");
  const n = odo ? Number(odo.replace(",", ".")) : null;
  if (n !== null && (!Number.isFinite(n) || n < 0)) return { ok: false, error: "Odometer harus berupa angka ≥ 0", fieldErrors: { odometer: "Angka tidak valid" } };
  return callRpc("wo_complete", { p_id: id, p_odometer: n, p_note: textOrNull(fd, "note") }, { message: "Work Order selesai" });
}

export async function cancelWoAction(id: string, reason: string): Promise<ActionResult> {
  return callRpc("wo_cancel", { p_id: id, p_reason: reason }, { message: "Work Order dibatalkan" });
}

export async function resubmitEmergencyAction(id: string): Promise<ActionResult> {
  return callRpc("wo_resubmit_emergency", { p_id: id }, { message: "Validasi diajukan ulang" });
}

// ---------------------------------------------------------------- perubahan jadwal
export async function requestScheduleChangeAction(woId: string, _prev: ActionResult<{ notice?: string }> | null, fd: FormData): Promise<ActionResult<{ notice?: string }>> {
  const start = fromLocalInput(text(fd, "new_start"));
  if (!start) return { ok: false, error: "Jadwal baru wajib diisi", fieldErrors: { new_start: "Wajib diisi" } };
  const r = await callRpc<{ notice?: string }>("schedule_change_request", {
    p_wo: woId,
    p_new_start: start,
    p_new_end: fromLocalInput(text(fd, "new_end")),
    p_reason: textOrNull(fd, "reason_code_id"),
    p_note: textOrNull(fd, "reason_note"),
  });
  if (!r.ok) return r;
  const notice = (r.data as { notice?: string } | null)?.notice;
  return { ok: true, data: { notice }, message: notice ? `Diajukan. ${notice}` : "Perubahan jadwal diajukan untuk approval" };
}

export async function resubmitScheduleChangeAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const start = fromLocalInput(text(fd, "new_start"));
  if (!start) return { ok: false, error: "Jadwal baru wajib diisi" };
  return callRpc(
    "schedule_change_resubmit",
    { p_id: id, p_new_start: start, p_new_end: fromLocalInput(text(fd, "new_end")), p_reason: textOrNull(fd, "reason_code_id"), p_note: textOrNull(fd, "reason_note") },
    { message: "Pengajuan diperbaiki dan diajukan ulang" },
  );
}

export async function withdrawScheduleChangeAction(id: string): Promise<ActionResult> {
  return callRpc("schedule_change_withdraw", { p_id: id }, { message: "Pengajuan ditarik kembali" });
}
