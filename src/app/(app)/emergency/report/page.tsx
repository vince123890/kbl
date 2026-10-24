import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { INCIDENT_STATUS, INCIDENT_TYPE } from "@/lib/labels";
import { PageHeader, StatusBadge } from "@/components/ui";
import { EmergencyKit } from "@/components/emergency-kit";
import type { Guide } from "@/lib/emergency-guide";

export const metadata = { title: "Lapor Darurat" };

export default async function ReportPage() {
  const user = await requirePermission("incident.report");
  const supabase = await createClient();

  const [{ data: vehicles }, { data: pbs }, { data: contacts }, { data: mine }, { data: branch }] = await Promise.all([
    supabase.from("vehicles").select("id,plate_no,main_driver_id").eq("is_active", true).order("plate_no"),
    supabase.from("emergency_playbooks").select("incident_type,title,steps").eq("is_active", true),
    supabase.from("emergency_contacts").select("scope,branch_id,region,role_label,name,phone,priority").eq("is_active", true).order("priority"),
    supabase.from("incidents").select("id,incident_no,type,status,reported_at").or(`reporter_id.eq.${user.id},driver_id.eq.${user.id}`).order("reported_at", { ascending: false }).limit(5),
    supabase.from("branches").select("region").eq("id", user.branchId).maybeSingle(),
  ]);

  // kendaraan: milik sendiri lebih dulu (pengemudi hanya melihat kendaraannya)
  const list = [...(vehicles ?? [])].sort((a, b) => Number(b.main_driver_id === user.id) - Number(a.main_driver_id === user.id));
  const relevant = (contacts ?? []).filter(
    (c) => c.scope === "GLOBAL" || (c.scope === "BRANCH" && c.branch_id === user.branchId) || (c.scope === "REGION" && branch?.region && c.region?.toLowerCase() === branch.region.toLowerCase()),
  );
  const guide: Guide = {
    userId: user.id,
    centerPhone: relevant[0]?.phone ?? null,
    playbooks: Object.fromEntries((pbs ?? []).map((p) => [p.incident_type, { title: p.title, steps: p.steps as string[] }])),
    contacts: relevant.map((c) => ({ role_label: c.role_label, name: c.name, phone: c.phone })),
    vehicles: list.map((v) => ({ id: v.id, plate: v.plate_no })),
    savedAt: new Date().toISOString(),
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Lapor Darurat" subtitle="Ketuk jenis kejadian. Laporan langsung terkirim ke pusat." />
      <EmergencyKit guide={guide} userId={user.id} defaultVehicleId={list.find((v) => v.main_driver_id === user.id)?.id ?? list[0]?.id} />
      {(mine ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-semibold">Laporan Anda</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface text-sm">
            {(mine ?? []).map((i) => (
              <li key={i.id}>
                <Link href={`/emergency/incidents/${i.id}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-background">
                  <span>
                    <b>{i.incident_no}</b> · {INCIDENT_TYPE[i.type]?.label}
                    <span className="block text-xs text-muted">{fmtDateTime(i.reported_at)}</span>
                  </span>
                  <StatusBadge map={INCIDENT_STATUS} value={i.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
