// Data transaksi demo: stok awal, rencana, WO, perubahan jadwal, opname, dan satu insiden.
// Semua dibuat lewat fungsi resmi (login sebagai user demo), jadi aturan approval, ledger, dan notifikasi ikut teruji.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_CONTACTS, DEMO_PASSWORD, DEMO_PLANS, DEMO_STOCK } from "./demo-data";

interface Ctx {
  url: string;
  anonKey: string;
  service: SupabaseClient;
}

const must = <T>(r: { data: T | null; error: { message: string } | null }, ctx: string): NonNullable<T> => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data as NonNullable<T>;
};

const one = <T = { id: string }>(r: { data: unknown; error: { message: string } | null }, ctx: string): T => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data as T;
};

async function login(ctx: Ctx, email: string): Promise<SupabaseClient> {
  const c = createClient(ctx.url, ctx.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function count(db: SupabaseClient, table: string): Promise<number> {
  const { count: n, error } = await db.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`hitung ${table}: ${error.message}`);
  return n ?? 0;
}

/** Menyetujui semua permintaan PENDING jenis tertentu dengan urutan approver; galat "bukan giliran Anda" diabaikan. */
async function approveAll(ctx: Ctx, docType: string, approvers: string[]) {
  const clients = await Promise.all(approvers.map((e) => login(ctx, e)));
  for (let pass = 0; pass < approvers.length + 1; pass++) {
    const { data } = await ctx.service.from("approval_requests").select("id").eq("doc_type", docType).eq("status", "PENDING");
    if (!data?.length) return;
    for (const req of data) {
      for (const c of clients) {
        const r = await c.rpc("approval_act", { p_request: req.id, p_action: "APPROVE", p_note: "Disetujui (data demo)" });
        if (!r.error && (r.data as { ok?: boolean })?.ok !== false) break;
      }
    }
  }
}

export async function seedOperations(ctx: Ctx): Promise<void> {
  const { service } = ctx;
  const locs = must(await service.from("locations").select("id,code,branch_id"), "lokasi") as { id: string; code: string; branch_id: string }[];
  const loc = new Map(locs.map((l) => [l.code, l]));
  const parts = must(await service.from("spareparts").select("id,code"), "sparepart") as { id: string; code: string }[];
  const part = new Map(parts.map((p) => [p.code, p.id]));
  const vehicles = must(await service.from("vehicles").select("id,plate_no,branch_id"), "kendaraan") as { id: string; plate_no: string; branch_id: string }[];
  const veh = new Map(vehicles.map((v) => [v.plate_no, v]));
  const people = must(await service.from("profiles").select("id,email"), "profil") as { id: string; email: string }[];
  const pid = new Map(people.map((p) => [p.email, p.id]));

  // ---- kontak darurat
  if ((await count(service, "emergency_contacts")) <= 1) {
    const branches = must(await service.from("branches").select("id,code"), "cabang") as { id: string; code: string }[];
    const rows = DEMO_CONTACTS.map((c) => ({ scope: c.scope, branch_id: branches.find((b) => b.code === c.branch)?.id, role_label: c.role_label, name: c.name, phone: c.phone, priority: c.priority, service_hours: c.service_hours ?? null }));
    must(await service.from("emergency_contacts").insert(rows), "kontak darurat");
    console.log(`Kontak darurat: +${rows.length}`);
  }

  // ---- stok awal lewat mutasi Masuk → approval → posting
  if ((await count(service, "stock_documents")) === 0) {
    for (const b of DEMO_STOCK) {
      const wh = await login(ctx, b.warehouseUser);
      const branchId = one(await service.from("branches").select("id").eq("code", b.branch).single(), "cabang").id;
      for (const l of b.lines) {
        const target = loc.get(l.location);
        if (!target) throw new Error(`Lokasi ${l.location} tidak ada`);
        const saved = must(
          await wh.rpc("stock_doc_save", {
            p_id: null,
            p_type: "IN",
            p_branch: branchId,
            p_date: null,
            p_vehicle: null,
            p_wo: null,
            p_from: null,
            p_to: target.id,
            p_notes: "Saldo awal (data demo)",
            p_lines: l.items.map((i) => ({ sparepart_id: part.get(i.code), qty: String(i.qty) })),
            p_version: null,
          }),
          `simpan mutasi ${l.location}`,
        );
        must(await wh.rpc("stock_doc_submit", { p_id: saved }), `ajukan mutasi ${l.location}`);
      }
    }
    await approveAll(ctx, "STOCK", ["supervisor.jkt@example.com", "supervisor.sby@example.com", "depthead.jkt@example.com", "hqadmin@example.com"]);
    console.log("Stok awal    : mutasi masuk diposting");
  }

  // ---- rencana perawatan + WO preventif otomatis
  if ((await count(service, "maintenance_plans")) === 0) {
    for (const p of DEMO_PLANS) {
      const spv = await login(ctx, p.supervisor);
      const v = veh.get(p.plate);
      if (!v) throw new Error(`Kendaraan ${p.plate} tidak ada`);
      const last = new Date(Date.now() - p.lastDaysAgo * 86_400_000).toISOString().slice(0, 10);
      const row = one(
        await spv.from("maintenance_plans").insert({ vehicle_id: v.id, branch_id: v.branch_id, task_name: p.task, interval_days: p.days, interval_km: p.km, last_done_at: last, last_done_km: p.lastKm }).select("id").single(),
        `rencana ${p.task}`,
      );
      must(await spv.from("maintenance_plan_parts").insert(p.parts.map((x) => ({ plan_id: row.id, sparepart_id: part.get(x.code), qty: x.qty }))), "part rencana");
    }
    const jobs = must(await service.rpc("_run_jobs"), "job terjadwal");
    console.log(`Rencana      : +${DEMO_PLANS.length}; job awal: ${JSON.stringify(jobs)}`);
  }

  // ---- WO korektif (terjadwal dan berjalan) dan satu perubahan jadwal
  if ((await count(service, "work_orders")) <= DEMO_PLANS.length) {
    const spv = await login(ctx, "supervisor.jkt@example.com");
    const mech = pid.get("mechanic.jkt@example.com");
    const tomorrow = (h: number) => new Date(Date.now() + 86_400_000 + h * 3_600_000).toISOString();
    const b9002 = veh.get("B 9002 KBL")!;
    const b7101 = veh.get("B 7101 KBL")!;
    const sched = must(
      await spv.rpc("wo_save", {
        p_id: null, p_type: "CORRECTIVE", p_priority: "HIGH", p_vehicle: b9002.id, p_start: tomorrow(2), p_end: tomorrow(6), p_vendor: null, p_assignee: mech,
        p_description: "Rem berdecit saat pengereman (temuan mekanik)", p_parts: [{ sparepart_id: part.get("KMP-RM-BK"), qty: "1", location_id: loc.get("GU-JKT")!.id }], p_source: "Temuan mekanik", p_version: null,
      }),
      "WO korektif",
    ) as { id: string };
    const running = must(
      await spv.rpc("wo_save", {
        p_id: null, p_type: "CORRECTIVE", p_priority: "NORMAL", p_vehicle: b7101.id, p_start: new Date(Date.now() - 3_600_000).toISOString(), p_end: new Date(Date.now() + 5 * 3_600_000).toISOString(),
        p_vendor: null, p_assignee: mech, p_description: "Ganti lampu depan kanan", p_parts: [{ sparepart_id: part.get("LMP-H4-24V"), qty: "2", location_id: loc.get("WS-JKT")!.id }], p_source: null, p_version: null,
      }),
      "WO berjalan",
    ) as { id: string };
    const m = await login(ctx, "mechanic.jkt@example.com");
    must(await m.rpc("wo_start", { p_id: running.id }), "mulai WO");
    // perubahan jadwal menunggu keputusan Kepala Dept
    const reason = one(await service.from("reason_codes").select("id").eq("code", "PART_UNAVAILABLE").single(), "alasan").id;
    must(await spv.rpc("schedule_change_request", { p_wo: sched.id, p_new_start: tomorrow(50), p_new_end: null, p_reason: reason, p_note: "Kampas rem belakang menunggu pengiriman" }), "perubahan jadwal");
    console.log("Work Order   : 1 terjadwal, 1 berjalan, 1 perubahan jadwal menunggu approval");
  }

  // ---- opname menunggu approval (dengan selisih)
  if ((await count(service, "stock_counts")) === 0) {
    const wh = await login(ctx, "warehouse.jkt@example.com");
    const countId = must(await wh.rpc("count_open", { p_location: loc.get("GU-JKT")!.id, p_type: "PERIODIC", p_category: "Filter", p_notes: "Opname kategori Filter (data demo)" }), "buka opname") as string;
    const lines = must(await service.from("stock_count_lines").select("sparepart_id,system_qty").eq("count_id", countId), "baris opname") as { sparepart_id: string; system_qty: string }[];
    const reason = one(await service.from("reason_codes").select("id").eq("code", "SUDDEN_DAMAGE").single(), "alasan").id;
    const payload = lines.map((l, i) => (i === 0 ? { sparepart_id: l.sparepart_id, counted_qty: String(Math.max(0, Number(l.system_qty) - 1)), reason_code_id: reason, reason_note: "Rusak saat bongkar muat" } : { sparepart_id: l.sparepart_id, counted_qty: l.system_qty }));
    must(await wh.rpc("count_enter", { p_id: countId, p_lines: payload }), "hitung opname");
    must(await wh.rpc("count_submit", { p_id: countId }), "ajukan opname");
    console.log("Opname       : 1 sesi menunggu approval Supervisor");
  }

  // ---- insiden: satu belum dikonfirmasi (widget merah), satu sudah ditangani
  if ((await count(service, "incidents")) === 0) {
    const d = await login(ctx, "driver.jkt@example.com");
    const b9001 = veh.get("B 9001 KBL")!;
    must(await d.rpc("incident_report", { p_vehicle: b9001.id, p_type: "BREAKDOWN", p_lat: -6.2088, p_lng: 106.8456, p_address: "Tol Dalam Kota KM 12 (data demo)", p_description: null, p_casualties: null, p_idem: "demo-incident-1", p_driver: null }), "lapor insiden");
    const hq = await login(ctx, "hqadmin@example.com");
    const second = must(
      await hq.rpc("incident_report", { p_vehicle: veh.get("B 5201 KBL")!.id, p_type: "TIRE", p_lat: null, p_lng: null, p_address: "Jl. Raya Bekasi (dicatat dari telepon)", p_description: "Ban pecah", p_casualties: null, p_idem: null, p_driver: pid.get("driver.jkt@example.com") }),
      "catat insiden",
    ) as { incident: { id: string } };
    must(await hq.rpc("incident_ack", { p_id: second.incident.id }), "ack");
    must(await hq.rpc("incident_log_action", { p_id: second.incident.id, p_action: "ASSIGN_TOW", p_note: "Derek dikirim, estimasi 30 menit" }), "tindak lanjut");
    console.log("Insiden      : 1 belum dikonfirmasi, 1 sedang ditangani");
  }
}
