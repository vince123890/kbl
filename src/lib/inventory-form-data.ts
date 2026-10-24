import type { SupabaseClient } from "@supabase/supabase-js";
import { can, type CurrentUser } from "@/lib/auth/session";
import type { LocationOpt, SparepartOpt, VehicleOpt, WoOpt } from "@/components/movement-form";

/** Data pilihan untuk form mutasi: sparepart, lokasi, kendaraan, WO aktif, dan stok tersedia per lokasi. */
export async function loadMovementFormData(supabase: SupabaseClient, user: CurrentUser, branchId: string) {
  const [sp, loc, veh, wo] = await Promise.all([
    supabase.from("spareparts").select("id,code,name,uom").eq("is_active", true).order("code"),
    supabase.from("locations").select("id,name").eq("branch_id", branchId).eq("is_active", true).order("name"),
    supabase.from("vehicles").select("id,plate_no").eq("branch_id", branchId).eq("is_active", true).order("plate_no"),
    supabase
      .from("work_orders")
      .select("id,wo_no,vehicle_id,assignee_id,vehicles(plate_no)")
      .eq("branch_id", branchId)
      .in("status", ["PLANNED", "SCHEDULED", "IN_PROGRESS"])
      .order("wo_no"),
  ]);
  const locations = (loc.data ?? []) as LocationOpt[];
  const { data: bal } = locations.length
    ? await supabase.from("stock_balances").select("sparepart_id,location_id,qty_on_hand,qty_reserved").in("location_id", locations.map((l) => l.id))
    : { data: [] };
  const available: Record<string, number> = {};
  for (const b of bal ?? []) available[`${b.sparepart_id}:${b.location_id}`] = Number(b.qty_on_hand) - Number(b.qty_reserved);

  const fullOperator = can(user, "stock.cancel");
  const workOrders: WoOpt[] = ((wo.data ?? []) as unknown as { id: string; wo_no: string; vehicle_id: string; assignee_id: string | null; vehicles: { plate_no: string } | null }[])
    .filter((w) => fullOperator || w.assignee_id === user.id)
    .map((w) => ({ id: w.id, label: `${w.wo_no} · ${w.vehicles?.plate_no ?? ""}`, vehicleId: w.vehicle_id }));

  return {
    spareparts: (sp.data ?? []) as SparepartOpt[],
    locations,
    vehicles: ((veh.data ?? []) as { id: string; plate_no: string }[]).map<VehicleOpt>((v) => ({ id: v.id, plate: v.plate_no })),
    workOrders,
    available,
  };
}
