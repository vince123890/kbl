import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { nameMap } from "@/lib/lookups";
import { fmtAge, fmtDateTime } from "@/lib/format";
import { APPROVAL_ACTION, APPROVAL_STATUS, DOC_TYPE, docHref, label } from "@/lib/labels";
import { Card, DataTable, KeyValue, Notice, PageHeader, StatusBadge, TD } from "@/components/ui";
import { ApprovalPanel } from "@/components/approval-panel";

export const metadata = { title: "Detail Approval" };

interface Step {
  n: number;
  role: string;
  sla_hours: number;
}

export default async function ApprovalDetailPage({ params }: PageProps<"/approvals/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: r } = await supabase.from("approval_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: actions } = await supabase.from("approval_actions").select("*").eq("request_id", id).order("id");
  const [people, branches] = await Promise.all([
    nameMap(supabase, "profiles", [r.requested_by]),
    nameMap(supabase, "branches", [r.branch_id]),
  ]);

  const steps = r.steps as Step[];
  const step = steps[r.current_step - 1];
  const pending = r.status === "PENDING";
  const canDecide = pending && can(user, "approval.act") && !!step && user.roles.includes(step.role) && r.requested_by !== user.id;
  const canOverride = pending && can(user, "approval.override") && r.requested_by !== user.id;
  const failed = (actions ?? []).filter((a) => a.action === "POST_FAILED").at(-1);

  return (
    <>
      <PageHeader
        title={`Approval ${r.doc_no ?? ""}`}
        subtitle={label(DOC_TYPE, r.doc_type)}
        actions={
          <Link href={docHref(r.doc_type, r.doc_id)} className="tap inline-flex items-center rounded-lg border border-border px-4 text-sm hover:bg-brand-soft">
            Buka dokumen penuh
          </Link>
        }
      />
      {pending && failed && <Notice tone="bad">Percobaan terakhir gagal diproses: {failed.note}. Dokumen tetap menunggu keputusan.</Notice>}
      {pending && r.requested_by === user.id && <Notice>Anda yang mengajukan dokumen ini, sehingga tidak dapat memutuskannya sendiri.</Notice>}

      <div className="space-y-4">
        <Card>
          <KeyValue
            items={[
              ["Status", <StatusBadge key="s" map={APPROVAL_STATUS} value={r.status} />],
              ["Ringkasan", r.summary],
              ["Cabang", branches.get(r.branch_id)],
              ["Diajukan oleh", people.get(r.requested_by)],
              ["Diajukan", `${fmtDateTime(r.requested_at)} (${fmtAge(r.requested_at)} lalu)`],
              ["Level", pending && step ? `Level ${r.current_step} dari ${steps.length} · menunggu ${step.role}` : steps.length ? `${steps.length} level` : "Tanpa level (otomatis)"],
              ["Diputuskan", r.decided_at ? fmtDateTime(r.decided_at) : null],
              ["Catatan keputusan", r.decision_note],
            ]}
          />
        </Card>

        {steps.length > 0 && (
          <Card title="Alur">
            <ol className="flex flex-wrap gap-2 text-sm">
              {steps.map((s) => {
                const done = r.status === "APPROVED" || s.n < r.current_step;
                const now = pending && s.n === r.current_step;
                return (
                  <li
                    key={s.n}
                    className={`rounded-lg border px-3 py-1.5 ${now ? "border-brand bg-brand-soft font-medium" : done ? "border-border" : "border-dashed border-border text-muted"}`}
                  >
                    {s.n}. {s.role} <span className="text-xs text-muted">SLA {s.sla_hours} jam</span>
                    {done && <span className="ml-1">✓</span>}
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

        {(canDecide || canOverride) && (
          <Card title="Keputusan">
            <ApprovalPanel requestId={r.id} canDecide={canDecide} canOverride={canOverride} isLast={r.current_step >= steps.length} />
          </Card>
        )}

        <Card title="Log approval">
          <DataTable head={["Waktu", "Aksi", "Oleh", "Status", "Catatan"]}>
            {(actions ?? []).map((a) => (
              <tr key={a.id}>
                <td className={TD}>{fmtDateTime(a.acted_at)}</td>
                <td className={TD}>
                  <StatusBadge map={APPROVAL_ACTION} value={a.action} />
                  {a.step_no > 0 && <span className="ml-1 text-xs text-muted">level {a.step_no}</span>}
                </td>
                <td className={TD}>
                  {a.actor_name ?? "Sistem"}
                  <span className="block text-xs text-muted">{a.actor_role}</span>
                </td>
                <td className={TD}>
                  {a.from_status ?? "-"} → {a.to_status ?? "-"}
                </td>
                <td className={TD}>{a.note ?? <span className="text-muted">-</span>}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </>
  );
}
