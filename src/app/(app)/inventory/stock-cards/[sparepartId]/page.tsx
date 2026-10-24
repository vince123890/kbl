import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hrefBuilder, one, pageOf } from "@/lib/lookups";
import { fmtDateTime, fmtQty } from "@/lib/format";
import { STOCK_TYPE } from "@/lib/labels";
import { ButtonLink, Card, DataTable, EmptyState, PageHeader, Pagination, TD } from "@/components/ui";
import { FilterSelect } from "@/components/list-controls";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Kartu Stok Sparepart" };
const PAGE_SIZE = 100;

interface Mv {
  id: number;
  posted_at: string;
  doc_no: string;
  document_id: string;
  doc_type: string;
  qty_delta: string;
  balance_after: string;
  vehicle_id: string | null;
  vehicles: { plate_no: string } | null;
  work_orders: { wo_no: string } | null;
  locations: { name: string } | null;
}

export default async function StockCardPage({ params, searchParams }: PageProps<"/inventory/stock-cards/[sparepartId]">) {
  const { sparepartId } = await params;
  await requirePermission("stock.read");
  const sp = await searchParams;
  const page = pageOf(sp);
  const supabase = await createClient();

  const { data: part } = await supabase.from("spareparts").select("id,code,name,uom,category,min_stock").eq("id", sparepartId).maybeSingle();
  if (!part) notFound();

  let query = supabase
    .from("stock_movements")
    .select("id,posted_at,doc_no,document_id,doc_type,qty_delta,balance_after,vehicle_id,vehicles(plate_no),work_orders(wo_no),locations(name)", { count: "exact" })
    .eq("sparepart_id", sparepartId);
  if (one(sp, "location")) query = query.eq("location_id", one(sp, "location"));
  if (one(sp, "type")) query = query.eq("doc_type", one(sp, "type"));
  if (one(sp, "from")) query = query.gte("posted_at", `${one(sp, "from")}T00:00:00+07:00`);
  if (one(sp, "to")) query = query.lte("posted_at", `${one(sp, "to")}T23:59:59+07:00`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("posted_at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Mv[];

  const [{ data: bal }, { data: locs }] = await Promise.all([
    supabase.from("stock_balances").select("location_id,qty_on_hand,qty_reserved,locations(name)").eq("sparepart_id", sparepartId),
    supabase.from("locations").select("id,name").eq("is_active", true).order("name"),
  ]);
  const balances = (bal ?? []) as unknown as { location_id: string; qty_on_hand: string; qty_reserved: string; locations: { name: string } }[];
  const totalIn = rows.reduce((a, r) => a + Math.max(Number(r.qty_delta), 0), 0);
  const totalOut = rows.reduce((a, r) => a + Math.max(-Number(r.qty_delta), 0), 0);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title={`Kartu Stok · ${part.name}`}
        subtitle={`${part.code} · ${part.category} · satuan ${part.uom}`}
        actions={
          <>
            <PrintButton label="Cetak kartu" />
            <ButtonLink href={`/reports/RPT-02/export?sparepart=${sparepartId}&${qs}`}>Ekspor CSV</ButtonLink>
            <ButtonLink href="/inventory/stock-cards">Semua sparepart</ButtonLink>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {balances.map((b) => (
          <Card key={b.location_id} title={b.locations.name}>
            <p className="text-2xl font-semibold tabular-nums">{fmtQty(b.qty_on_hand)}</p>
            <p className="text-xs text-muted">Reservasi {fmtQty(b.qty_reserved)} · tersedia {fmtQty(Number(b.qty_on_hand) - Number(b.qty_reserved))}</p>
          </Card>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <FilterSelect name="location" label="Lokasi" options={(locs ?? []).map((l) => ({ value: l.id, label: l.name }))} />
        <FilterSelect name="type" label="Tipe" options={Object.entries(STOCK_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
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
        <EmptyState>Belum ada pergerakan stok untuk sparepart ini pada filter yang dipilih.</EmptyState>
      ) : (
        <>
          <DataTable head={["Tanggal posting", "No. Dokumen", "Tipe", "Lokasi", "Masuk (+)", "Keluar (−)", "Saldo", "Kendaraan / WO"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={TD}>{fmtDateTime(r.posted_at)}</td>
                <td className={TD}>
                  <Link href={`/inventory/movements/${r.document_id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                    {r.doc_no}
                  </Link>
                </td>
                <td className={TD}>{STOCK_TYPE[r.doc_type]?.label}</td>
                <td className={TD}>{r.locations?.name}</td>
                <td className={`${TD} tabular-nums`}>{Number(r.qty_delta) > 0 ? fmtQty(r.qty_delta) : ""}</td>
                <td className={`${TD} tabular-nums`}>{Number(r.qty_delta) < 0 ? fmtQty(Math.abs(Number(r.qty_delta))) : ""}</td>
                <td className={`${TD} font-medium tabular-nums`}>{fmtQty(r.balance_after)}</td>
                <td className={TD}>
                  {r.vehicles?.plate_no ?? ""}
                  {r.work_orders && <span className="block text-xs text-muted">{r.work_orders.wo_no}</span>}
                </td>
              </tr>
            ))}
            <tr className="bg-background font-medium">
              <td className={TD} colSpan={4}>
                Jumlah pada halaman ini
              </td>
              <td className={`${TD} tabular-nums`}>{fmtQty(totalIn)}</td>
              <td className={`${TD} tabular-nums`}>{fmtQty(totalOut)}</td>
              <td className={TD} colSpan={2} />
            </tr>
          </DataTable>
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefBuilder(`/inventory/stock-cards/${sparepartId}`, sp)} />
        </>
      )}
    </>
  );
}
