import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { nameMap, one } from "@/lib/lookups";
import { listAttachments } from "@/lib/attachments";
import { fmtDateTime, fmtQty } from "@/lib/format";
import { CHANGE_TYPE, PRIORITY, SCHEDULE_STATUS, STOCK_STATUS, VALIDATION, WO_STATUS, WO_TYPE } from "@/lib/labels";
import { Badge, ButtonLink, Card, DataTable, KeyValue, Notice, PageHeader, StatusBadge, TD } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { AttachmentsPanel } from "@/components/attachments";
import { CompleteWoDialog } from "@/components/complete-wo-dialog";
import { ScheduleChangeDialog } from "@/components/schedule-change-dialog";
import { PrintButton } from "@/components/print-button";
import { cancelWoAction, resubmitEmergencyAction, startWoAction } from "../../actions";

export const metadata = { title: "Detail Work Order" };

interface Part {
  qty_planned: string;
  qty_used: string;
  spareparts: { code: string; name: string; uom: string };
  locations: { name: string } | null;
}

export default async function WoDetailPage({ params, searchParams }: PageProps<"/maintenance/work-orders/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: w } = await supabase
    .from("work_orders")
    .select(
      "*,vehicles(plate_no,odometer,type,model),vendors(name),branches(name)," +
        "wo_parts(qty_planned,qty_used,spareparts(code,name,uom),locations(name)),maintenance_plans(id,task_name),incidents(id,incident_no)",
    )
    .eq("id", id)
    .maybeSingle<Record<string, unknown> & {
      id: string; wo_no: string; type: string; priority: string; status: string; branch_id: string; vehicle_id: string; assignee_id: string | null; scheduled_start: string | null; scheduled_end: string | null; original_start: string | null; due_at: string | null; actual_start: string | null; actual_end: string | null; end_odometer: string | null; is_overdue: boolean; schedule_changed: boolean; needs_reschedule: boolean; auto_generated: boolean; emergency_validation: string; validation_due: string | null; description: string | null; source_note: string | null; completion_note: string | null; cancel_reason: string | null; created_by: string | null; created_at: string;
      vehicles: { plate_no: string; odometer: string; type: string; model: string | null }; vendors: { name: string } | null; branches: { name: string }; wo_parts: Part[]; maintenance_plans: { id: string; task_name: string } | null; incidents: { id: string; incident_no: string } | null;
    }>();
  if (!w) notFound();

  const [people, attachments, changes, docs, reasons, validationReq] = await Promise.all([
    nameMap(supabase, "profiles", [w.assignee_id, w.created_by]),
    listAttachments("WORK_ORDER", id),
    supabase.from("schedule_changes").select("id,change_no,change_type,old_start,new_start,delta_minutes,status,reason_code_id,requested_at,reason_codes(name)").eq("work_order_id", id).order("requested_at", { ascending: false }),
    supabase.from("stock_documents").select("id,doc_no,type,status,doc_date").eq("work_order_id", id).order("doc_date", { ascending: false }),
    supabase.from("reason_codes").select("id,name,require_note").eq("is_active", true).in("used_for", ["SCHEDULE_CHANGE", "ALL"]).order("name"),
    w.type === "EMERGENCY" ? supabase.from("approval_requests").select("id,status").eq("doc_type", "EMERGENCY_WO").eq("doc_id", id).order("requested_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] as { id: string; status: string }[] }),
  ]);

  const canWrite = can(user, "wo.write");
  const canExec = can(user, "wo.execute") && (canWrite || w.assignee_id === user.id);
  const editable = ["PLANNED", "SCHEDULED"].includes(w.status);
  const hasSchedule = !!w.scheduled_start;
  const parts = w.wo_parts;
  const warn = one(sp, "warn");
  const vReq = (validationReq.data ?? [])[0];

  return (
    <>
      <PageHeader
        title={w.wo_no}
        subtitle={`${w.vehicles.plate_no} · ${w.branches.name}`}
        actions={
          <>
            <PrintButton label="Cetak" />
            {editable && canWrite && <ButtonLink href={`/maintenance/work-orders/${id}/edit`}>Ubah</ButtonLink>}
            {w.status === "SCHEDULED" && canExec && <ActionButton tone="primary" label="Mulai" action={startWoAction.bind(null, id)} />}
            {w.status === "IN_PROGRESS" && canExec && <CompleteWoDialog woId={id} currentOdometer={Number(w.vehicles.odometer)} />}
            {w.status === "IN_PROGRESS" && can(user, "stock.create") && <ButtonLink href={`/inventory/movements/new?wo=${id}`}>Pakai sparepart</ButtonLink>}
            {editable && hasSchedule && can(user, "schedule.request") && (
              <ScheduleChangeDialog
                woId={id}
                currentStart={fmtDateTime(w.scheduled_start)}
                currentEnd={fmtDateTime(w.scheduled_end)}
                reasons={(reasons.data ?? []) as { id: string; name: string; require_note: boolean }[]}
                triggerClassName="tap rounded-lg border border-border px-4 text-sm hover:bg-brand-soft"
              />
            )}
            {w.type === "EMERGENCY" && w.emergency_validation === "REVISION" && canWrite && <ActionButton label="Ajukan ulang validasi" action={resubmitEmergencyAction.bind(null, id)} />}
            {!["COMPLETED", "CANCELLED"].includes(w.status) && canWrite && (
              <ActionButton tone="danger" label="Batalkan" noteLabel="Alasan pembatalan" action={cancelWoAction.bind(null, id)} />
            )}
          </>
        }
      />
      {warn && <Notice>{warn}</Notice>}
      {w.needs_reschedule && <Notice>WO ini bentrok dengan WO emergensi dan perlu dijadwal ulang lewat “Ajukan perubahan jadwal”.</Notice>}
      {w.status === "CANCELLED" && <Notice tone="bad">Dibatalkan: {w.cancel_reason}</Notice>}
      {w.type === "EMERGENCY" && w.emergency_validation !== "NONE" && (
        <Notice tone={w.emergency_validation === "VALIDATED" ? "good" : "warn"}>
          Validasi pasca-kejadian: <b>{VALIDATION[w.emergency_validation]?.label}</b>
          {w.emergency_validation === "PENDING" && w.validation_due ? ` · batas ${fmtDateTime(w.validation_due)}` : ""}
          {vReq && (
            <>
              {" "}
              <Link href={`/approvals/${vReq.id}`} className="underline">
                Lihat approval
              </Link>
            </>
          )}
        </Notice>
      )}

      <div className="space-y-4">
        <Card title="Ringkasan">
          <KeyValue
            items={[
              ["Status", <StatusBadge key="s" map={WO_STATUS} value={w.status} />],
              ["Jenis", <StatusBadge key="t" map={WO_TYPE} value={w.type} />],
              ["Prioritas", <StatusBadge key="p" map={PRIORITY} value={w.priority} />],
              ["Kendaraan", `${w.vehicles.plate_no} · ${w.vehicles.type}${w.vehicles.model ? ` ${w.vehicles.model}` : ""}`],
              ["Jadwal", w.scheduled_start ? `${fmtDateTime(w.scheduled_start)} – ${fmtDateTime(w.scheduled_end)}` : "Belum dijadwalkan"],
              ["Jadwal awal", w.schedule_changed ? fmtDateTime(w.original_start) : null],
              ["Jatuh tempo", w.due_at ? <span key="d">{fmtDateTime(w.due_at)} {w.is_overdue && <Badge tone="bad">⏰ Overdue</Badge>}</span> : null],
              ["Bengkel", w.vendors?.name],
              ["Teknisi", people.get(w.assignee_id ?? "")],
              ["Mulai aktual", w.actual_start ? fmtDateTime(w.actual_start) : null],
              ["Selesai aktual", w.actual_end ? fmtDateTime(w.actual_end) : null],
              ["Odometer akhir", w.end_odometer ? `${Number(w.end_odometer).toLocaleString("id-ID")} km` : null],
              ["Sumber", w.maintenance_plans ? <Link key="pl" href={`/maintenance/plans/${w.maintenance_plans.id}`} className="underline decoration-brand decoration-2">Rencana: {w.maintenance_plans.task_name}</Link> : w.incidents ? <Link key="in" href={`/emergency/incidents/${w.incidents.id}`} className="underline decoration-brand decoration-2">Insiden {w.incidents.incident_no}</Link> : w.source_note],
              ["Dibuat", w.auto_generated ? "Otomatis oleh sistem" : `${people.get(w.created_by ?? "") ?? "-"} · ${fmtDateTime(w.created_at)}`],
              ["Deskripsi", w.description],
              ["Catatan penyelesaian", w.completion_note],
            ]}
          />
        </Card>

        <Card title="Sparepart">
          {parts.length ? (
            <DataTable head={["Sparepart", "Rencana", "Terpakai", "Satuan", "Reservasi dari"]}>
              {parts.map((p, i) => (
                <tr key={i}>
                  <td className={TD}>
                    {p.spareparts.name}
                    <span className="block text-xs text-muted">{p.spareparts.code}</span>
                  </td>
                  <td className={`${TD} tabular-nums`}>{fmtQty(p.qty_planned)}</td>
                  <td className={`${TD} tabular-nums`}>{fmtQty(p.qty_used)}</td>
                  <td className={TD}>{p.spareparts.uom}</td>
                  <td className={TD}>{p.locations?.name ?? <span className="text-muted">-</span>}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <p className="text-sm text-muted">Belum ada kebutuhan sparepart.</p>
          )}
          {(docs.data ?? []).length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {(docs.data ?? []).map((d) => (
                <li key={d.id}>
                  <Link href={`/inventory/movements/${d.id}`} className="underline decoration-brand decoration-2 underline-offset-2">
                    {d.doc_no}
                  </Link>{" "}
                  · {d.type} · <StatusBadge map={STOCK_STATUS} value={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Jadwal & anomali">
          {(changes.data ?? []).length ? (
            <DataTable head={["No.", "Tipe", "Jadwal lama → baru", "Alasan", "Status"]}>
              {(changes.data as unknown as { id: string; change_no: string; change_type: string; old_start: string; new_start: string; status: string; reason_codes: { name: string } }[]).map((c) => (
                <tr key={c.id}>
                  <td className={TD}>
                    <Link href={`/maintenance/schedule-changes/${c.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                      {c.change_no}
                    </Link>
                  </td>
                  <td className={TD}>
                    <StatusBadge map={CHANGE_TYPE} value={c.change_type} />
                  </td>
                  <td className={TD}>
                    {fmtDateTime(c.old_start)} → {fmtDateTime(c.new_start)}
                  </td>
                  <td className={TD}>{c.reason_codes?.name}</td>
                  <td className={TD}>
                    <StatusBadge map={SCHEDULE_STATUS} value={c.status} />
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <p className="text-sm text-muted">Belum pernah ada perubahan jadwal.</p>
          )}
        </Card>

        <Card title="Foto / lampiran">
          <AttachmentsPanel
            entity="WORK_ORDER"
            entityId={id}
            items={attachments}
            canAdd={!["COMPLETED", "CANCELLED"].includes(w.status) && (canWrite || canExec)}
            canDelete={false}
            capture="environment"
          />
        </Card>
      </div>
    </>
  );
}
