import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, applyAuditFilters, changedKeys } from "@/lib/audit-query";
import { Badge, EmptyState, PageHeader, Pagination } from "@/components/ui";

export const metadata = { title: "Audit Log" };
const PAGE_SIZE = 50;

type Json = Record<string, unknown> | null;

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const me = await requirePermission("audit.view");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filters = { entity: one("entity"), action: one("action"), user: one("user"), from: one("from"), to: one("to") };
  const page = Math.max(1, Number(one("page")) || 1);

  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const base = supabase.from("audit_logs").select("id,at,user_id,entity,entity_id,action,before,after,ip,meta", { count: "exact" });
  const { data, count } = await applyAuditFilters(base, filters)
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const { data: people } = await supabase.from("profiles").select("id,name").order("name").limit(500);
  const who = new Map((people ?? []).map((p) => [p.id, p.name]));

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const hrefFor = (p: number) => {
    const next = new URLSearchParams(qs);
    next.set("page", String(p));
    return `/admin/audit-logs?${next.toString()}`;
  };

  const sel = "tap rounded-lg border border-border bg-surface px-2 text-sm";
  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Append-only: tidak dapat diubah atau dihapus. Waktu ditampilkan WIB."
        actions={
          can(me, "report.export") ? (
            <a
              href={`/admin/audit-logs/export?${qs.toString()}`}
              className="tap inline-flex items-center rounded-lg border border-border px-4 text-sm hover:bg-background"
            >
              Ekspor CSV
            </a>
          ) : undefined
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <select name="entity" defaultValue={filters.entity} className={sel} aria-label="Entitas">
          <option value="">Semua entitas</option>
          {AUDIT_ENTITIES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select name="action" defaultValue={filters.action} className={sel} aria-label="Aksi">
          <option value="">Semua aksi</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select name="user" defaultValue={filters.user} className={sel} aria-label="User">
          <option value="">Semua user</option>
          {(people ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <label className="text-xs text-muted">
          Dari
          <input type="date" name="from" defaultValue={filters.from} className={`${sel} ml-1`} />
        </label>
        <label className="text-xs text-muted">
          Sampai
          <input type="date" name="to" defaultValue={filters.to} className={`${sel} ml-1`} />
        </label>
        <button className="tap rounded-lg bg-brand px-4 text-sm font-medium text-white">Terapkan</button>
      </form>

      {!data?.length ? (
        <EmptyState>Tidak ada catatan audit yang cocok.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Waktu</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Entitas</th>
                <th className="px-3 py-2 font-medium">Aksi</th>
                <th className="px-3 py-2 font-medium">Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const before = r.before as Json;
                const after = r.after as Json;
                const keys = r.action === "UPDATE" || r.action === "DEACTIVATE" || r.action === "ACTIVATE" ? changedKeys(before, after) : [];
                return (
                  <tr key={r.id} className="border-b border-border align-top last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {new Date(r.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "medium" })}
                    </td>
                    <td className="px-3 py-2">{r.user_id ? (who.get(r.user_id) ?? r.user_id.slice(0, 8)) : <span className="text-muted">Sistem</span>}</td>
                    <td className="px-3 py-2">
                      {r.entity}
                      {r.entity_id && <span className="block max-w-40 truncate text-xs text-muted">{r.entity_id}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={/FAILED|LOCKED|DENIED|DEACTIVATE|DELETE/.test(r.action) ? "bad" : "neutral"}>{r.action}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <details>
                        <summary className="cursor-pointer text-brand">{summary(r.action, keys, r.meta as Json)}</summary>
                        <DiffView action={r.action} before={before} after={after} keys={keys} meta={r.meta as Json} ip={r.ip} />
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefFor} />
      <p className="mt-2 text-xs text-muted">Sedang melihat sebagai {me.name}.</p>
    </>
  );
}

function summary(action: string, keys: string[], meta: Json) {
  if (keys.length) return `${keys.length} field berubah`;
  if (action === "CREATE") return "Data baru";
  if (meta && Object.keys(meta).length) return "Detail";
  return "Lihat";
}

function DiffView({ action, before, after, keys, meta, ip }: { action: string; before: Json; after: Json; keys: string[]; meta: Json; ip: string | null }) {
  const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  const rows = keys.length ? keys : Object.keys((action === "CREATE" ? after : before) ?? {});
  return (
    <div className="mt-2 max-w-xl rounded-lg border border-border p-2 text-xs">
      {rows.length > 0 && (
        <table className="w-full">
          <thead className="text-left text-muted">
            <tr><th className="pr-2">Field</th><th className="pr-2">Sebelum</th><th>Sesudah</th></tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k}>
                <td className="pr-2 font-mono">{k}</td>
                <td className="pr-2 break-all text-danger">{action === "CREATE" ? "—" : show(before?.[k])}</td>
                <td className="break-all text-brand-strong">{action === "DELETE" ? "—" : show(after?.[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {meta && <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(meta)}</pre>}
      {ip && <p className="mt-1 text-muted">IP {ip}</p>}
    </div>
  );
}
