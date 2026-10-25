import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cleanQuery, hrefBuilder, one, pageOf } from "@/lib/lookups";
import { fmtAge, fmtDateTime } from "@/lib/format";
import { APPROVAL_ACTION, DOC_TYPE, label } from "@/lib/labels";
import { DataTable, EmptyState, PageHeader, Pagination, StatusBadge, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";

export const metadata = { title: "Riwayat Approval" };
const PAGE_SIZE = 50;
const DECISIONS = ["APPROVE", "REJECT", "REVISE", "OVERRIDE", "ESCALATE", "AUTO_APPROVE", "CANCEL", "POST_FAILED", "SLA_BREACH"];

interface Row {
  id: number;
  action: string;
  note: string | null;
  acted_at: string;
  actor_name: string | null;
  actor_role: string | null;
  approval_requests: { id: string; doc_type: string; doc_no: string | null; requested_at: string } | null;
}

export default async function HistoryPage({ searchParams }: PageProps<"/approvals/history">) {
  await requireUser();
  const sp = await searchParams;
  const page = pageOf(sp);
  const q = cleanQuery(one(sp, "q"));
  const supabase = await createClient();

  let query = supabase
    .from("approval_actions")
    .select("id,action,note,acted_at,actor_name,actor_role,approval_requests!inner(id,doc_type,doc_no,requested_at)", { count: "exact" })
    .neq("action", "SUBMIT")
    .neq("action", "REMIND");
  if (one(sp, "action")) query = query.eq("action", one(sp, "action"));
  if (one(sp, "type")) query = query.eq("approval_requests.doc_type", one(sp, "type"));
  if (one(sp, "from")) query = query.gte("acted_at", `${one(sp, "from")}T00:00:00+07:00`);
  if (one(sp, "to")) query = query.lte("acted_at", `${one(sp, "to")}T23:59:59+07:00`);
  if (q) query = query.or(`actor_name.ilike.%${q}%,note.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Riwayat Approval" subtitle={`${count ?? 0} keputusan tercatat. Log bersifat permanen.`} />
      <div className="filter-bar">
        <SearchBox placeholder="Cari approver atau catatan…" />
        <FilterSelect name="type" label="Jenis" options={Object.entries(DOC_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="action" label="Keputusan" options={DECISIONS.map((value) => ({ value, label: label(APPROVAL_ACTION, value) }))} />
        <DateFilters />
      </div>
      {!rows.length ? (
        <EmptyState>Belum ada keputusan yang cocok dengan filter.</EmptyState>
      ) : (
        <DataTable head={["Waktu", "Dokumen", "Keputusan", "Oleh", "Catatan", "Lama proses"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={TD}>{fmtDateTime(r.acted_at)}</td>
              <td className={TD}>
                {r.approval_requests ? (
                  <Link href={`/approvals/${r.approval_requests.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                    {r.approval_requests.doc_no}
                  </Link>
                ) : (
                  "-"
                )}
                <span className="block text-xs text-muted">{label(DOC_TYPE, r.approval_requests?.doc_type)}</span>
              </td>
              <td className={TD}>
                <StatusBadge map={APPROVAL_ACTION} value={r.action} />
              </td>
              <td className={TD}>
                {r.actor_name ?? "Sistem"}
                <span className="block text-xs text-muted">{r.actor_role}</span>
              </td>
              <td className={TD}>{r.note ?? <span className="text-muted">-</span>}</td>
              <td className={TD}>{r.approval_requests ? fmtAge(r.approval_requests.requested_at, new Date(r.acted_at)) : "-"}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefBuilder("/approvals/history", sp)} />
    </>
  );
}

function DateFilters() {
  return (
    <form className="flex items-center gap-2 text-sm" method="get">
      <label className="flex items-center gap-1">
        Dari <input type="date" name="from" className="tap rounded-lg border border-border bg-surface px-2" />
      </label>
      <label className="flex items-center gap-1">
        Sampai <input type="date" name="to" className="tap rounded-lg border border-border bg-surface px-2" />
      </label>
      <button className="tap rounded-lg border border-border px-3">Terapkan</button>
    </form>
  );
}
