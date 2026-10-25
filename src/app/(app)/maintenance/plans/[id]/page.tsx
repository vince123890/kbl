import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDateTime, fmtQty } from "@/lib/format";
import { PLAN_STATE, planState, remainingText } from "@/lib/plan-status";
import { WO_STATUS } from "@/lib/labels";
import { Badge, Card, DataTable, KeyValue, PageHeader, StatusBadge, TD } from "@/components/ui";

export const metadata = { title: "Detail Rencana" };

export default async function PlanDetailPage({ params }: PageProps<"/maintenance/plans/[id]">) {
  const { id } = await params;
  await requirePermission("master.read");
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("maintenance_plans")
    .select("*,vehicles(plate_no,odometer),vendors(name),maintenance_plan_parts(qty,spareparts(code,name,uom))")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const [{ data: wos }, { data: params2 }] = await Promise.all([
    supabase.from("work_orders").select("id,wo_no,status,scheduled_start,actual_start,actual_end,is_overdue").eq("plan_id", id).order("created_at", { ascending: false }),
    supabase.from("system_parameters").select("key,value").in("key", ["maintenance.lead_days", "maintenance.lead_km"]),
  ]);
  const veh = p.vehicles as { plate_no: string; odometer: string };
  const defaults = {
    leadDays: Number(params2?.find((x) => x.key === "maintenance.lead_days")?.value ?? 7),
    leadKm: Number(params2?.find((x) => x.key === "maintenance.lead_km")?.value ?? 500),
  };
  const state = planState(p, Number(veh.odometer), defaults);
  const active = (wos ?? []).find((w) => ["PLANNED", "SCHEDULED", "IN_PROGRESS"].includes(w.status));
  const parts = (p.maintenance_plan_parts ?? []) as unknown as { qty: string; spareparts: { code: string; name: string; uom: string } }[];

  return (
    <>
      <PageHeader title={p.task_name} subtitle={`${veh.plate_no} · odometer ${Number(veh.odometer).toLocaleString("id-ID")} km`} />
      <div className="space-y-4">
        <Card>
          <KeyValue
            items={[
              ["Status", <Badge key="s" tone={PLAN_STATE[state].tone}>{PLAN_STATE[state].label}</Badge>],
              ["Interval", [p.interval_days && `${p.interval_days} hari`, p.interval_km && `${Number(p.interval_km).toLocaleString("id-ID")} km`].filter(Boolean).join(" atau ") + " (mana yang lebih dulu)"],
              ["Terakhir dilakukan", p.last_done_at ? `${fmtDate(p.last_done_at)}${p.last_done_km ? ` · ${Number(p.last_done_km).toLocaleString("id-ID")} km` : ""}` : null],
              ["Jatuh tempo berikutnya", [p.next_due_at && fmtDate(p.next_due_at), p.next_due_km && `${Number(p.next_due_km).toLocaleString("id-ID")} km`].filter(Boolean).join(" / ")],
              ["Sisa", remainingText(p, Number(veh.odometer))],
              ["Bengkel default", (p.vendors as { name: string } | null)?.name],
              ["WO aktif", active ? <Link key="w" href={`/maintenance/work-orders/${active.id}`} className="underline decoration-brand decoration-2">{active.wo_no}</Link> : "Belum ada"],
              ["Catatan", p.notes],
            ]}
          />
        </Card>
        <Card title="Sparepart standar">
          {parts.length ? (
            <ul className="text-sm">
              {parts.map((x, i) => (
                <li key={`${x.spareparts?.code ?? "p"}-${i}`}>
                  {x.spareparts?.name ?? "Sparepart"} · {fmtQty(x.qty)} {x.spareparts?.uom ?? ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Tidak ada.</p>
          )}
        </Card>
        <Card title="Riwayat pelaksanaan">
          {(wos ?? []).length ? (
            <DataTable head={["No. WO", "Status", "Jadwal", "Mulai", "Selesai"]}>
              {(wos ?? []).map((w) => (
                <tr key={w.id}>
                  <td className={TD}>
                    <Link href={`/maintenance/work-orders/${w.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                      {w.wo_no}
                    </Link>
                  </td>
                  <td className={TD}>
                    <StatusBadge map={WO_STATUS} value={w.status} />
                    {w.is_overdue && <Badge tone="bad">Overdue</Badge>}
                  </td>
                  <td className={TD}>{fmtDateTime(w.scheduled_start)}</td>
                  <td className={TD}>{fmtDateTime(w.actual_start)}</td>
                  <td className={TD}>{fmtDateTime(w.actual_end)}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <p className="text-sm text-muted">Belum pernah dikerjakan.</p>
          )}
        </Card>
      </div>
    </>
  );
}
