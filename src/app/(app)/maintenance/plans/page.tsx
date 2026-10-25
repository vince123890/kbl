import Link from "next/link";
import { can, requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hrefBuilder, one, pageOf } from "@/lib/lookups";
import { fmtDate } from "@/lib/format";
import { PLAN_STATE, planState, remainingText, remaining } from "@/lib/plan-status";
import { Badge, DataTable, EmptyState, PageHeader, Pagination, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";
import { ActionButton } from "@/components/action-button";
import { PlanFormDialog, type PlanFormPlan } from "@/components/plan-form-dialog";
import { PlanImport } from "@/components/plan-import";
import { togglePlanAction } from "../actions";

export const metadata = { title: "Rencana Perawatan" };
const PAGE_SIZE = 50;

interface Row extends PlanFormPlan {
  vehicle_id: string;
  branch_id: string;
  next_due_at: string | null;
  next_due_km: string | null;
  is_active: boolean;
  vehicles: { plate_no: string; odometer: string } | null;
  maintenance_plan_parts: { sparepart_id: string; qty: string }[];
}

export default async function PlansPage({ searchParams }: PageProps<"/maintenance/plans">) {
  const user = await requirePermission("master.read");
  const canWrite = can(user, "plan.write");
  const sp = await searchParams;
  const page = pageOf(sp);
  const supabase = await createClient();

  let query = supabase.from("maintenance_plans").select("*,vehicles(plate_no,odometer),maintenance_plan_parts(sparepart_id,qty)");
  if (one(sp, "branch")) query = query.eq("branch_id", one(sp, "branch"));
  if (one(sp, "vehicle")) query = query.eq("vehicle_id", one(sp, "vehicle"));
  if (one(sp, "q")) query = query.ilike("task_name", `%${one(sp, "q").trim()}%`);
  const [{ data }, { data: params }, { data: vehicles }, { data: branches }, { data: spareparts }, { data: vendors }] = await Promise.all([
    query.limit(2000),
    supabase.from("system_parameters").select("key,value").in("key", ["maintenance.lead_days", "maintenance.lead_km"]),
    supabase.from("vehicles").select("id,plate_no").eq("is_active", true).order("plate_no"),
    supabase.from("branches").select("id,name").order("name"),
    supabase.from("spareparts").select("id,code,name").eq("is_active", true).order("code"),
    supabase.from("vendors").select("id,name").eq("type", "BENGKEL").eq("is_active", true).order("name"),
  ]);
  const defaults = {
    leadDays: Number(params?.find((p) => p.key === "maintenance.lead_days")?.value ?? 7),
    leadKm: Number(params?.find((p) => p.key === "maintenance.lead_km")?.value ?? 500),
  };

  const all = ((data ?? []) as unknown as Row[]).map((r) => {
    const odo = Number(r.vehicles?.odometer ?? 0);
    return { ...r, state: planState(r, odo, defaults), rem: remaining(r, odo), remText: remainingText(r, odo) };
  });
  const stateFilter = one(sp, "state");
  let rows = stateFilter ? all.filter((r) => r.state === stateFilter) : all;
  const score = (r: (typeof all)[number]) => Math.min(r.rem.days ?? Infinity, r.rem.km !== null ? r.rem.km / 100 : Infinity);
  rows = [...rows].sort((a, b) => score(a) - score(b));
  const total = rows.length;
  rows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const partOpts = (spareparts ?? []).map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }));
  const vendorOpts = (vendors ?? []).map((v) => ({ id: v.id, label: v.name }));
  const vehicleOpts = (vehicles ?? []).map((v) => ({ id: v.id, label: v.plate_no }));

  return (
    <>
      <PageHeader
        title="Rencana Perawatan"
        subtitle={`${total} rencana. WO preventif dibuat otomatis mendekati jatuh tempo.`}
        actions={canWrite ? <PlanFormDialog vehicles={vehicleOpts} spareparts={partOpts} vendors={vendorOpts} /> : undefined}
      />
      {canWrite && <PlanImport />}
      <div className="filter-bar">
        <SearchBox placeholder="Cari nama tugas…" />
        <FilterSelect name="branch" label="Cabang" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect name="vehicle" label="Kendaraan" options={vehicleOpts.map((v) => ({ value: v.id, label: v.label }))} />
        <FilterSelect name="state" label="Status" options={Object.entries(PLAN_STATE).map(([value, d]) => ({ value, label: d.label }))} />
      </div>
      {!rows.length ? (
        <EmptyState>Belum ada rencana perawatan. {canWrite && "Buat rencana atau impor dari CSV."}</EmptyState>
      ) : (
        <DataTable head={["Kendaraan", "Tugas", "Interval", "Terakhir", "Jatuh tempo", "Sisa", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={TD}>{r.vehicles?.plate_no}</td>
              <td className={TD}>
                <Link href={`/maintenance/plans/${r.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {r.task_name}
                </Link>
              </td>
              <td className={TD}>{[r.interval_days && `${r.interval_days} hari`, r.interval_km && `${r.interval_km.toLocaleString("id-ID")} km`].filter(Boolean).join(" / ")}</td>
              <td className={TD}>
                {r.last_done_at ? fmtDate(r.last_done_at) : "-"}
                {r.last_done_km !== null && <span className="block text-xs text-muted">{Number(r.last_done_km).toLocaleString("id-ID")} km</span>}
              </td>
              <td className={TD}>
                {r.next_due_at ? fmtDate(r.next_due_at) : "-"}
                {r.next_due_km !== null && <span className="block text-xs text-muted">{Number(r.next_due_km).toLocaleString("id-ID")} km</span>}
              </td>
              <td className={TD}>{r.remText}</td>
              <td className={TD}>
                <Badge tone={PLAN_STATE[r.state].tone}>{PLAN_STATE[r.state].label}</Badge>
              </td>
              <td className={TD}>
                {canWrite && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <PlanFormDialog
                      compact
                      plan={{ ...r, parts: r.maintenance_plan_parts.map((p) => ({ sparepart_id: p.sparepart_id, qty: String(Number(p.qty)) })) }}
                      vehicles={vehicleOpts}
                      spareparts={partOpts}
                      vendors={vendorOpts}
                    />
                    <ActionButton
                      label={r.is_active ? "Nonaktifkan" : "Aktifkan"}
                      tone={r.is_active ? "danger" : "ghost"}
                      confirm={r.is_active ? "Nonaktifkan rencana ini? WO aktif tidak ikut terhapus dan harus dibatalkan terpisah." : undefined}
                      action={togglePlanAction.bind(null, r.id, !r.is_active)}
                    />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={hrefBuilder("/maintenance/plans", sp)} />
    </>
  );
}
