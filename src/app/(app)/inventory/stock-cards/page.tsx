import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cleanQuery, hrefBuilder, one, pageOf } from "@/lib/lookups";
import { fmtQty } from "@/lib/format";
import { DataTable, EmptyState, PageHeader, Pagination, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";

export const metadata = { title: "Kartu Stok" };
const PAGE_SIZE = 50;

export default async function StockCardsPage({ searchParams }: PageProps<"/inventory/stock-cards">) {
  await requirePermission("stock.read");
  const sp = await searchParams;
  const page = pageOf(sp);
  const q = cleanQuery(one(sp, "q"));
  const supabase = await createClient();

  let query = supabase.from("spareparts").select("id,code,name,category,uom,min_stock", { count: "exact" }).eq("is_active", true);
  if (one(sp, "category")) query = query.eq("category", one(sp, "category"));
  if (q) query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("code").range(from, from + PAGE_SIZE - 1);
  const rows = data ?? [];

  const ids = rows.map((r) => r.id);
  const { data: bal } = ids.length ? await supabase.from("stock_balances").select("sparepart_id,qty_on_hand").in("sparepart_id", ids) : { data: [] };
  const total = new Map<string, number>();
  for (const b of bal ?? []) total.set(b.sparepart_id, (total.get(b.sparepart_id) ?? 0) + Number(b.qty_on_hand));
  const { data: cats } = await supabase.from("spareparts").select("category").eq("is_active", true);
  const categories = [...new Set((cats ?? []).map((c) => c.category as string))].sort();

  return (
    <>
      <PageHeader title="Kartu Stok" subtitle="Pilih sparepart untuk melihat riwayat keluar-masuk dan saldo berjalan." />
      <div className="filter-bar">
        <SearchBox placeholder="Cari kode atau nama sparepart…" />
        <FilterSelect name="category" label="Kategori" options={categories.map((c) => ({ value: c, label: c }))} />
      </div>
      {!rows.length ? (
        <EmptyState>Tidak ada sparepart yang cocok.</EmptyState>
      ) : (
        <DataTable head={["Kode", "Sparepart", "Kategori", "Saldo total", "Satuan"]}>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className={TD}>{s.code}</td>
              <td className={TD}>
                <Link href={`/inventory/stock-cards/${s.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {s.name}
                </Link>
              </td>
              <td className={TD}>{s.category}</td>
              <td className={`${TD} tabular-nums`}>{fmtQty(total.get(s.id) ?? 0)}</td>
              <td className={TD}>{s.uom}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefBuilder("/inventory/stock-cards", sp)} />
    </>
  );
}
