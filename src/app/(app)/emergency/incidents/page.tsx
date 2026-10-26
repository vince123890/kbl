import Link from "next/link";
import { can, requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hrefBuilder, nameMap, one, pageOf } from "@/lib/lookups";
import { fmtAge, fmtDateTime } from "@/lib/format";
import { nowMs } from "@/lib/clock";
import { INCIDENT_STATUS, INCIDENT_TYPE } from "@/lib/labels";
import { Badge, ButtonLink, DataTable, EmptyState, PageHeader, Pagination, StatusBadge, TD } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";
import { LiveRefresh } from "@/components/live-refresh";
import { IncidentAlert } from "@/components/incident-alert";
import { RecordIncidentDialog } from "@/components/record-incident-dialog";

export const metadata = { title: "Insiden" };
const PAGE_SIZE = 50;

export default async function IncidentsPage({ searchParams }: PageProps<"/emergency/incidents">) {
  const user = await requireUser();
  if (!can(user, "incident.report") || !can(user, "master.read")) redirect("/emergency/report");
  const sp = await searchParams;
  const page = pageOf(sp);
  const status = one(sp, "status") || "active";
  const supabase = await createClient();

  let query = supabase
    .from("incidents")
    .select("id,incident_no,branch_id,vehicle_id,driver_id,type,status,address,lat,lng,reported_at,acknowledged_by,escalated_level,is_false_report,vehicles(plate_no)", { count: "exact" });
  if (status === "active") query = query.neq("status", "CLOSED");
  else if (status !== "all") query = query.eq("status", status);
  if (one(sp, "type")) query = query.eq("type", one(sp, "type"));
  if (one(sp, "branch")) query = query.eq("branch_id", one(sp, "branch"));
  if (one(sp, "from")) query = query.gte("reported_at", `${one(sp, "from")}T00:00:00+07:00`);
  if (one(sp, "to")) query = query.lte("reported_at", `${one(sp, "to")}T23:59:59+07:00`);
  if (one(sp, "q")) query = query.ilike("incident_no", `%${one(sp, "q").trim()}%`);
  const from = (page - 1) * PAGE_SIZE;
  // belum ACK teratas, lalu terbaru
  const { data, count } = await query.order("status", { ascending: false }).order("reported_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = ((data ?? []) as unknown as {
    id: string; incident_no: string; branch_id: string; driver_id: string | null; type: string; status: string; address: string | null; lat: number | null; lng: number | null; reported_at: string; acknowledged_by: string | null; escalated_level: number; is_false_report: boolean; vehicles: { plate_no: string } | null;
  }[]).sort((a, b) => Number(b.status === "REPORTED") - Number(a.status === "REPORTED"));

  const [people, branches, { data: ack }, { data: vehicles }, { data: driverRows }, { data: branchList }] = await Promise.all([
    nameMap(supabase, "profiles", rows.flatMap((r) => [r.driver_id, r.acknowledged_by])),
    nameMap(supabase, "branches", rows.map((r) => r.branch_id)),
    supabase.from("system_parameters").select("value").eq("key", "incident.ack_minutes").maybeSingle(),
    supabase.from("vehicles").select("id,plate_no").eq("is_active", true).order("plate_no"),
    supabase.rpc("incident_drivers"), // lewat fungsi: user_roles hanya terbaca oleh pemegang izin admin
    supabase.from("branches").select("id,name").order("name"),
  ]);
  const ackMin = Number(ack?.value ?? 5);
  const unacked = rows.filter((r) => r.status === "REPORTED");
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  return (
    <>
      <LiveRefresh seconds={15} />
      <IncidentAlert unackedIds={unacked.map((r) => r.id)} />
      <PageHeader
        title="Insiden Emergensi"
        subtitle={`${count ?? 0} insiden · penyegaran otomatis tiap 15 detik · merah bila belum dikonfirmasi lebih dari ${ackMin} menit`}
        actions={
          <>
            <ButtonLink href={`/emergency/incidents/export?${exportQs}`}>Ekspor CSV</ButtonLink>
            {can(user, "incident.handle") && (
              <RecordIncidentDialog vehicles={(vehicles ?? []).map((v) => ({ id: v.id, plate: v.plate_no }))} drivers={((driverRows ?? []) as { id: string; name: string }[]).map((d) => ({ id: d.id, name: d.name }))} />
            )}
          </>
        }
      />
      <div className="filter-bar">
        <SearchBox placeholder="Cari no. insiden…" />
        <FilterSelect
          name="status"
          label="Status"
          allLabel="Aktif"
          defaultValue="active"
          options={[...Object.entries(INCIDENT_STATUS).map(([value, d]) => ({ value, label: d.label })), { value: "all", label: "Semua status" }]}
        />
        <FilterSelect name="type" label="Jenis" options={Object.entries(INCIDENT_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="branch" label="Cabang" options={(branchList ?? []).map((b) => ({ value: b.id, label: b.name }))} />
      </div>
      {!rows.length ? (
        <EmptyState>Tidak ada insiden pada filter ini.</EmptyState>
      ) : (
        <DataTable head={["No. Insiden", "Lapor", "Kendaraan · Pengemudi", "Jenis", "Lokasi", "Status", "Ditangani oleh"]}>
          {rows.map((r) => {
            const mins = (nowMs() - new Date(r.reported_at).getTime()) / 60000;
            const late = r.status === "REPORTED" && mins > ackMin;
            return (
              <tr key={r.id} className={late ? "bg-danger-soft" : ""}>
                <td className={TD}>
                  <Link href={`/emergency/incidents/${r.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                    {r.incident_no}
                  </Link>
                  <span className="block text-xs text-muted">{branches.get(r.branch_id)}</span>
                </td>
                <td className={TD}>
                  {fmtDateTime(r.reported_at)}
                  <span className={`block text-xs ${late ? "font-semibold text-danger" : "text-muted"}`}>{fmtAge(r.reported_at)} lalu</span>
                </td>
                <td className={TD}>
                  {r.vehicles?.plate_no}
                  <span className="block text-xs text-muted">{people.get(r.driver_id ?? "") ?? "-"}</span>
                </td>
                <td className={TD}>
                  <StatusBadge map={INCIDENT_TYPE} value={r.type} />
                </td>
                <td className={TD}>
                  {r.address ?? (r.lat !== null ? `${r.lat}, ${r.lng}` : <span className="text-muted">-</span>)}
                  {r.lat !== null && (
                    <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer" className="block text-xs underline">
                      Buka peta
                    </a>
                  )}
                </td>
                <td className={TD}>
                  <StatusBadge map={INCIDENT_STATUS} value={r.status} />
                  {r.escalated_level > 0 && r.status === "REPORTED" && <Badge tone="bad">Eskalasi {r.escalated_level}</Badge>}
                  {r.is_false_report && <Badge>Laporan keliru</Badge>}
                </td>
                <td className={TD}>{people.get(r.acknowledged_by ?? "") ?? <span className="text-muted">-</span>}</td>
              </tr>
            );
          })}
        </DataTable>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefBuilder("/emergency/incidents", sp)} />
    </>
  );
}
