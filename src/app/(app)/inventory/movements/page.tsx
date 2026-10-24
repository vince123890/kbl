import Link from "next/link";
import { can, requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hrefBuilder, nameMap, one, pageOf } from "@/lib/lookups";
import { queryMovements } from "@/lib/inventory-query";
import { fmtDate } from "@/lib/format";
import { STOCK_STATUS, STOCK_TYPE } from "@/lib/labels";
import { ButtonLink, DataTable, EmptyState, PageHeader, Pagination, StatusBadge, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";

export const metadata = { title: "Mutasi Sparepart" };
const PAGE_SIZE = 50;

export default async function MovementsPage({ searchParams }: PageProps<"/inventory/movements">) {
  const user = await requirePermission("stock.read");
  const sp = await searchParams;
  const page = pageOf(sp);
  const supabase = await createClient();

  const from = (page - 1) * PAGE_SIZE;
  const [{ rows, count }, { data: branches }, { data: vehicles }] = await Promise.all([
    queryMovements(supabase, sp, [from, from + PAGE_SIZE - 1]),
    supabase.from("branches").select("id,name").order("name"),
    supabase.from("vehicles").select("id,plate_no").eq("is_active", true).order("plate_no"),
  ]);
  const creators = await nameMap(supabase, "profiles", rows.map((r) => r.created_by));
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Mutasi Sparepart"
        subtitle={`${count} dokumen. Stok hanya berubah saat dokumen berstatus Diposting.`}
        actions={
          <>
            <ButtonLink href={`/inventory/movements/export?${exportQs}`}>Ekspor CSV</ButtonLink>
            {can(user, "stock.create") && (
              <ButtonLink href="/inventory/movements/new" primary>
                + Mutasi Baru
              </ButtonLink>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Cari no. dokumen, sparepart, no. polisi…" />
        <FilterSelect name="type" label="Tipe" options={Object.entries(STOCK_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="status" label="Status" options={Object.entries(STOCK_STATUS).map(([value, d]) => ({ value, label: d.label }))} />
        {user.isHq || can(user, "branch.all") ? (
          <FilterSelect name="branch" label="Cabang" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        ) : null}
        <FilterSelect name="vehicle" label="Kendaraan" options={(vehicles ?? []).map((v) => ({ value: v.id, label: v.plate_no }))} />
        <form method="get" className="flex items-center gap-2 text-sm">
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
        <EmptyState>Belum ada mutasi yang cocok. {can(user, "stock.create") && "Buat mutasi baru untuk mencatat keluar-masuk sparepart."}</EmptyState>
      ) : (
        <DataTable head={["No. Dokumen", "Tanggal", "Tipe", "Kendaraan / WO", "Lokasi", "Item", "Status", "Dibuat oleh"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={TD}>
                <Link href={`/inventory/movements/${r.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {r.doc_no}
                </Link>
              </td>
              <td className={TD}>{fmtDate(r.doc_date)}</td>
              <td className={TD}>{STOCK_TYPE[r.type]?.label}</td>
              <td className={TD}>
                {r.vehicles?.plate_no ?? <span className="text-muted">-</span>}
                {r.work_orders && <span className="block text-xs text-muted">{r.work_orders.wo_no}</span>}
              </td>
              <td className={TD}>
                {r.from_loc?.name ?? ""}
                {r.from_loc && r.to_loc ? " → " : ""}
                {r.to_loc?.name ?? ""}
                {!r.from_loc && !r.to_loc && <span className="text-muted">-</span>}
              </td>
              <td className={TD}>{r.stock_document_lines[0]?.count ?? 0}</td>
              <td className={TD}>
                <StatusBadge map={STOCK_STATUS} value={r.status} />
              </td>
              <td className={TD}>{creators.get(r.created_by ?? "") ?? "-"}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count} hrefFor={hrefBuilder("/inventory/movements", sp)} />
    </>
  );
}
