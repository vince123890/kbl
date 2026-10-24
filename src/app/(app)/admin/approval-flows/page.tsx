import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { DOC_TYPE, label } from "@/lib/labels";
import { FLOW_METRICS } from "@/lib/flow-config";
import { Badge, Card, PageHeader } from "@/components/ui";
import { FlowEditor } from "@/components/flow-editor";

export const metadata = { title: "Alur Approval" };

interface FlowRow {
  id: string;
  doc_type: string;
  name: string;
  is_active: boolean;
  version: number;
  updated_at: string;
  approval_flow_steps: { step_no: number; approver_role: string; sla_hours: number; cond_metric: string | null; cond_op: string | null; cond_value: number | null }[];
}

export default async function ApprovalFlowsPage() {
  await requirePermission("admin.flow");
  const supabase = await createClient();
  const [{ data }, { data: roles }] = await Promise.all([
    supabase
      .from("approval_flows")
      .select("id,doc_type,name,is_active,version,updated_at,approval_flow_steps(step_no,approver_role,sla_hours,cond_metric,cond_op,cond_value)")
      .order("version", { ascending: false }),
    supabase.from("roles").select("name,role_permissions(permission_code)").order("name"),
  ]);
  const flows = (data ?? []) as unknown as FlowRow[];
  const approverRoles = (roles ?? [])
    .filter((r) => (r.role_permissions as { permission_code: string }[]).some((p) => p.permission_code === "approval.act"))
    .map((r) => r.name);

  const metricLabel = (type: string, m: string | null) => FLOW_METRICS[type]?.find((x) => x.value === m)?.label ?? m;

  return (
    <>
      <PageHeader title="Alur Approval" subtitle="Level, role approver, SLA, dan kondisi ambang per jenis dokumen." />
      <div className="space-y-4">
        {Object.keys(DOC_TYPE).map((type) => {
          const versions = flows.filter((f) => f.doc_type === type);
          const active = versions.find((f) => f.is_active);
          const steps = [...(active?.approval_flow_steps ?? [])].sort((a, b) => a.step_no - b.step_no);
          return (
            <Card
              key={type}
              title={`${label(DOC_TYPE, type)}${active ? ` · ${active.name} (v${active.version})` : ""}`}
              actions={
                <FlowEditor
                  docType={type}
                  name={active?.name ?? label(DOC_TYPE, type)}
                  roles={approverRoles}
                  initial={steps.map((s) => ({
                    role: s.approver_role,
                    sla_hours: s.sla_hours,
                    metric: s.cond_metric ?? "",
                    op: s.cond_op ?? ">",
                    value: s.cond_value === null ? "" : String(s.cond_value),
                  }))}
                />
              }
            >
              {steps.length ? (
                <ol className="space-y-1 text-sm">
                  {steps.map((s) => (
                    <li key={s.step_no}>
                      <b>Level {s.step_no}:</b> {s.approver_role} · SLA {s.sla_hours} jam ·{" "}
                      {s.cond_metric ? (
                        <span>
                          bila {metricLabel(type, s.cond_metric)} {s.cond_op} {s.cond_value}
                        </span>
                      ) : (
                        <span className="text-muted">selalu berlaku</span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Tanpa level: dokumen otomatis disetujui.</p>
              )}
              {versions.length > 1 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted">Riwayat versi ({versions.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {versions.map((v) => (
                      <li key={v.id}>
                        v{v.version} · {v.name} · {fmtDateTime(v.updated_at)} {v.is_active && <Badge tone="good">Aktif</Badge>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
