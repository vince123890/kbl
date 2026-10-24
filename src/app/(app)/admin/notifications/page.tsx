import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cleanQuery, hrefBuilder, nameMap, one, pageOf } from "@/lib/lookups";
import { fmtDateTime } from "@/lib/format";
import { NOTIF_STATUS } from "@/lib/labels";
import { DataTable, EmptyState, Notice, PageHeader, Pagination, StatusBadge, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";
import { ActionButton } from "@/components/action-button";
import { resendNotificationsAction } from "@/app/(app)/notifications/actions";

export const metadata = { title: "Log Notifikasi" };
const PAGE_SIZE = 50;
const CHANNELS = ["INAPP", "PUSH", "WHATSAPP", "SMS", "EMAIL"];

export default async function NotificationLogPage({ searchParams }: PageProps<"/admin/notifications">) {
  await requirePermission("admin.notif");
  const sp = await searchParams;
  const page = pageOf(sp);
  const q = cleanQuery(one(sp, "q"));
  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select("id,user_id,channel,kind,title,body,status,attempts,last_error,created_at,sent_at", { count: "exact" });
  if (one(sp, "channel")) query = query.eq("channel", one(sp, "channel"));
  if (one(sp, "status")) query = query.eq("status", one(sp, "status"));
  if (one(sp, "kind")) query = query.eq("kind", one(sp, "kind"));
  if (q) query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = data ?? [];
  const people = await nameMap(supabase, "profiles", rows.map((r) => r.user_id));
  const { count: failed } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("status", "FAILED");

  return (
    <>
      <PageHeader
        title="Log Notifikasi"
        subtitle={`${count ?? 0} notifikasi`}
        actions={failed ? <ActionButton label={`Kirim ulang yang gagal (${failed})`} action={() => resendNotificationsAction(null)} /> : undefined}
      />
      {!!failed && (
        <Notice tone="bad">
          {failed} notifikasi gagal terkirim. Penyebab paling umum: kanal WhatsApp/SMS belum dikonfigurasi (NOTIFY_WEBHOOK_URL) atau pengguna belum
          mengaktifkan push. Kegagalan ini tidak menghalangi pencatatan insiden maupun approval.
        </Notice>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Cari judul atau isi…" />
        <FilterSelect name="channel" label="Kanal" options={CHANNELS.map((c) => ({ value: c, label: c }))} />
        <FilterSelect name="status" label="Status" options={Object.entries(NOTIF_STATUS).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect
          name="kind"
          label="Jenis"
          options={["incident", "approval", "stock", "schedule", "system"].map((k) => ({ value: k, label: k }))}
        />
      </div>
      {!rows.length ? (
        <EmptyState>Belum ada notifikasi yang cocok.</EmptyState>
      ) : (
        <DataTable head={["Waktu", "Penerima", "Kanal", "Jenis", "Isi", "Status", "Percobaan"]}>
          {rows.map((n) => (
            <tr key={n.id}>
              <td className={TD}>{fmtDateTime(n.created_at)}</td>
              <td className={TD}>{people.get(n.user_id) ?? "-"}</td>
              <td className={TD}>{n.channel}</td>
              <td className={TD}>{n.kind}</td>
              <td className={TD}>
                <b>{n.title}</b>
                <span className="block text-muted">{n.body}</span>
                {n.last_error && <span className="block text-xs text-danger">{n.last_error}</span>}
              </td>
              <td className={TD}>
                <StatusBadge map={NOTIF_STATUS} value={n.status} />
              </td>
              <td className={TD}>{n.attempts}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefBuilder("/admin/notifications", sp)} />
    </>
  );
}
