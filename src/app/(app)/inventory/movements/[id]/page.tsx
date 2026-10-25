import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { nameMap, one } from "@/lib/lookups";
import { listAttachments } from "@/lib/attachments";
import { fmtDate, fmtDateTime, fmtQty } from "@/lib/format";
import { APPROVAL_ACTION, APPROVAL_STATUS, STOCK_STATUS, STOCK_TYPE } from "@/lib/labels";
import { ButtonLink, Card, DataTable, KeyValue, Notice, PageHeader, StatusBadge, TD } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { AttachmentsPanel } from "@/components/attachments";
import { PrintButton } from "@/components/print-button";
import { ReverseButton } from "@/components/reverse-button";
import { cancelMovementAction, submitMovementAction } from "../../actions";

export const metadata = { title: "Detail Mutasi" };

interface Line {
  line_no: number;
  qty: string;
  notes: string | null;
  spareparts: { code: string; name: string; uom: string } | null;
  from_loc: { name: string } | null;
  to_loc: { name: string } | null;
}

export default async function MovementDetailPage({ params, searchParams }: PageProps<"/inventory/movements/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: d } = await supabase
    .from("stock_documents")
    .select(
      "*,vehicles(plate_no),work_orders(id,wo_no),branches(name)," +
        "from_loc:locations!stock_documents_from_location_id_fkey(name),to_loc:locations!stock_documents_to_location_id_fkey(name)," +
        "stock_document_lines(line_no,qty,notes,spareparts(code,name,uom),from_loc:locations!stock_document_lines_from_location_id_fkey(name),to_loc:locations!stock_document_lines_to_location_id_fkey(name))",
    )
    .eq("id", id)
    .maybeSingle<Record<string, unknown> & { id: string; doc_no: string; type: string; status: string; branch_id: string; created_by: string | null; row_version: number; reverses_doc_id: string | null; count_id: string | null; stock_document_lines: Line[]; vehicles: { plate_no: string } | null; work_orders: { id: string; wo_no: string } | null; branches: { name: string } | null; from_loc: { name: string } | null; to_loc: { name: string } | null; doc_date: string; notes: string | null; decision_note: string | null; cancel_reason: string | null; submitted_at: string | null; posted_at: string | null; posted_by: string | null; created_at: string }>();
  if (!d) notFound();

  const [attachments, movements, requests, reversal, reverses, people] = await Promise.all([
    listAttachments("STOCK_DOC", id),
    supabase.from("stock_movements").select("id,qty_delta,balance_after,sparepart_id,location_id,spareparts(code,name),locations(name)").eq("document_id", id).order("id"),
    supabase.from("approval_requests").select("id,status,summary,steps,current_step").eq("doc_id", id).eq("doc_type", "STOCK").order("requested_at", { ascending: false }),
    supabase.from("stock_documents").select("id,doc_no,status").eq("reverses_doc_id", id).not("status", "in", "(CANCELLED,REJECTED)").maybeSingle(),
    d.reverses_doc_id ? supabase.from("stock_documents").select("id,doc_no").eq("id", d.reverses_doc_id).maybeSingle() : Promise.resolve({ data: null }),
    nameMap(supabase, "profiles", [d.created_by, d.posted_by]),
  ]);
  const reqIds = (requests.data ?? []).map((r) => r.id);
  const { data: log } = reqIds.length ? await supabase.from("approval_actions").select("*").in("request_id", reqIds).order("id") : { data: [] };

  const lines = [...d.stock_document_lines].sort((a, b) => a.line_no - b.line_no);
  const isDraft = d.status === "DRAFT";
  const canOperate = can(user, "stock.create");
  const canCancel = can(user, "stock.cancel");
  const activeReq = (requests.data ?? []).find((r) => r.status === "PENDING");

  return (
    <>
      <PageHeader
        title={d.doc_no}
        subtitle={`${STOCK_TYPE[d.type]?.label} · ${d.branches?.name ?? ""}`}
        actions={
          <>
            <PrintButton label="Cetak form" />
            {isDraft && canOperate && d.type !== "ADJUSTMENT" && <ButtonLink href={`/inventory/movements/${id}/edit`}>Ubah</ButtonLink>}
            {isDraft && canOperate && <ActionButton tone="primary" label="Ajukan untuk approval" action={submitMovementAction.bind(null, id)} />}
            {(isDraft || d.status === "SUBMITTED") && canCancel && (
              <ActionButton tone="danger" label="Batalkan" noteLabel="Alasan pembatalan" action={cancelMovementAction.bind(null, id)} />
            )}
            {d.status === "POSTED" && canCancel && !d.reverses_doc_id && !reversal.data && <ReverseButton id={id} />}
          </>
        }
      />
      {one(sp, "error") && <Notice tone="bad">{one(sp, "error")}</Notice>}
      {d.status === "SUBMITTED" && activeReq && (
        <Notice>
          Dokumen terkunci dan menunggu approval.{" "}
          <Link href={`/approvals/${activeReq.id}`} className="underline">
            Lihat approval
          </Link>
        </Notice>
      )}
      {d.status === "DRAFT" && d.decision_note && <Notice>Dikembalikan untuk revisi: {d.decision_note}</Notice>}
      {d.status === "REJECTED" && <Notice tone="bad">Ditolak: {d.decision_note}</Notice>}
      {d.status === "CANCELLED" && <Notice tone="bad">Dibatalkan: {d.cancel_reason}</Notice>}

      <div className="space-y-4">
        <Card>
          <KeyValue
            items={[
              ["Status", <StatusBadge key="s" map={STOCK_STATUS} value={d.status} />],
              ["Tanggal", fmtDate(d.doc_date)],
              ["Kendaraan", d.vehicles?.plate_no],
              ["Work Order", d.work_orders ? <Link key="w" href={`/maintenance/work-orders/${d.work_orders.id}`} className="underline decoration-brand decoration-2">{d.work_orders.wo_no}</Link> : null],
              ["Dari lokasi", d.from_loc?.name],
              ["Ke lokasi", d.to_loc?.name],
              ["Dibuat oleh", people.get(d.created_by ?? "")],
              ["Diposting", d.posted_at ? `${fmtDateTime(d.posted_at)} oleh ${people.get(d.posted_by ?? "") ?? "-"}` : null],
              ["Pembalik dari", reverses.data ? <Link key="r" href={`/inventory/movements/${reverses.data.id}`} className="underline decoration-brand decoration-2">{reverses.data.doc_no}</Link> : null],
              ["Dibalik oleh", reversal.data ? <Link key="rv" href={`/inventory/movements/${reversal.data.id}`} className="underline decoration-brand decoration-2">{reversal.data.doc_no} ({STOCK_STATUS[reversal.data.status]?.label})</Link> : null],
              ["Opname asal", d.count_id ? <Link key="c" href={`/inventory/counts/${d.count_id}`} className="underline decoration-brand decoration-2">Lihat opname</Link> : null],
              ["Catatan", d.notes],
            ]}
          />
        </Card>

        <Card title="Item">
          <DataTable head={["#", "Sparepart", "Qty", "Satuan", "Lokasi", "Catatan"]}>
            {lines.map((l) => (
              <tr key={l.line_no}>
                <td className={TD}>{l.line_no}</td>
                <td className={TD}>
                  {l.spareparts?.name}
                  <span className="block text-xs text-muted">{l.spareparts?.code}</span>
                </td>
                <td className={`${TD} tabular-nums`}>{fmtQty(l.qty)}</td>
                <td className={TD}>{l.spareparts?.uom}</td>
                <td className={TD}>
                  {l.from_loc?.name ?? ""}
                  {l.from_loc && l.to_loc ? " → " : ""}
                  {l.to_loc?.name ?? ""}
                </td>
                <td className={TD}>{l.notes ?? <span className="text-muted">-</span>}</td>
              </tr>
            ))}
          </DataTable>
        </Card>

        {(movements.data ?? []).length > 0 && (
          <Card title="Kartu stok terkait">
            <DataTable head={["Sparepart", "Lokasi", "Masuk (+)", "Keluar (−)", "Saldo sesudah"]}>
              {(movements.data as unknown as { id: number; qty_delta: string; balance_after: string; spareparts: { code: string; name: string }; locations: { name: string } }[]).map((m) => (
                <tr key={m.id}>
                  <td className={TD}>{m.spareparts?.name ?? "-"}</td>
                  <td className={TD}>{m.locations?.name ?? "-"}</td>
                  <td className={`${TD} tabular-nums`}>{Number(m.qty_delta) > 0 ? fmtQty(m.qty_delta) : ""}</td>
                  <td className={`${TD} tabular-nums`}>{Number(m.qty_delta) < 0 ? fmtQty(Math.abs(Number(m.qty_delta))) : ""}</td>
                  <td className={`${TD} tabular-nums`}>{fmtQty(m.balance_after)}</td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}

        <Card title="Lampiran">
          <AttachmentsPanel entity="STOCK_DOC" entityId={id} items={attachments} canAdd={isDraft && canOperate} canDelete={isDraft && canOperate} />
        </Card>

        <Card title="Log approval">
          {!(log ?? []).length ? (
            <p className="text-sm text-muted">Belum pernah diajukan.</p>
          ) : (
            <DataTable head={["Waktu", "Aksi", "Oleh", "Catatan"]}>
              {(log ?? []).map((a) => (
                <tr key={a.id}>
                  <td className={TD}>{fmtDateTime(a.acted_at)}</td>
                  <td className={TD}>
                    <StatusBadge map={APPROVAL_ACTION} value={a.action} />
                  </td>
                  <td className={TD}>{a.actor_name ?? "Sistem"}</td>
                  <td className={TD}>{a.note ?? <span className="text-muted">-</span>}</td>
                </tr>
              ))}
            </DataTable>
          )}
          {activeReq && (
            <p className="mt-2 text-xs text-muted">
              Status approval: <StatusBadge map={APPROVAL_STATUS} value={activeReq.status} />
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
