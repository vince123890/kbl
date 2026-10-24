import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { nameMap } from "@/lib/lookups";
import { listAttachments } from "@/lib/attachments";
import { fmtDateTime, fmtQty, toLocalInput } from "@/lib/format";
import { APPROVAL_ACTION, CHANGE_TYPE, SCHEDULE_STATUS } from "@/lib/labels";
import { Badge, Card, DataTable, KeyValue, Notice, PageHeader, StatusBadge, TD } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { AttachmentsPanel } from "@/components/attachments";
import { ScheduleChangeDialog } from "@/components/schedule-change-dialog";
import { withdrawScheduleChangeAction } from "../../actions";

export const metadata = { title: "Detail Perubahan Jadwal" };

export default async function ScheduleChangeDetailPage({ params }: PageProps<"/maintenance/schedule-changes/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("schedule_changes")
    .select("*,reason_codes(name),work_orders(id,wo_no,type,status,vehicles(plate_no))")
    .eq("id", id)
    .maybeSingle<Record<string, unknown> & {
      id: string; change_no: string; change_type: string; status: string; old_start: string; old_end: string; new_start: string; new_end: string; delta_minutes: number; reason_code_id: string; reason_note: string | null; was_overdue: boolean; requested_by: string; requested_at: string; decision_note: string | null;
      reason_codes: { name: string } | null; work_orders: { id: string; wo_no: string; type: string; status: string; vehicles: { plate_no: string } | null };
    }>();
  if (!c) notFound();

  const [people, attachments, { data: reqs }, { data: history }, { data: reasons }] = await Promise.all([
    nameMap(supabase, "profiles", [c.requested_by]),
    listAttachments("SCHEDULE_CHANGE", id),
    supabase.from("approval_requests").select("id,status").eq("doc_type", "SCHEDULE_CHANGE").eq("doc_id", id),
    supabase.from("schedule_changes").select("id,change_no,change_type,old_start,new_start,status").eq("work_order_id", c.work_orders.id).neq("id", id).order("requested_at", { ascending: false }),
    supabase.from("reason_codes").select("id,name,require_note").eq("is_active", true).in("used_for", ["SCHEDULE_CHANGE", "ALL"]).order("name"),
  ]);
  const reqIds = (reqs ?? []).map((r) => r.id);
  const { data: log } = reqIds.length ? await supabase.from("approval_actions").select("*").in("request_id", reqIds).order("id") : { data: [] };
  const activeReq = (reqs ?? []).find((r) => r.status === "PENDING");
  const mine = c.requested_by === user.id;
  const days = Math.round((Math.abs(c.delta_minutes) / 1440) * 100) / 100;

  return (
    <>
      <PageHeader
        title={c.change_no}
        subtitle={`${c.work_orders.wo_no} · ${c.work_orders.vehicles?.plate_no}`}
        actions={
          <>
            {mine && c.status === "REVISION" && (
              <ScheduleChangeDialog
                changeId={id}
                trigger="Perbaiki & ajukan ulang"
                currentStart={fmtDateTime(c.old_start)}
                currentEnd={fmtDateTime(c.old_end)}
                initialStart={toLocalInput(c.new_start)}
                initialReason={c.reason_code_id}
                initialNote={c.reason_note ?? ""}
                reasons={(reasons ?? []) as { id: string; name: string; require_note: boolean }[]}
              />
            )}
            {mine && ["REQUESTED", "REVISION"].includes(c.status) && (
              <ActionButton tone="danger" label="Tarik kembali" confirm="Tarik pengajuan ini? Jadwal WO tetap seperti semula." action={() => withdrawScheduleChangeAction(id)} />
            )}
          </>
        }
      />
      {c.status === "REVISION" && <Notice>Dikembalikan untuk revisi: {c.decision_note}</Notice>}
      {c.status === "REJECTED" && <Notice tone="bad">Ditolak: {c.decision_note}</Notice>}
      {activeReq && (
        <Notice>
          Menunggu approval.{" "}
          <Link href={`/approvals/${activeReq.id}`} className="underline">
            {can(user, "approval.act") ? "Buka untuk memutuskan" : "Lihat approval"}
          </Link>
        </Notice>
      )}
      <div className="space-y-4">
        <Card>
          <KeyValue
            items={[
              ["Status", <StatusBadge key="s" map={SCHEDULE_STATUS} value={c.status} />],
              ["Tipe", <StatusBadge key="t" map={CHANGE_TYPE} value={c.change_type} />],
              ["Selisih", `${c.delta_minutes > 0 ? "+" : "−"}${fmtQty(days)} hari`],
              ["Jadwal lama", `${fmtDateTime(c.old_start)} – ${fmtDateTime(c.old_end)}`],
              ["Jadwal baru", `${fmtDateTime(c.new_start)} – ${fmtDateTime(c.new_end)}`],
              ["Alasan", c.reason_codes?.name],
              ["Keterangan", c.reason_note],
              ["Pengaju", `${people.get(c.requested_by) ?? "-"} · ${fmtDateTime(c.requested_at)}`],
              ["WO", <Link key="w" href={`/maintenance/work-orders/${c.work_orders.id}`} className="underline decoration-brand decoration-2">{c.work_orders.wo_no}</Link>],
              ["Saat diajukan", c.was_overdue ? <Badge key="o" tone="bad">WO sudah overdue</Badge> : "Belum overdue"],
            ]}
          />
        </Card>
        {(history ?? []).length > 0 && (
          <Card title="Riwayat perubahan WO sebelumnya">
            <ul className="space-y-1 text-sm">
              {(history ?? []).map((h) => (
                <li key={h.id}>
                  <Link href={`/maintenance/schedule-changes/${h.id}`} className="underline decoration-brand decoration-2">
                    {h.change_no}
                  </Link>{" "}
                  · {fmtDateTime(h.old_start)} → {fmtDateTime(h.new_start)} · <StatusBadge map={SCHEDULE_STATUS} value={h.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="Lampiran">
          <AttachmentsPanel entity="SCHEDULE_CHANGE" entityId={id} items={attachments} canAdd={mine && ["REQUESTED", "REVISION"].includes(c.status)} canDelete={false} />
        </Card>
        <Card title="Log approval">
          {(log ?? []).length ? (
            <DataTable head={["Waktu", "Aksi", "Oleh", "Catatan"]}>
              {(log ?? []).map((a) => (
                <tr key={a.id}>
                  <td className={TD}>{fmtDateTime(a.acted_at)}</td>
                  <td className={TD}>
                    <StatusBadge map={APPROVAL_ACTION} value={a.action} />
                  </td>
                  <td className={TD}>{a.actor_name ?? "Sistem"}</td>
                  <td className={TD}>{a.note ?? "-"}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <p className="text-sm text-muted">Belum ada log.</p>
          )}
        </Card>
      </div>
    </>
  );
}
