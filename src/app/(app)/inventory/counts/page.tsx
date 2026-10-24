import Link from "next/link";
import { can, requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hrefBuilder, one, pageOf } from "@/lib/lookups";
import { fmtDate } from "@/lib/format";
import { COUNT_STATUS, COUNT_TYPE } from "@/lib/labels";
import { DataTable, EmptyState, PageHeader, Pagination, StatusBadge, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";
import { OpenCountButton } from "@/components/open-count-button";

export const metadata = { title: "Stock Opname" };
const PAGE_SIZE = 50;

interface Row {
  id: string;
  count_no: string;
  type: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  locations: { name: string } | null;
  stock_count_lines: { count: number }[];
}

export default async function CountsPage({ searchParams }: PageProps<"/inventory/counts">) {
  const user = await requirePermission("stock.read");
  const sp = await searchParams;
  const page = pageOf(sp);
  const supabase = await createClient();

  let query = supabase.from("stock_counts").select("id,count_no,type,status,opened_at,closed_at,locations(name),stock_count_lines(count)", { count: "exact" });
  if (one(sp, "status")) query = query.eq("status", one(sp, "status"));
  if (one(sp, "type")) query = query.eq("type", one(sp, "type"));
  if (one(sp, "location")) query = query.eq("location_id", one(sp, "location"));
  if (one(sp, "q")) query = query.ilike("count_no", `%${one(sp, "q").trim()}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("opened_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Row[];

  const ids = rows.map((r) => r.id);
  const { data: diffs } = ids.length ? await supabase.from("stock_count_lines").select("count_id,diff_qty").in("count_id", ids).neq("diff_qty", 0) : { data: [] };
  const diffCount = new Map<string, number>();
  for (const d of diffs ?? []) diffCount.set(d.count_id, (diffCount.get(d.count_id) ?? 0) + 1);

  const [{ data: locs }, { data: cats }] = await Promise.all([
    supabase.from("locations").select("id,name").eq("is_active", true).order("name"),
    supabase.from("spareparts").select("category").eq("is_active", true),
  ]);
  const categories = [...new Set((cats ?? []).map((c) => c.category as string))].sort();

  return (
    <>
      <PageHeader
        title="Stock Opname"
        subtitle={`${count ?? 0} sesi`}
        actions={can(user, "count.create") ? <OpenCountButton locations={locs ?? []} categories={categories} /> : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Cari no. opname…" />
        <FilterSelect name="status" label="Status" options={Object.entries(COUNT_STATUS).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="type" label="Tipe" options={Object.entries(COUNT_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="location" label="Lokasi" options={(locs ?? []).map((l) => ({ value: l.id, label: l.name }))} />
      </div>
      {!rows.length ? (
        <EmptyState>Belum ada sesi opname. {can(user, "count.create") && "Buka sesi untuk mulai menghitung stok fisik."}</EmptyState>
      ) : (
        <DataTable head={["No. Opname", "Lokasi", "Tipe", "Dibuka", "Selesai", "Item", "Selisih", "Status"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={TD}>
                <Link href={`/inventory/counts/${r.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {r.count_no}
                </Link>
              </td>
              <td className={TD}>{r.locations?.name}</td>
              <td className={TD}>{COUNT_TYPE[r.type]?.label}</td>
              <td className={TD}>{fmtDate(r.opened_at)}</td>
              <td className={TD}>{r.closed_at ? fmtDate(r.closed_at) : "-"}</td>
              <td className={TD}>{r.stock_count_lines[0]?.count ?? 0}</td>
              <td className={TD}>{diffCount.get(r.id) ?? 0}</td>
              <td className={TD}>
                <StatusBadge map={COUNT_STATUS} value={r.status} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefBuilder("/inventory/counts", sp)} />
    </>
  );
}
