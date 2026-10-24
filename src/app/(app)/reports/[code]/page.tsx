import { notFound, redirect } from "next/navigation";
import { can, requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hrefBuilder, one, pageOf } from "@/lib/lookups";
import { canViewReport, cellText, EXPORT_LIMIT, getReport, reportTotals, runReport } from "@/lib/reports";
import { fmtQty, todayWib } from "@/lib/format";
import { addDays } from "@/lib/calendar";
import { ButtonLink, Card, DataTable, EmptyState, Notice, PageHeader, Pagination, TD } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

const PAGE_SIZE = 50;

export async function generateMetadata({ params }: PageProps<"/reports/[code]">) {
  const { code } = await params;
  return { title: getReport(code)?.title ?? "Laporan" };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/reports/[code]">) {
  const { code } = await params;
  const def = getReport(code);
  if (!def) notFound();
  const user = await requirePermission("report.view");
  if (!canViewReport(user, def)) redirect("/forbidden");
  const sp = await searchParams;
  const page = pageOf(sp);
  const supabase = await createClient();

  const from = one(sp, "from");
  const to = one(sp, "to");
  const { rows, count, error } = await runReport(supabase, def, sp, [(page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1]);
  const totals = await reportTotals(supabase, def, sp);
  const { data: branches } = can(user, "branch.all") ? await supabase.from("branches").select("id,name").order("name") : { data: [] };
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();
  const today = todayWib();

  return (
    <>
      <PageHeader
        title={`${def.code} · ${def.title}`}
        subtitle={def.description}
        actions={
          <>
            <PrintButton label="Cetak / PDF" />
            {can(user, "report.export") && <ButtonLink href={`/reports/${def.slug}/export?${qs}`}>Ekspor CSV</ButtonLink>}
          </>
        }
      />

      <form method="get" className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3 text-sm print:hidden">
        {def.dateCol && (
          <>
            <label>
              <span className="mb-1 block text-xs text-muted">Dari</span>
              <input type="date" name="from" defaultValue={from} className="tap rounded-lg border border-border bg-surface px-2" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">Sampai</span>
              <input type="date" name="to" defaultValue={to} className="tap rounded-lg border border-border bg-surface px-2" />
            </label>
          </>
        )}
        {def.searchCols.length > 0 && (
          <label>
            <span className="mb-1 block text-xs text-muted">Cari</span>
            <input name="q" defaultValue={one(sp, "q")} className="tap rounded-lg border border-border bg-surface px-3" />
          </label>
        )}
        {(branches ?? []).length > 0 && (
          <label>
            <span className="mb-1 block text-xs text-muted">Cabang</span>
            <select name="branch" defaultValue={one(sp, "branch")} className="tap rounded-lg border border-border bg-surface px-2">
              <option value="">Semua cabang</option>
              {(branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {(def.filters ?? []).map((f) => (
          <label key={f.name}>
            <span className="mb-1 block text-xs text-muted">{f.label}</span>
            {f.options ? (
              <select name={f.name} defaultValue={one(sp, f.name)} className="tap rounded-lg border border-border bg-surface px-2">
                <option value="">Semua</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input name={f.name} defaultValue={one(sp, f.name)} className="tap rounded-lg border border-border bg-surface px-3" />
            )}
          </label>
        ))}
        <button className="tap rounded-lg bg-brand px-4 font-medium text-on-brand">Tampilkan</button>
        {def.dateCol && (
          <span className="flex gap-1 text-xs">
            <a className="tap flex items-center rounded-lg border border-border px-2" href={`?from=${addDays(today, -7)}&to=${today}`}>7 hari</a>
            <a className="tap flex items-center rounded-lg border border-border px-2" href={`?from=${addDays(today, -30)}&to=${today}`}>30 hari</a>
            <a className="tap flex items-center rounded-lg border border-border px-2" href={`?from=${today.slice(0, 8)}01&to=${today}`}>Bulan ini</a>
          </span>
        )}
      </form>

      {error && <Notice tone="bad">{error.message}</Notice>}
      {count > EXPORT_LIMIT && <Notice>Hasil melebihi {EXPORT_LIMIT.toLocaleString("id-ID")} baris; ekspor dibatasi. Persempit periode atau filter.</Notice>}

      {!rows.length ? (
        <EmptyState>Tidak ada data untuk filter ini.</EmptyState>
      ) : (
        <>
          <DataTable head={def.columns.map((c) => c.label)}>
            {rows.map((r, i) => (
              <tr key={i}>
                {def.columns.map((c) => (
                  <td key={c.key} className={`${TD} ${c.kind === "num" ? "tabular-nums" : ""}`}>
                    {cellText(c, r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </DataTable>
          <Card>
            <p className="text-sm">
              <b>{count.toLocaleString("id-ID")}</b> baris
              {def.columns.filter((c) => c.sum).map((c) => (
                <span key={c.key} className="ml-4">
                  Total {c.label}: <b className="tabular-nums">{fmtQty(totals[c.key])}</b>
                </span>
              ))}
            </p>
            <p className="mt-1 text-xs text-muted">Total dihitung dari seluruh record yang cocok dengan filter, bukan hanya halaman ini.</p>
          </Card>
        </>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count} hrefFor={hrefBuilder(`/reports/${def.slug}`, sp)} />
    </>
  );
}
