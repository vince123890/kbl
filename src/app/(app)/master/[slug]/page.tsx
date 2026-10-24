import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMaster } from "@/lib/masters";
import { Badge, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";
import { DetailLink, MasterFormButton, OdometerButton, ToggleActiveButton } from "@/components/master-row-actions";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  IN_MAINTENANCE: "Dalam Perawatan",
  OUT_OF_SERVICE: "Tidak Beroperasi",
  BENGKEL: "Bengkel",
  DEREK: "Derek",
  ASURANSI: "Asuransi",
  SUPPLIER: "Supplier",
  SCHEDULE_CHANGE: "Perubahan Jadwal",
  OPNAME_DIFF: "Selisih Opname",
  REJECT: "Penolakan",
  ALL: "Semua",
};

export async function generateMetadata({ params }: PageProps<"/master/[slug]">) {
  const { slug } = await params;
  return { title: getMaster(slug)?.label ?? "Master" };
}

export default async function MasterListPage({ params, searchParams }: PageProps<"/master/[slug]">) {
  const { slug } = await params;
  const def = getMaster(slug);
  if (!def) notFound();
  const user = await requirePermission("master.read");
  const canWrite = can(user, "master.write");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const q = one("q").replace(/[,()%*\\]/g, " ").trim();
  const status = one("status") || "active";
  const page = Math.max(1, Number(one("page")) || 1);

  const supabase = await createClient();
  const { data: branchRows } = await supabase.from("branches").select("id,name").order("name");
  const branches = branchRows ?? [];
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  let query = supabase.from(def.table).select("*", { count: "exact" });
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (q) query = query.or(def.searchColumns.map((c) => `${c}.ilike.%${q}%`).join(","));
  for (const f of def.filters ?? []) {
    const v = one(f.name);
    if (v) query = query.eq(f.name, v);
  }
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order(def.defaultSort).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as Parameters<typeof MasterFormButton>[0]["row"][] & { id: string }[];

  const hrefFor = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") next.set(k, v);
    next.set("page", String(p));
    return `/master/${slug}?${next.toString()}`;
  };

  const renderCell = (row: Record<string, unknown>, col: (typeof def.columns)[number]) => {
    const v = row[col.key];
    if (col.render === "branch") return branchName.get(String(v)) ?? "-";
    if (col.render === "bool") return v ? <Badge tone="good">Ya</Badge> : <span className="text-muted">-</span>;
    if (col.render === "number") return v === null || v === undefined ? "-" : Number(v).toLocaleString("id-ID");
    if (v === null || v === undefined || v === "") return <span className="text-muted">-</span>;
    return STATUS_LABEL[String(v)] ?? String(v);
  };

  return (
    <>
      <PageHeader
        title={def.label}
        subtitle={`${count ?? 0} data`}
        actions={canWrite ? <MasterFormButton def={def} branches={branches} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder={`Cari ${def.label.toLowerCase()}…`} />
        <FilterSelect
          name="status"
          label="Status"
          allLabel="Semua"
          defaultValue="active"
          options={[
            { value: "active", label: "Aktif" },
            { value: "inactive", label: "Nonaktif" },
            { value: "all", label: "Semua status" },
          ]}
        />
        {(def.filters ?? []).map((f) => (
          <FilterSelect
            key={f.name}
            name={f.name}
            label={f.label}
            options={f.options === "branch" ? branches.map((b) => ({ value: b.id, label: b.name })) : f.options}
          />
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error.message}</p>}

      {!rows.length ? (
        <EmptyState>{q || status !== "active" ? "Tidak ada data yang cocok dengan filter." : `Belum ada data ${def.label.toLowerCase()}.`}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                {def.columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(rows as unknown as (Record<string, string | number | boolean | null> & { id: string; row_version: number; is_active: boolean })[]).map(
                (row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    {def.columns.map((c) => (
                      <td key={c.key} className="px-3 py-2 align-top">
                        {renderCell(row, c)}
                      </td>
                    ))}
                    <td className="px-3 py-2 align-top">
                      {row.is_active ? <Badge tone="good">Aktif</Badge> : <Badge>Nonaktif</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {slug === "vehicles" && <DetailLink href={`/master/vehicles/${row.id}`} />}
                        {canWrite && slug === "vehicles" && <OdometerButton vehicleId={row.id} current={Number(row.odometer)} />}
                        {canWrite && <MasterFormButton def={def} row={row} branches={branches} compact />}
                        {canWrite && <ToggleActiveButton slug={slug} row={row} label={def.singular.toLowerCase()} />}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefFor} />
    </>
  );
}
