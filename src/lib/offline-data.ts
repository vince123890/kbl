import type { SupabaseClient } from "@supabase/supabase-js";
import { can, type CurrentUser } from "@/lib/auth/session";
import type { CountSnap, WoSnap } from "@/lib/offline-types";

/**
 * Data yang disalin ke perangkat agar tetap bisa dipakai tanpa sinyal: WO yang ditugaskan kepada user dan sesi opname yang
 * sedang dihitung. Hanya data milik/terlihat oleh user itu (RLS), dan dihapus dari perangkat saat Keluar.
 */
export async function loadOfflineData(supabase: SupabaseClient, user: CurrentUser): Promise<{ wos: WoSnap[]; counts: CountSnap[] }> {
  const wos: WoSnap[] = [];
  const counts: CountSnap[] = [];

  if (can(user, "wo.execute")) {
    const { data } = await supabase
      .from("work_orders")
      .select("id,wo_no,type,status,priority,description,scheduled_start,scheduled_end,vehicles(plate_no,odometer),vendors(name),wo_parts(qty_planned,qty_used,spareparts(code,name,uom))")
      .eq("assignee_id", user.id)
      .in("status", ["PLANNED", "SCHEDULED", "IN_PROGRESS"])
      .order("scheduled_start", { ascending: true, nullsFirst: false })
      .limit(30);
    for (const w of (data ?? []) as unknown as {
      id: string; wo_no: string; type: string; status: string; priority: string; description: string | null; scheduled_start: string | null; scheduled_end: string | null;
      vehicles: { plate_no: string; odometer: string } | null; vendors: { name: string } | null;
      wo_parts: { qty_planned: string; qty_used: string; spareparts: { code: string; name: string; uom: string } }[];
    }[]) {
      wos.push({
        id: w.id,
        wo_no: w.wo_no,
        type: w.type,
        status: w.status,
        priority: w.priority,
        plate: w.vehicles?.plate_no ?? "",
        odometer: Number(w.vehicles?.odometer ?? 0),
        description: w.description,
        scheduled_start: w.scheduled_start,
        scheduled_end: w.scheduled_end,
        vendor: w.vendors?.name ?? null,
        parts: w.wo_parts.map((p) => ({ code: p.spareparts.code, name: p.spareparts.name, uom: p.spareparts.uom, qty_planned: p.qty_planned, qty_used: p.qty_used })),
      });
    }
  }

  if (can(user, "count.enter")) {
    const { data: cs } = await supabase.from("stock_counts").select("id,count_no,status,locations(name)").in("status", ["OPEN", "COUNTING"]).limit(5);
    const list = (cs ?? []) as unknown as { id: string; count_no: string; status: string; locations: { name: string } | null }[];
    if (list.length) {
      const [{ data: lines }, { data: reasons }] = await Promise.all([
        supabase
          .from("stock_count_lines")
          .select("count_id,sparepart_id,system_qty,counted_qty,not_counted,reason_code_id,reason_note,spareparts(code,name,uom)")
          .in("count_id", list.map((c) => c.id))
          .limit(3000),
        supabase.from("reason_codes").select("id,name,require_note").eq("is_active", true).in("used_for", ["OPNAME_DIFF", "ALL"]).order("name"),
      ]);
      const rs = (reasons ?? []) as { id: string; name: string; require_note: boolean }[];
      for (const c of list) {
        counts.push({
          id: c.id,
          count_no: c.count_no,
          location: c.locations?.name ?? "",
          status: c.status,
          reasons: rs,
          lines: ((lines ?? []) as unknown as (Omit<CountSnap["lines"][number], "code" | "name" | "uom"> & { count_id: string; spareparts: { code: string; name: string; uom: string } })[])
            .filter((l) => l.count_id === c.id)
            .map((l) => ({
              sparepart_id: l.sparepart_id,
              code: l.spareparts.code,
              name: l.spareparts.name,
              uom: l.spareparts.uom,
              system_qty: l.system_qty,
              counted_qty: l.counted_qty,
              not_counted: l.not_counted,
              reason_code_id: l.reason_code_id,
              reason_note: l.reason_note,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    }
  }
  return { wos, counts };
}
