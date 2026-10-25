import Link from "next/link";
import { can, requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hrefBuilder, one, pageOf } from "@/lib/lookups";
import { queryWorkOrders } from "@/lib/wo-query";
import { fmtDateTime } from "@/lib/format";
import { PRIORITY, VALIDATION, WO_STATUS, WO_TYPE } from "@/lib/labels";
import { Badge, ButtonLink, DataTable, EmptyState, PageHeader, Pagination, StatusBadge, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";

export const metadata = { title: "Work Order" };
const PAGE_SIZE = 50;

export default async function WorkOrdersPage({ searchParams }: PageProps<"/maintenance/work-orders">) {
  const user = await requirePermission("wo.read");
  const sp = await searchParams;
  const page = pageOf(sp);
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  const [{ rows, count }, { data: branches }, { data: vehicles }, { data: vendors }] = await Promise.all([
    queryWorkOrders(supabase, sp, [from, from + PAGE_SIZE - 1]),
    supabase.from("branches").select("id,name").order("name"),
    supabase.from("vehicles").select("id,plate_no").eq("is_active", true).order("plate_no"),
    supabase.from("vendors").select("id,name").eq("type", "BENGKEL").order("name"),
  ]);
  const { data: techs } = can(user, "wo.write")
    ? await supabase.rpc("wo_assignees", { p_branch: user.branchId })
    : { data: [] as { id: string; name: string }[] };
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Work Order"
        subtitle={`${count} WO. Preventif dibuat otomatis dari Rencana Perawatan.`}
        actions={
          <>
            <ButtonLink href={`/maintenance/work-orders/export?${exportQs}`}>Ekspor CSV</ButtonLink>
            {can(user, "wo.write") && (
              <ButtonLink href="/maintenance/work-orders/new" primary>
                + WO Baru
              </ButtonLink>
            )}
          </>
        }
      />
      <div className="filter-bar">
        <SearchBox placeholder="Cari no. WO atau no. polisi…" />
        <FilterSelect name="type" label="Jenis" options={Object.entries(WO_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="status" label="Status" options={Object.entries(WO_STATUS).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="branch" label="Cabang" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect name="vehicle" label="Kendaraan" options={(vehicles ?? []).map((v) => ({ value: v.id, label: v.plate_no }))} />
        <FilterSelect name="vendor" label="Bengkel" options={(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))} />
        {(techs ?? []).length > 0 && <FilterSelect name="assignee" label="Teknisi" options={(techs ?? []).map((t: { id: string; name: string }) => ({ value: t.id, label: t.name }))} />}
        <FilterSelect name="overdue" label="Overdue" allLabel="Semua" options={[{ value: "1", label: "Overdue saja" }]} />
        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          {Object.entries(sp).map(([k, v]) => typeof v === "string" && v && k !== "from" && k !== "to" && k !== "page" ? <input key={k} type="hidden" name={k} value={v} /> : null)}
          <label className="flex items-center gap-1">
            Dari <input type="date" name="from" defaultValue={one(sp, "from")} className="tap rounded-lg border border-border bg-surface px-2" />
          </label>
          <label className="flex items-center gap-1">
            Sampai <input type="date" name="to" defaultValue={one(sp, "to")} className="tap rounded-lg border border-border bg-surface px-2" />
          </label>
          <button className="tap rounded-lg border border-border px-3">Terapkan</button>
        </form>
      </div>

      {!rows.length ? (
        <EmptyState>Belum ada Work Order yang cocok.</EmptyState>
      ) : (
        <DataTable head={["No. WO", "Kendaraan", "Jenis", "Prioritas", "Jadwal", "Bengkel / Teknisi", "Status", "Penanda"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={TD}>
                <Link href={`/maintenance/work-orders/${r.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {r.wo_no}
                </Link>
                {r.description && <span className="block max-w-56 truncate text-xs text-muted">{r.description}</span>}
              </td>
              <td className={TD}>{r.vehicles?.plate_no}</td>
              <td className={TD}>
                <StatusBadge map={WO_TYPE} value={r.type} />
              </td>
              <td className={TD}>
                <StatusBadge map={PRIORITY} value={r.priority} />
              </td>
              <td className={TD}>
                {r.scheduled_start ? fmtDateTime(r.scheduled_start) : <span className="text-muted">Belum dijadwalkan</span>}
                {r.due_at && <span className="block text-xs text-muted">Jatuh tempo {fmtDateTime(r.due_at)}</span>}
              </td>
              <td className={TD}>
                {r.vendors?.name ?? ""}
                {r.vendors && r.profiles ? " · " : ""}
                {r.profiles?.name ?? ""}
                {!r.vendors && !r.profiles && <span className="text-muted">-</span>}
              </td>
              <td className={TD}>
                <StatusBadge map={WO_STATUS} value={r.status} />
              </td>
              <td className={TD}>
                <div className="flex flex-wrap gap-1">
                  {r.is_overdue && <Badge tone="bad">⏰ Overdue</Badge>}
                  {r.schedule_changed && <Badge tone="warn">Berubah jadwal</Badge>}
                  {r.needs_reschedule && <Badge tone="warn">Perlu dijadwal ulang</Badge>}
                  {r.auto_generated && <Badge>Dibuat otomatis</Badge>}
                  {r.type === "EMERGENCY" && r.emergency_validation === "PENDING" && <Badge tone="warn">{VALIDATION.PENDING.label}</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count} hrefFor={hrefBuilder("/maintenance/work-orders", sp)} />
    </>
  );
}
