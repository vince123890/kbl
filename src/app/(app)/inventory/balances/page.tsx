import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cleanQuery, hrefBuilder, one, pageOf } from "@/lib/lookups";
import { fmtQty } from "@/lib/format";
import { Badge, ButtonLink, DataTable, EmptyState, PageHeader, Pagination, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";

export const metadata = { title: "Saldo Stok" };
const PAGE_SIZE = 50;

interface Row {
  sparepart_id: string;
  location_id: string;
  kode: string;
  sparepart: string;
  kategori: string;
  lokasi: string;
  on_hand: string;
  reservasi: string;
  tersedia: string;
  stok_min: string;
  di_bawah_min: boolean;
}

export default async function BalancesPage({ searchParams }: PageProps<"/inventory/balances">) {
  await requirePermission("stock.read");
  const sp = await searchParams;
  const page = pageOf(sp);
  const q = cleanQuery(one(sp, "q"));
  const supabase = await createClient();

  let query = supabase.from("rpt_03_posisi_stok").select("*", { count: "exact" });
  if (one(sp, "branch")) query = query.eq("branch_id", one(sp, "branch"));
  if (one(sp, "location")) query = query.eq("location_id", one(sp, "location"));
  if (one(sp, "category")) query = query.eq("kategori", one(sp, "category"));
  if (one(sp, "low") === "1") query = query.eq("di_bawah_min", true);
  if (q) query = query.or(`kode.ilike.%${q}%,sparepart.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("kode").order("lokasi").range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as Row[];

  const [{ data: branches }, { data: locations }, { data: cats }] = await Promise.all([
    supabase.from("branches").select("id,name").order("name"),
    supabase.from("locations").select("id,name").eq("is_active", true).order("name"),
    supabase.from("spareparts").select("category").eq("is_active", true),
  ]);
  const categories = [...new Set((cats ?? []).map((c) => c.category as string))].sort();
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Saldo Stok"
        subtitle={`${count ?? 0} baris. Saldo hanya berubah lewat mutasi yang diposting; tidak dapat diedit langsung.`}
        actions={<ButtonLink href={`/reports/RPT-03/export?${exportQs}`}>Ekspor CSV</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Cari kode atau nama sparepart…" />
        <FilterSelect name="branch" label="Cabang" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect name="location" label="Lokasi" options={(locations ?? []).map((l) => ({ value: l.id, label: l.name }))} />
        <FilterSelect name="category" label="Kategori" options={categories.map((c) => ({ value: c, label: c }))} />
        <FilterSelect name="low" label="Stok" allLabel="Semua" options={[{ value: "1", label: "Di bawah minimum" }]} />
      </div>
      {!rows.length ? (
        <EmptyState>Belum ada saldo stok. Catat saldo awal lewat Mutasi Masuk.</EmptyState>
      ) : (
        <DataTable head={["Kode", "Sparepart", "Kategori", "Lokasi", "On hand", "Reservasi", "Tersedia", "Min", "Status"]}>
          {rows.map((r) => (
            <tr key={`${r.sparepart_id}:${r.location_id}`}>
              <td className={TD}>{r.kode}</td>
              <td className={TD}>
                <Link href={`/inventory/stock-cards/${r.sparepart_id}?location=${r.location_id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {r.sparepart}
                </Link>
              </td>
              <td className={TD}>{r.kategori}</td>
              <td className={TD}>{r.lokasi}</td>
              <td className={`${TD} tabular-nums`}>{fmtQty(r.on_hand)}</td>
              <td className={`${TD} tabular-nums`}>{fmtQty(r.reservasi)}</td>
              <td className={`${TD} tabular-nums`}>{fmtQty(r.tersedia)}</td>
              <td className={`${TD} tabular-nums`}>{fmtQty(r.stok_min)}</td>
              <td className={TD}>{r.di_bawah_min ? <Badge tone="bad">Di bawah minimum</Badge> : <Badge tone="good">Aman</Badge>}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefBuilder("/inventory/balances", sp)} />
    </>
  );
}
