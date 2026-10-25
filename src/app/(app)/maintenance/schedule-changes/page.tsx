import Link from "next/link";
import { requireUser, can } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hrefBuilder, nameMap, one, pageOf } from "@/lib/lookups";
import { fmtDateTime, fmtQty } from "@/lib/format";
import { CHANGE_TYPE, SCHEDULE_STATUS } from "@/lib/labels";
import { Badge, Card, DataTable, EmptyState, PageHeader, Pagination, StatusBadge, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";

export const metadata = { title: "Perubahan Jadwal" };
const PAGE_SIZE = 50;

interface Row {
  id: string;
  change_no: string;
  change_type: string;
  old_start: string;
  new_start: string;
  delta_minutes: number;
  status: string;
  was_overdue: boolean;
  reason_note: string | null;
  requested_by: string;
  requested_at: string;
  reason_code_id: string;
  work_orders: { wo_no: string; vehicles: { plate_no: string } | null } | null;
  reason_codes: { name: string } | null;
}

export default async function ScheduleChangesPage({ searchParams }: PageProps<"/maintenance/schedule-changes">) {
  const user = await requireUser();
  if (!(can(user, "schedule.request") || can(user, "approval.act") || can(user, "wo.execute"))) redirect("/forbidden");
  const sp = await searchParams;
  const page = pageOf(sp);
  const supabase = await createClient();

  let query = supabase
    .from("schedule_changes")
    .select("id,change_no,change_type,old_start,new_start,delta_minutes,status,was_overdue,reason_note,requested_by,requested_at,reason_code_id,work_orders(wo_no,vehicles(plate_no)),reason_codes(name)", { count: "exact" });
  if (one(sp, "type")) query = query.eq("change_type", one(sp, "type"));
  if (one(sp, "status")) query = query.eq("status", one(sp, "status"));
  if (one(sp, "reason")) query = query.eq("reason_code_id", one(sp, "reason"));
  if (one(sp, "branch")) query = query.eq("branch_id", one(sp, "branch"));
  if (one(sp, "requester")) query = query.eq("requested_by", one(sp, "requester"));
  if (one(sp, "from")) query = query.gte("requested_at", `${one(sp, "from")}T00:00:00+07:00`);
  if (one(sp, "to")) query = query.lte("requested_at", `${one(sp, "to")}T23:59:59+07:00`);
  if (one(sp, "q")) query = query.ilike("change_no", `%${one(sp, "q").trim()}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("requested_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Row[];

  // ringkasan atas seluruh data yang terlihat (bukan hanya halaman ini)
  const { data: sumRows } = await supabase.from("schedule_changes").select("change_type,delta_minutes,reason_codes(name),status").neq("status", "WITHDRAWN").limit(5000);
  const sum = (sumRows ?? []) as unknown as { change_type: string; delta_minutes: number; reason_codes: { name: string } | null }[];
  const adv = sum.filter((s) => s.change_type === "ADVANCE").length;
  const post = sum.filter((s) => s.change_type === "POSTPONE");
  const avgLate = post.length ? post.reduce((a, s) => a + s.delta_minutes, 0) / post.length / 1440 : 0;
  const counts = new Map<string, number>();
  for (const s of sum) counts.set(s.reason_codes?.name ?? "-", (counts.get(s.reason_codes?.name ?? "-") ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const [people, { data: reasons }, { data: branches }] = await Promise.all([
    nameMap(supabase, "profiles", rows.map((r) => r.requested_by)),
    supabase.from("reason_codes").select("id,name").in("used_for", ["SCHEDULE_CHANGE", "ALL"]).order("name"),
    supabase.from("branches").select("id,name").order("name"),
  ]);

  return (
    <>
      <PageHeader title="Perubahan Jadwal (Anomali)" subtitle="Daftar sekaligus laporan anomali. Jadwal WO hanya berubah lewat pengajuan ini." />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Card title="Percepatan">
          <p className="text-3xl font-semibold">{adv}</p>
        </Card>
        <Card title="Penundaan">
          <p className="text-3xl font-semibold">{post.length}</p>
        </Card>
        <Card title="Rata-rata keterlambatan">
          <p className="text-3xl font-semibold">{fmtQty(Math.round(avgLate * 10) / 10)} <span className="text-base font-normal text-muted">hari</span></p>
        </Card>
        <Card title="3 alasan teratas">
          {top.length ? (
            <ol className="text-sm">
              {top.map(([n, c]) => (
                <li key={n}>
                  {n} <b>({c})</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Belum ada data.</p>
          )}
        </Card>
      </div>
      <div className="filter-bar">
        <SearchBox placeholder="Cari no. perubahan…" />
        <FilterSelect name="type" label="Tipe" options={Object.entries(CHANGE_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="status" label="Status" options={Object.entries(SCHEDULE_STATUS).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="reason" label="Alasan" options={(reasons ?? []).map((r) => ({ value: r.id, label: r.name }))} />
        <FilterSelect name="branch" label="Cabang" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
      </div>
      {!rows.length ? (
        <EmptyState>Belum ada pengajuan perubahan jadwal. Ajukan dari halaman detail Work Order atau dari kalender.</EmptyState>
      ) : (
        <DataTable head={["No.", "WO · Kendaraan", "Tipe", "Jadwal lama → baru", "Selisih", "Alasan", "Pengaju", "Status"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={TD}>
                <Link href={`/maintenance/schedule-changes/${r.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {r.change_no}
                </Link>
              </td>
              <td className={TD}>
                {r.work_orders?.wo_no}
                <span className="block text-xs text-muted">{r.work_orders?.vehicles?.plate_no}</span>
              </td>
              <td className={TD}>
                <StatusBadge map={CHANGE_TYPE} value={r.change_type} />
              </td>
              <td className={TD}>
                {fmtDateTime(r.old_start)}
                <span className="block">→ {fmtDateTime(r.new_start)}</span>
              </td>
              <td className={TD}>
                {r.delta_minutes > 0 ? "+" : "−"}
                {fmtQty(Math.round((Math.abs(r.delta_minutes) / 1440) * 10) / 10)} hari {r.was_overdue && <Badge tone="bad">Overdue</Badge>}
              </td>
              <td className={TD}>
                {r.reason_codes?.name}
                {r.reason_note && <span className="block max-w-48 truncate text-xs text-muted">{r.reason_note}</span>}
              </td>
              <td className={TD}>
                {people.get(r.requested_by) ?? "-"}
                <span className="block text-xs text-muted">{fmtDateTime(r.requested_at)}</span>
              </td>
              <td className={TD}>
                <StatusBadge map={SCHEDULE_STATUS} value={r.status} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefBuilder("/maintenance/schedule-changes", sp)} />
    </>
  );
}
