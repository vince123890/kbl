import type { SupabaseClient } from "@supabase/supabase-js";

/** Pilihan untuk form WO pada satu cabang. */
export async function loadWoFormData(supabase: SupabaseClient, branchId: string) {
  const [veh, ven, sp, loc, ass] = await Promise.all([
    supabase.from("vehicles").select("id,plate_no").eq("branch_id", branchId).eq("is_active", true).order("plate_no"),
    supabase.from("vendors").select("id,name").eq("type", "BENGKEL").eq("is_active", true).order("name"),
    supabase.from("spareparts").select("id,code,name").eq("is_active", true).order("code"),
    supabase.from("locations").select("id,name").eq("branch_id", branchId).eq("is_active", true).order("name"),
    supabase.rpc("wo_assignees", { p_branch: branchId }),
  ]);
  return {
    vehicles: (veh.data ?? []).map((v) => ({ id: v.id as string, label: v.plate_no as string })),
    vendors: (ven.data ?? []).map((v) => ({ id: v.id as string, label: v.name as string })),
    spareparts: (sp.data ?? []).map((s) => ({ id: s.id as string, label: `${s.code} · ${s.name}` })),
    locations: (loc.data ?? []).map((l) => ({ id: l.id as string, label: l.name as string })),
    assignees: ((ass.data ?? []) as { id: string; name: string }[]).map((a) => ({ id: a.id, label: a.name })),
  };
}
