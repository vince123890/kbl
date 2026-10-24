import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cleanQuery, nameMap, one } from "@/lib/lookups";
import { fmtAge } from "@/lib/format";
import { nowMs } from "@/lib/clock";
import { DOC_TYPE, label } from "@/lib/labels";
import { EmptyState, PageHeader } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";
import { InboxList, type InboxRow } from "@/components/inbox-list";
import { LiveRefresh } from "@/components/live-refresh";

export const metadata = { title: "Kotak Masuk Approval" };

interface Step {
  n: number;
  role: string;
  sla_hours: number;
}

export default async function InboxPage({ searchParams }: PageProps<"/approvals/inbox">) {
  const user = await requirePermission("approval.act");
  const sp = await searchParams;
  const type = one(sp, "type");
  const late = one(sp, "late");
  const q = cleanQuery(one(sp, "q")).toLowerCase();

  const supabase = await createClient();
  const { data } = await supabase
    .from("approval_requests")
    .select("id,doc_type,doc_id,doc_no,summary,branch_id,steps,current_step,step_started_at,requested_by,requested_at")
    .eq("status", "PENDING")
    .order("requested_at");

  const mine = (data ?? []).filter((r) => {
    const step = (r.steps as Step[])[r.current_step - 1];
    return step && user.roles.includes(step.role) && r.requested_by !== user.id;
  });

  const [people, branches, stockDocs] = await Promise.all([
    nameMap(supabase, "profiles", mine.map((r) => r.requested_by)),
    nameMap(supabase, "branches", mine.map((r) => r.branch_id)),
    mine.some((r) => r.doc_type === "STOCK")
      ? supabase.from("stock_documents").select("id,type").in("id", mine.filter((r) => r.doc_type === "STOCK").map((r) => r.doc_id))
      : Promise.resolve({ data: [] as { id: string; type: string }[] }),
  ]);
  const stockType = new Map((stockDocs.data ?? []).map((d) => [d.id, d.type]));

  const now = nowMs();
  let rows: InboxRow[] = mine.map((r) => {
    const step = (r.steps as Step[])[r.current_step - 1];
    const due = new Date(r.step_started_at).getTime() + step.sla_hours * 3600_000;
    const isLate = now > due;
    return {
      id: r.id,
      docType: r.doc_type,
      docLabel: label(DOC_TYPE, r.doc_type),
      docNo: r.doc_no ?? "-",
      summary: r.summary ?? "",
      requester: people.get(r.requested_by) ?? "-",
      branch: branches.get(r.branch_id) ?? "-",
      requestedAt: r.requested_at,
      age: fmtAge(r.requested_at),
      level: `Level ${r.current_step} dari ${(r.steps as Step[]).length}`,
      late: isLate,
      sla: `sisa ${Math.max(0, Math.round((due - now) / 3600_000))} jam`,
      batchable: r.doc_type === "STOCK" && stockType.get(r.doc_id) === "IN",
    };
  });
  if (type) rows = rows.filter((r) => r.docType === type);
  if (late === "1") rows = rows.filter((r) => r.late);
  if (q) rows = rows.filter((r) => `${r.docNo} ${r.summary} ${r.requester}`.toLowerCase().includes(q));
  rows.sort((a, b) => Number(b.late) - Number(a.late) || a.requestedAt.localeCompare(b.requestedAt));

  return (
    <>
      <LiveRefresh seconds={60} />
      <PageHeader title="Kotak Masuk Approval" subtitle={`${rows.length} dokumen menunggu keputusan Anda`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Cari no. dokumen, ringkasan, pengaju…" />
        <FilterSelect name="type" label="Jenis" options={Object.entries(DOC_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="late" label="SLA" allLabel="Semua" options={[{ value: "1", label: "Terlambat saja" }]} />
      </div>
      {rows.length ? <InboxList rows={rows} /> : <EmptyState>Tidak ada dokumen yang menunggu keputusan Anda.</EmptyState>}
    </>
  );
}
