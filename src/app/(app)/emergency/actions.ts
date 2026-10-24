"use server";

import { authorize, type ActionResult } from "@/lib/auth/session";
import { callRpc, text, textOrNull } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/pg-errors";
import { revalidatePath } from "next/cache";

export interface IncidentPayload {
  incident: { id: string; incident_no: string; status: string; type: string; reported_at: string };
  playbook: { title: string; steps: string[] };
  contacts: { role_label: string; name: string; phone: string; service_hours: string | null }[];
}

export interface ReportInput {
  vehicleId: string;
  type: string;
  lat: number | null;
  lng: number | null;
  idem: string;
}

/** Lapor darurat: hanya kendaraan dan jenis kejadian wajib. Idempoten lewat `idem`. */
export async function reportIncidentAction(input: ReportInput): Promise<ActionResult<IncidentPayload>> {
  const r = await callRpc<IncidentPayload>("incident_report", {
    p_vehicle: input.vehicleId,
    p_type: input.type,
    p_lat: input.lat,
    p_lng: input.lng,
    p_address: null,
    p_description: null,
    p_casualties: null,
    p_idem: input.idem,
    p_driver: null,
  });
  return r;
}

/** Pusat mencatat insiden atas laporan telepon pengemudi. */
export async function recordIncidentAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const cas = text(fd, "casualties");
  const r = await callRpc<IncidentPayload>("incident_report", {
    p_vehicle: text(fd, "vehicle_id"),
    p_type: text(fd, "type"),
    p_lat: null,
    p_lng: null,
    p_address: textOrNull(fd, "address"),
    p_description: textOrNull(fd, "description"),
    p_casualties: cas ? Number(cas) : null,
    p_idem: null,
    p_driver: textOrNull(fd, "driver_id"),
  });
  if (!r.ok) return r;
  return { ok: true, data: { id: (r.data as IncidentPayload).incident.id }, message: "Insiden dicatat" };
}

export async function addIncidentDetailAction(incidentId: string, description: string, casualties: number | null): Promise<ActionResult> {
  return callRpc("incident_add_detail", { p_id: incidentId, p_description: description || null, p_casualties: casualties }, { message: "Keterangan ditambahkan" });
}

export async function ackIncidentAction(id: string): Promise<ActionResult> {
  return callRpc("incident_ack", { p_id: id }, { message: "Insiden dikonfirmasi" });
}

export async function incidentLogAction(id: string, action: "ASSIGN_TOW" | "ASSIGN_TECH" | "REPLACEMENT_VEHICLE" | "NOTE", note: string): Promise<ActionResult> {
  return callRpc("incident_log_action", { p_id: id, p_action: action, p_note: note }, { message: "Tindak lanjut dicatat" });
}

export async function resolveIncidentAction(id: string, note: string): Promise<ActionResult> {
  return callRpc("incident_resolve", { p_id: id, p_note: note }, { message: "Insiden diselesaikan" });
}

export async function closeIncidentAction(id: string): Promise<ActionResult> {
  return callRpc("incident_close", { p_id: id }, { message: "Insiden ditutup" });
}

export async function falseReportAction(id: string, reason: string): Promise<ActionResult> {
  return callRpc("incident_mark_false", { p_id: id, p_reason: reason }, { message: "Ditandai sebagai laporan keliru" });
}

export async function correctTypeAction(id: string, type: string): Promise<ActionResult> {
  return callRpc("incident_correct_type", { p_id: id, p_type: type }, { message: "Jenis kejadian dikoreksi" });
}

export async function createEmergencyWoAction(id: string, _prev: ActionResult<string> | null, fd: FormData): Promise<ActionResult<string>> {
  const r = await callRpc<string>("incident_create_wo", { p_id: id, p_assignee: textOrNull(fd, "assignee_id") }, { message: "WO emergensi dibuat" });
  return r;
}

// ---------------------------------------------------------------- kontak & langkah cepat
export async function saveContactAction(id: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const auth = await authorize("contact.manage");
  if (auth.error) return auth.error;
  const scope = text(fd, "scope") || "GLOBAL";
  const priority = Number(text(fd, "priority") || "10");
  if (!Number.isInteger(priority) || priority < 1) return { ok: false, error: "Prioritas harus bilangan bulat ≥ 1", fieldErrors: { priority: "Angka ≥ 1" } };
  const values = {
    scope,
    branch_id: scope === "BRANCH" ? textOrNull(fd, "branch_id") : null,
    region: scope === "REGION" ? textOrNull(fd, "region") : null,
    role_label: text(fd, "role_label"),
    name: text(fd, "name"),
    phone: text(fd, "phone"),
    priority,
    service_hours: textOrNull(fd, "service_hours"),
    notes: textOrNull(fd, "notes"),
  };
  const errors: Record<string, string> = {};
  if (!values.role_label) errors.role_label = "Wajib diisi";
  if (!values.name) errors.name = "Wajib diisi";
  if (!values.phone) errors.phone = "Wajib diisi";
  if (Object.keys(errors).length) return { ok: false, error: "Periksa isian yang bertanda merah", fieldErrors: errors };

  const supabase = await createClient();
  const { error } = id ? await supabase.from("emergency_contacts").update(values).eq("id", id) : await supabase.from("emergency_contacts").insert(values);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/emergency/contacts");
  return { ok: true, message: id ? "Kontak diperbarui" : "Kontak ditambahkan" };
}

export async function toggleContactAction(id: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize("contact.manage");
  if (auth.error) return auth.error;
  const { error } = await (await createClient()).from("emergency_contacts").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/emergency/contacts");
  return { ok: true, message: active ? "Kontak diaktifkan" : "Kontak dinonaktifkan" };
}

export async function savePlaybookAction(id: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const auth = await authorize("contact.manage");
  if (auth.error) return auth.error;
  let steps: string[] = [];
  try {
    steps = (JSON.parse(text(fd, "steps") || "[]") as string[]).map((s) => s.trim()).filter(Boolean);
  } catch {
    return { ok: false, error: "Daftar langkah tidak valid" };
  }
  if (!steps.length) return { ok: false, error: "Tambahkan minimal satu langkah" };
  const title = text(fd, "title");
  if (!title) return { ok: false, error: "Judul wajib diisi", fieldErrors: { title: "Wajib diisi" } };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("emergency_playbooks").update({ title, steps }).eq("id", id)
    : await supabase.from("emergency_playbooks").insert({ incident_type: text(fd, "incident_type"), title, steps });
  if (error) return { ok: false, error: /one_active/.test(error.message) ? "Jenis kejadian ini sudah memiliki langkah cepat aktif" : friendlyDbError(error) };
  revalidatePath("/emergency/playbooks");
  return { ok: true, message: "Langkah cepat disimpan" };
}

export async function togglePlaybookAction(id: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize("contact.manage");
  if (auth.error) return auth.error;
  const { error } = await (await createClient()).from("emergency_playbooks").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: /one_active/.test(error.message) ? "Nonaktifkan versi aktif lebih dulu" : friendlyDbError(error) };
  revalidatePath("/emergency/playbooks");
  return { ok: true, message: active ? "Diaktifkan" : "Dinonaktifkan; jenis ini memakai langkah cepat Umum" };
}
