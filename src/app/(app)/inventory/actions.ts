"use server";

import type { ActionResult } from "@/lib/auth/session";
import { callRpc, text, textOrNull } from "@/lib/rpc";
import { parseCsvObjects } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

interface LineInput {
  sparepart_id: string;
  qty: string;
  notes?: string;
}

/** Simpan draft mutasi; bila intent=submit langsung diajukan. Mengembalikan id dokumen. */
export async function saveMovementAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  let lines: LineInput[] = [];
  try {
    lines = JSON.parse(text(fd, "lines") || "[]") as LineInput[];
  } catch {
    return { ok: false, error: "Daftar item tidak valid" };
  }
  lines = lines.filter((l) => l.sparepart_id || l.qty);
  if (!lines.length) return { ok: false, error: "Tambahkan minimal satu item" };
  if (lines.some((l) => !l.sparepart_id)) return { ok: false, error: "Pilih sparepart pada setiap baris item" };

  const id = textOrNull(fd, "id");
  const version = textOrNull(fd, "version");
  const saved = await callRpc<string>("stock_doc_save", {
    p_id: id,
    p_type: text(fd, "type"),
    p_branch: textOrNull(fd, "branch_id"),
    p_date: textOrNull(fd, "doc_date"),
    p_vehicle: textOrNull(fd, "vehicle_id"),
    p_wo: textOrNull(fd, "work_order_id"),
    p_from: textOrNull(fd, "from_location_id"),
    p_to: textOrNull(fd, "to_location_id"),
    p_notes: textOrNull(fd, "notes"),
    p_lines: lines,
    p_version: version ? Number(version) : null,
  });
  if (!saved.ok) return saved;
  const docId = saved.data as string;

  if (text(fd, "intent") === "submit") {
    const s = await callRpc("stock_doc_submit", { p_id: docId });
    if (!s.ok) return { ok: false, error: `Draft tersimpan, tetapi belum dapat diajukan: ${s.error}`, fieldErrors: { saved_id: docId } };
    return { ok: true, data: { id: docId }, message: "Mutasi diajukan untuk approval" };
  }
  return { ok: true, data: { id: docId }, message: "Draft tersimpan" };
}

export async function submitMovementAction(id: string): Promise<ActionResult> {
  return callRpc("stock_doc_submit", { p_id: id }, { message: "Mutasi diajukan untuk approval" });
}

export async function cancelMovementAction(id: string, reason: string): Promise<ActionResult> {
  return callRpc("stock_doc_cancel", { p_id: id, p_reason: reason }, { message: "Mutasi dibatalkan" });
}

export async function reverseMovementAction(id: string): Promise<ActionResult<string>> {
  return callRpc<string>("stock_doc_reverse", { p_id: id }, { message: "Dokumen pembalik dibuat sebagai draft" });
}

// ---------------------------------------------------------------- opname
export async function openCountAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const r = await callRpc<string>("count_open", {
    p_location: text(fd, "location_id"),
    p_type: text(fd, "type") || "PERIODIC",
    p_category: textOrNull(fd, "category"),
    p_notes: textOrNull(fd, "notes"),
  });
  if (!r.ok) return r;
  return { ok: true, data: { id: r.data as string }, message: "Sesi opname dibuka" };
}

export interface CountLineInput {
  sparepart_id: string;
  counted_qty?: string;
  not_counted?: boolean;
  reason_code_id?: string;
  reason_note?: string;
}

export async function enterCountAction(countId: string, lines: CountLineInput[]): Promise<ActionResult> {
  return callRpc("count_enter", { p_id: countId, p_lines: lines });
}

export async function submitCountAction(countId: string): Promise<ActionResult> {
  return callRpc("count_submit", { p_id: countId }, { message: "Opname diajukan untuk approval" });
}

export async function cancelCountAction(countId: string, reason: string): Promise<ActionResult> {
  return callRpc("count_cancel", { p_id: countId, p_reason: reason }, { message: "Sesi opname dibatalkan" });
}

/** Unggah CSV hasil hitung (kolom: kode, fisik, alasan, keterangan). Menyimpan lalu menampilkan ringkasan selisih. */
export async function uploadCountCsvAction(countId: string, _prev: ActionResult<{ lines: number; diffs: number }> | null, fd: FormData): Promise<ActionResult<{ lines: number; diffs: number }>> {
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Pilih berkas CSV terlebih dahulu" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Berkas terlalu besar (maksimal 2 MB)" };
  const rows = parseCsvObjects(await file.text());
  if (!rows.length) return { ok: false, error: "Berkas kosong atau header tidak dikenali (kolom: kode; fisik; alasan; keterangan)" };

  const supabase = await createClient();
  const { data: lines } = await supabase
    .from("stock_count_lines")
    .select("sparepart_id,system_qty,spareparts(code)")
    .eq("count_id", countId);
  const byCode = new Map(((lines ?? []) as unknown as { sparepart_id: string; system_qty: string; spareparts: { code: string } }[]).map((l) => [l.spareparts.code.toLowerCase(), l]));
  const { data: reasons } = await supabase.from("reason_codes").select("id,code,name").eq("is_active", true);
  const reasonBy = new Map((reasons ?? []).flatMap((r) => [[r.code.toLowerCase(), r.id] as const, [r.name.toLowerCase(), r.id] as const]));

  const payload: CountLineInput[] = [];
  let diffs = 0;
  for (const [i, r] of rows.entries()) {
    const code = (r.kode ?? "").toLowerCase();
    const line = byCode.get(code);
    if (!line) return { ok: false, error: `Baris ${i + 2}: kode "${r.kode}" tidak ada pada sesi ini` };
    const fisik = (r.fisik ?? "").trim();
    if (fisik === "") continue;
    const reason = (r.alasan ?? "").trim() ? reasonBy.get((r.alasan ?? "").trim().toLowerCase()) : undefined;
    if ((r.alasan ?? "").trim() && !reason) return { ok: false, error: `Baris ${i + 2}: alasan "${r.alasan}" tidak dikenal (pakai kode atau nama kategori alasan)` };
    if (Number(fisik.replace(",", ".")) !== Number(line.system_qty)) diffs++;
    payload.push({ sparepart_id: line.sparepart_id, counted_qty: fisik, reason_code_id: reason, reason_note: r.keterangan || undefined });
  }
  if (!payload.length) return { ok: false, error: "Tidak ada baris dengan qty fisik terisi" };
  const saved = await callRpc("count_enter", { p_id: countId, p_lines: payload });
  if (!saved.ok) return saved;
  return { ok: true, data: { lines: payload.length, diffs }, message: `${payload.length} baris tersimpan, ${diffs} berselisih. Lengkapi alasan lalu ajukan.` };
}
