import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { nameMap } from "@/lib/lookups";
import { listAttachments } from "@/lib/attachments";
import { fmtAge, fmtDateTime } from "@/lib/format";
import { INCIDENT_STATUS, INCIDENT_TYPE, WO_STATUS } from "@/lib/labels";
import { Badge, Card, KeyValue, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { AttachmentsPanel } from "@/components/attachments";
import { IncidentActions } from "@/components/incident-actions";
import { IncidentDetailForm } from "@/components/incident-detail-form";
import { LiveRefresh } from "@/components/live-refresh";

export const metadata = { title: "Detail Insiden" };

const ACTION_LABEL: Record<string, string> = {
  REPORTED: "Dilaporkan",
  ACKNOWLEDGED: "Dikonfirmasi pusat",
  ASSIGN_TOW: "Derek ditugaskan",
  ASSIGN_TECH: "Teknisi ditugaskan",
  REPLACEMENT_VEHICLE: "Kendaraan pengganti",
  NOTE: "Catatan",
  WO_CREATED: "WO emergensi dibuat",
  RESOLVED: "Diselesaikan",
  CLOSED: "Ditutup",
  FALSE_REPORT: "Ditandai laporan keliru",
  ESCALATED: "Eskalasi otomatis",
  DETAIL_ADDED: "Keterangan tambahan",
  TYPE_CORRECTED: "Jenis dikoreksi",
};

export default async function IncidentDetailPage({ params }: PageProps<"/emergency/incidents/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: i } = await supabase
    .from("incidents")
    .select("*,vehicles(plate_no,type,model),branches(name)")
    .eq("id", id)
    .maybeSingle<Record<string, unknown> & {
      id: string; incident_no: string; status: string; type: string; branch_id: string; vehicle_id: string; driver_id: string | null; reporter_id: string | null; lat: number | null; lng: number | null; address: string | null; description: string | null; casualties: number | null; source: string; reported_at: string; acknowledged_at: string | null; acknowledged_by: string | null; resolved_at: string | null; resolution_note: string | null; escalated_level: number; is_false_report: boolean; false_reason: string | null;
      vehicles: { plate_no: string; type: string; model: string | null }; branches: { name: string };
    }>();
  if (!i) notFound();

  const [{ data: logs }, attachments, { data: wos }, people, { data: driver }, { data: techs }] = await Promise.all([
    supabase.from("incident_logs").select("id,action,note,actor_name,created_at").eq("incident_id", id).order("id"),
    listAttachments("INCIDENT", id),
    supabase.from("work_orders").select("id,wo_no,status").eq("incident_id", id).neq("status", "CANCELLED"),
    nameMap(supabase, "profiles", [i.driver_id, i.reporter_id, i.acknowledged_by]),
    i.driver_id ? supabase.from("profiles").select("phone").eq("id", i.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    can(user, "wo.write") ? supabase.rpc("wo_assignees", { p_branch: i.branch_id }) : Promise.resolve({ data: [] }),
  ]);

  const canHandle = can(user, "incident.handle");
  const isMine = i.reporter_id === user.id || i.driver_id === user.id;
  const active = i.status !== "CLOSED";
  const bbox = i.lat !== null && i.lng !== null ? `${i.lng - 0.01},${i.lat - 0.006},${i.lng + 0.01},${i.lat + 0.006}` : null;

  return (
    <>
      {i.status !== "CLOSED" && <LiveRefresh seconds={canHandle ? 15 : 30} />}
      <PageHeader
        title={i.incident_no}
        subtitle={`${INCIDENT_TYPE[i.type]?.label} · ${i.vehicles.plate_no} · ${i.branches.name}`}
        actions={
          canHandle || can(user, "incident.close") ? (
            <IncidentActions
              id={id}
              status={i.status}
              type={i.type}
              canHandle={canHandle}
              canClose={can(user, "incident.close")}
              canWo={can(user, "wo.write")}
              hasWo={(wos ?? []).length > 0}
              assignees={((techs ?? []) as { id: string; name: string }[]).map((t) => ({ id: t.id, label: t.name }))}
            />
          ) : undefined
        }
      />
      {i.status === "REPORTED" && !canHandle && <Notice>Laporan Anda sudah diterima. Pusat sedang diberi tahu; ikuti langkah cepat dan hubungi kontak darurat bila perlu.</Notice>}
      {i.is_false_report && <Notice>Ditandai laporan keliru: {i.false_reason}</Notice>}

      <div className="space-y-4">
        <Card>
          <KeyValue
            items={[
              ["Status", <span key="s" className="flex flex-wrap gap-1"><StatusBadge map={INCIDENT_STATUS} value={i.status} />{i.escalated_level > 0 && i.status === "REPORTED" && <Badge tone="bad">Eskalasi {i.escalated_level}</Badge>}</span>],
              ["Jenis", <StatusBadge key="t" map={INCIDENT_TYPE} value={i.type} />],
              ["Dilaporkan", `${fmtDateTime(i.reported_at)} (${fmtAge(i.reported_at)} lalu)`],
              ["Pengemudi", people.get(i.driver_id ?? "") ? <span key="d">{people.get(i.driver_id ?? "")} {driver?.phone && canHandle && <a href={`tel:${driver.phone}`} className="ml-1 underline">Telepon {driver.phone}</a>}</span> : null],
              ["Pelapor", `${people.get(i.reporter_id ?? "") ?? "-"}${i.source === "CENTER" ? " (dicatat pusat)" : ""}`],
              ["Konfirmasi pusat", i.acknowledged_at ? `${fmtDateTime(i.acknowledged_at)} oleh ${people.get(i.acknowledged_by ?? "") ?? "-"}` : "Belum"],
              ["Lokasi", i.address ?? (i.lat !== null ? `${i.lat}, ${i.lng}` : null)],
              ["Jumlah korban", i.casualties],
              ["Selesai", i.resolved_at ? `${fmtDateTime(i.resolved_at)} · ${i.resolution_note ?? ""}` : null],
              ["Work Order", (wos ?? []).length ? <span key="w" className="flex flex-wrap gap-2">{(wos ?? []).map((w) => <Link key={w.id} href={`/maintenance/work-orders/${w.id}`} className="underline decoration-brand decoration-2">{w.wo_no} ({WO_STATUS[w.status]?.label})</Link>)}</span> : null],
              ["Keterangan", i.description ? <span key="de" className="whitespace-pre-line">{i.description}</span> : null],
            ]}
          />
        </Card>

        {bbox && i.lat !== null && (
          <Card
            title="Lokasi kejadian"
            actions={
              <a href={`https://www.google.com/maps?q=${i.lat},${i.lng}`} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                Buka di Google Maps
              </a>
            }
          >
            <iframe
              title="Peta lokasi kejadian"
              loading="lazy"
              className="h-64 w-full rounded-lg border border-border"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${i.lat},${i.lng}`}
            />
          </Card>
        )}

        {active && (isMine || canHandle) && (
          <Card title="Tambah keterangan">
            <IncidentDetailForm id={id} />
          </Card>
        )}

        <Card title="Foto">
          <AttachmentsPanel entity="INCIDENT" entityId={id} items={attachments} canAdd={active && (isMine || canHandle)} canDelete={false} accept="image/*" capture="environment" />
        </Card>

        <Card title="Log insiden">
          <ol className="space-y-3 text-sm">
            {(logs ?? []).map((l) => (
              <li key={l.id} className="border-l-2 border-brand pl-3">
                <p className="font-medium">{ACTION_LABEL[l.action] ?? l.action}</p>
                {l.note && <p className="whitespace-pre-line text-muted">{l.note}</p>}
                <p className="text-xs text-muted">
                  {fmtDateTime(l.created_at)} · {l.actor_name ?? "Sistem"}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
