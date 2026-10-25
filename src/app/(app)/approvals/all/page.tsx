import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cleanQuery, nameMap, one } from "@/lib/lookups";
import { fmtAge } from "@/lib/format";
import { nowMs } from "@/lib/clock";
import { DOC_TYPE, label } from "@/lib/labels";
import { Badge, Card, DataTable, EmptyState, PageHeader, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";

export const metadata = { title: "Semua Antrean Approval" };

interface Step {
  n: number;
  role: string;
  sla_hours: number;
}

export default async function AllApprovalsPage({ searchParams }: PageProps<"/approvals/all">) {
  await requirePermission("approval.viewall");
  const sp = await searchParams;
  const type = one(sp, "type");
  const branch = one(sp, "branch");
  const late = one(sp, "late");
  const q = cleanQuery(one(sp, "q")).toLowerCase();

  const supabase = await createClient();
  const { data } = await supabase
    .from("approval_requests")
    .select("id,doc_type,doc_no,summary,branch_id,steps,current_step,step_started_at,requested_by,requested_at")
    .eq("status", "PENDING")
    .order("requested_at");
  const all = data ?? [];
  const [people, branches] = await Promise.all([
    nameMap(supabase, "profiles", all.map((r) => r.requested_by)),
    nameMap(supabase, "branches", all.map((r) => r.branch_id)),
  ]);
  const { data: branchList } = await supabase.from("branches").select("id,name").order("name");

  const now = nowMs();
  const enriched = all.map((r) => {
    const step = (r.steps as Step[])[r.current_step - 1];
    const due = new Date(r.step_started_at).getTime() + step.sla_hours * 3600_000;
    return { ...r, step, late: now > due };
  });

  let rows = enriched;
  if (type) rows = rows.filter((r) => r.doc_type === type);
  if (branch) rows = rows.filter((r) => r.branch_id === branch);
  if (late === "1") rows = rows.filter((r) => r.late);
  if (q) rows = rows.filter((r) => `${r.doc_no} ${r.summary}`.toLowerCase().includes(q));
  rows = [...rows].sort((a, b) => Number(b.late) - Number(a.late) || a.requested_at.localeCompare(b.requested_at));

  const perType = Object.keys(DOC_TYPE).map((t) => ({ t, n: enriched.filter((r) => r.doc_type === t).length }));
  const perBranch = (branchList ?? []).map((b) => ({ b: b.name, n: enriched.filter((r) => r.branch_id === b.id).length })).filter((x) => x.n);
  const lateCount = enriched.filter((r) => r.late).length;

  return (
    <>
      <PageHeader title="Semua Antrean Approval" subtitle="Seluruh cabang. Override dan eskalasi dilakukan dari halaman detail." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card title="Menunggu per jenis">
          <ul className="space-y-1 text-sm">
            {perType.map((x) => (
              <li key={x.t} className="flex justify-between">
                <span>{label(DOC_TYPE, x.t)}</span>
                <b>{x.n}</b>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Menunggu per cabang">
          {perBranch.length ? (
            <ul className="space-y-1 text-sm">
              {perBranch.map((x) => (
                <li key={x.b} className="flex justify-between">
                  <span>{x.b}</span>
                  <b>{x.n}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Tidak ada data.</p>
          )}
        </Card>
        <Card title="Terlambat SLA">
          <p className="text-3xl font-semibold">{lateCount}</p>
        </Card>
      </div>
      <div className="filter-bar">
        <SearchBox placeholder="Cari no. dokumen atau ringkasan…" />
        <FilterSelect name="type" label="Jenis" options={Object.entries(DOC_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="branch" label="Cabang" options={(branchList ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect name="late" label="SLA" options={[{ value: "1", label: "Terlambat saja" }]} />
      </div>
      {!rows.length ? (
        <EmptyState>Tidak ada antrean yang cocok.</EmptyState>
      ) : (
        <DataTable head={["Jenis", "No. Dokumen", "Ringkasan", "Cabang", "Menunggu", "Umur", "SLA"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={TD}>{label(DOC_TYPE, r.doc_type)}</td>
              <td className={TD}>
                <Link href={`/approvals/${r.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {r.doc_no}
                </Link>
              </td>
              <td className={TD}>{r.summary}</td>
              <td className={TD}>{branches.get(r.branch_id) ?? "-"}</td>
              <td className={TD}>
                {r.step.role}
                <span className="block text-xs text-muted">
                  level {r.current_step}/{(r.steps as Step[]).length} · diajukan {people.get(r.requested_by) ?? "-"}
                </span>
              </td>
              <td className={TD}>{fmtAge(r.requested_at)}</td>
              <td className={TD}>{r.late ? <Badge tone="bad">Terlambat</Badge> : <span className="text-muted">{r.step.sla_hours} jam</span>}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
