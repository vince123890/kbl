import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { nameMap } from "@/lib/lookups";
import { listAttachments } from "@/lib/attachments";
import { fmtDate, fmtDateTime, fmtQty } from "@/lib/format";
import { APPROVAL_ACTION, COUNT_STATUS, COUNT_TYPE } from "@/lib/labels";
import { Card, DataTable, KeyValue, Notice, PageHeader, StatusBadge, TD } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { AttachmentsPanel } from "@/components/attachments";
import { CountSheet, type CountLineView } from "@/components/count-sheet";
import { CountCsvUpload } from "@/components/count-csv-upload";
import { PrintButton } from "@/components/print-button";
import { cancelCountAction, submitCountAction } from "../../actions";

export const metadata = { title: "Detail Opname" };

interface Row {
  sparepart_id: string;
  system_qty: string;
  counted_qty: string | null;
  not_counted: boolean;
  diff_qty: string | null;
  reason_code_id: string | null;
  reason_note: string | null;
  spareparts: { code: string; name: string; uom: string };
}

export default async function CountDetailPage({ params }: PageProps<"/inventory/counts/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("stock_counts")
    .select("*,locations(name),branches(name)")
    .eq("id", id)
    .maybeSingle<Record<string, string | null> & { locations: { name: string }; branches: { name: string }; id: string; status: string; location_id: string }>();
  if (!c) notFound();

  const [{ data: lineData }, { data: reasonData }, attachments, { data: reqs }, people] = await Promise.all([
    supabase.from("stock_count_lines").select("sparepart_id,system_qty,counted_qty,not_counted,diff_qty,reason_code_id,reason_note,spareparts(code,name,uom)").eq("count_id", id),
    supabase.from("reason_codes").select("id,name,require_note,used_for").eq("is_active", true).in("used_for", ["OPNAME_DIFF", "ALL"]).order("name"),
    listAttachments("STOCK_COUNT", id),
    supabase.from("approval_requests").select("id,status").eq("doc_type", "COUNT").eq("doc_id", id).order("requested_at", { ascending: false }),
    nameMap(supabase, "profiles", [c.created_by]),
  ]);
  const lines = ((lineData ?? []) as unknown as Row[]).sort((a, b) => a.spareparts.name.localeCompare(b.spareparts.name));
  const reqIds = (reqs ?? []).map((r) => r.id);
  const { data: log } = reqIds.length ? await supabase.from("approval_actions").select("*").in("request_id", reqIds).order("id") : { data: [] };

  const sheetLines: CountLineView[] = lines.map((l) => ({
    sparepart_id: l.sparepart_id,
    code: l.spareparts.code,
    name: l.spareparts.name,
    uom: l.spareparts.uom,
    system_qty: l.system_qty,
    counted_qty: l.counted_qty,
    not_counted: l.not_counted,
    reason_code_id: l.reason_code_id,
    reason_note: l.reason_note,
  }));

  const editable = (c.status === "OPEN" || c.status === "COUNTING") && can(user, "count.enter");
  const canManage = can(user, "count.create");
  const diffs = lines.filter((l) => l.diff_qty !== null && Number(l.diff_qty) !== 0);
  const more = diffs.filter((l) => Number(l.diff_qty) > 0).length;
  const less = diffs.filter((l) => Number(l.diff_qty) < 0).length;
  const activeReq = (reqs ?? []).find((r) => r.status === "PENDING");

  return (
    <>
      <PageHeader
        title={c.count_no ?? "Opname"}
        subtitle={`${c.locations.name} · ${COUNT_TYPE[c.type ?? ""]?.label}`}
        actions={
          <>
            <PrintButton label="Cetak lembar" />
            {(c.status === "COUNTING") && canManage && <ActionButton tone="primary" label="Ajukan review" confirm="Ajukan hasil hitung untuk approval? Sesi akan terkunci." action={submitCountAction.bind(null, id)} />}
            {["OPEN", "COUNTING", "REVIEW"].includes(c.status) && canManage && (
              <ActionButton tone="danger" label="Batalkan sesi" noteLabel="Alasan pembatalan" action={cancelCountAction.bind(null, id)} />
            )}
          </>
        }
      />
      {c.status === "COUNTING" && c.decision_note && <Notice>Dikembalikan untuk hitung ulang: {c.decision_note}</Notice>}
      {c.status === "REVIEW" && activeReq && (
        <Notice>
          Menunggu approval.{" "}
          <Link href={`/approvals/${activeReq.id}`} className="underline">
            Lihat approval
          </Link>
        </Notice>
      )}
      {c.status === "CANCELLED" && <Notice tone="bad">Dibatalkan: {c.cancel_reason}</Notice>}

      <div className="space-y-4">
        <Card>
          <KeyValue
            items={[
              ["Status", <StatusBadge key="s" map={COUNT_STATUS} value={c.status} />],
              ["Cabang", c.branches.name],
              ["Dibuka", `${fmtDateTime(c.opened_at)} oleh ${people.get(c.created_by ?? "") ?? "-"}`],
              ["Kategori", c.category ?? "Semua"],
              ["Ringkasan", `${lines.length} item · ${more} lebih · ${less} kurang · ${lines.length - diffs.length} sesuai`],
              ["Penyesuaian", c.adjustment_doc_id ? <Link key="a" href={`/inventory/movements/${c.adjustment_doc_id}`} className="underline decoration-brand decoration-2">Lihat mutasi penyesuaian</Link> : null],
              ["Selesai", c.closed_at ? fmtDate(c.closed_at) : null],
              ["Catatan", c.notes],
            ]}
          />
        </Card>

        {editable && (
          <Card title="Unggah hasil hitung (CSV)">
            <CountCsvUpload countId={id} />
            <p className="mt-2 text-xs text-muted">Kolom: kode; nama; sistem; fisik; alasan; keterangan. Isi kolom fisik (dan alasan bila selisih), lalu unggah. Hasil tampil di lembar hitung di bawah sebelum diajukan.</p>
          </Card>
        )}

        <Card title="Lembar hitung">
          <CountSheet
            countId={id}
            lines={sheetLines}
            reasons={(reasonData ?? []).map((r) => ({ id: r.id, name: r.name, require_note: r.require_note }))}
            editable={editable}
            userId={user.id}
          />
        </Card>

        <Card title="Foto / lampiran">
          <AttachmentsPanel entity="STOCK_COUNT" entityId={id} items={attachments} canAdd={editable} canDelete={editable} capture="environment" />
        </Card>

        {(log ?? []).length > 0 && (
          <Card title="Log approval">
            <DataTable head={["Waktu", "Aksi", "Oleh", "Catatan"]}>
              {(log ?? []).map((a) => (
                <tr key={a.id}>
                  <td className={TD}>{fmtDateTime(a.acted_at)}</td>
                  <td className={TD}>
                    <StatusBadge map={APPROVAL_ACTION} value={a.action} />
                  </td>
                  <td className={TD}>{a.actor_name ?? "Sistem"}</td>
                  <td className={TD}>{a.note ?? "-"}</td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}
        {c.status !== "OPEN" && c.status !== "COUNTING" && diffs.length > 0 && (
          <p className="text-xs text-muted">Total selisih absolut: {fmtQty(diffs.reduce((a, l) => a + Math.abs(Number(l.diff_qty)), 0))}</p>
        )}
      </div>
    </>
  );
}
