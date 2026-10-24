import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { INCIDENT_STATUS, INCIDENT_TYPE } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "incident.report") || !can(user, "master.read")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const status = sp.get("status") || "active";
  let q = (await createClient())
    .from("incidents")
    .select("incident_no,type,status,address,lat,lng,reported_at,acknowledged_at,resolved_at,resolution_note,vehicles(plate_no)")
    .order("reported_at", { ascending: false })
    .limit(50_000);
  if (status === "active") q = q.neq("status", "CLOSED");
  else if (status !== "all") q = q.eq("status", status);
  if (sp.get("type")) q = q.eq("type", sp.get("type")!);
  if (sp.get("branch")) q = q.eq("branch_id", sp.get("branch")!);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { incident_no: string; type: string; status: string; address: string | null; lat: number | null; lng: number | null; reported_at: string; acknowledged_at: string | null; resolved_at: string | null; resolution_note: string | null; vehicles: { plate_no: string } | null }[];
  const csv = toCsv(
    ["No. Insiden", "Kendaraan", "Jenis", "Status", "Lokasi", "Waktu lapor", "Waktu ACK", "Waktu selesai", "Penanganan"],
    rows.map((r) => [r.incident_no, r.vehicles?.plate_no, INCIDENT_TYPE[r.type]?.label, INCIDENT_STATUS[r.status]?.label, r.address ?? (r.lat !== null ? `${r.lat}, ${r.lng}` : ""), fmtDateTime(r.reported_at), r.acknowledged_at ? fmtDateTime(r.acknowledged_at) : "", r.resolved_at ? fmtDateTime(r.resolved_at) : "", r.resolution_note]),
  );
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="insiden.csv"' } });
}
