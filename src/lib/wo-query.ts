import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanQuery, one } from "@/lib/lookups";

export interface WoRow {
  id: string;
  wo_no: string;
  type: string;
  priority: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  due_at: string | null;
  is_overdue: boolean;
  schedule_changed: boolean;
  needs_reschedule: boolean;
  auto_generated: boolean;
  emergency_validation: string;
  description: string | null;
  vehicle_id: string;
  assignee_id: string | null;
  vendor_id: string | null;
  vehicles: { plate_no: string } | null;
  vendors: { name: string } | null;
  profiles: { name: string } | null;
}

type Sp = Record<string, string | string[] | undefined>;

const SELECT =
  "id,wo_no,type,priority,status,scheduled_start,scheduled_end,due_at,is_overdue,schedule_changed,needs_reschedule,auto_generated,emergency_validation,description,vehicle_id,assignee_id,vendor_id," +
  "vehicles(plate_no),vendors(name),profiles!work_orders_assignee_id_fkey(name)";

/** Query daftar WO dengan filter dari URL. Dipakai halaman daftar dan ekspor. */
export async function queryWorkOrders(supabase: SupabaseClient, sp: Sp, range?: [number, number]) {
  let query = supabase.from("work_orders").select(SELECT, { count: "exact" });
  for (const k of ["type", "status", "vehicle_id", "assignee_id", "vendor_id"] as const) {
    const key = k === "vehicle_id" ? "vehicle" : k === "assignee_id" ? "assignee" : k === "vendor_id" ? "vendor" : k;
    if (one(sp, key)) query = query.eq(k, one(sp, key));
  }
  if (one(sp, "branch")) query = query.eq("branch_id", one(sp, "branch"));
  if (one(sp, "overdue") === "1") query = query.eq("is_overdue", true);
  if (one(sp, "from")) query = query.gte("scheduled_start", `${one(sp, "from")}T00:00:00+07:00`);
  if (one(sp, "to")) query = query.lte("scheduled_start", `${one(sp, "to")}T23:59:59+07:00`);
  const q = cleanQuery(one(sp, "q"));
  if (q) {
    const { data: v } = await supabase.from("vehicles").select("id").ilike("plate_no", `%${q}%`).limit(100);
    const ids = (v ?? []).map((x) => x.id as string);
    query = ids.length ? query.or(`wo_no.ilike.%${q}%,vehicle_id.in.(${ids.join(",")})`) : query.ilike("wo_no", `%${q}%`);
  }
  query = query.order("is_overdue", { ascending: false }).order("scheduled_start", { ascending: true, nullsFirst: false });
  if (range) query = query.range(range[0], range[1]);
  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as WoRow[], count: count ?? 0, error };
}
