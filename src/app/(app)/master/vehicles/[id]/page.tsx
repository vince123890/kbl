import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Detail Kendaraan" };

const STATUS: Record<string, string> = { ACTIVE: "Aktif", IN_MAINTENANCE: "Dalam Perawatan", OUT_OF_SERVICE: "Tidak Beroperasi" };
const fmt = (n: number | string) => Number(n).toLocaleString("id-ID");
const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export default async function VehicleDetailPage({ params }: PageProps<"/master/vehicles/[id]">) {
  const { id } = await params;
  await requirePermission("master.read");
  const supabase = await createClient();

  // RLS: kendaraan cabang lain tidak terlihat → 404
  const { data: vehicle } = await supabase.from("vehicles").select("*, branches(name)").eq("id", id).maybeSingle();
  if (!vehicle) notFound();

  const { data: logs } = await supabase
    .from("vehicle_odometer_logs")
    .select("id,old_value,new_value,changed_at,changed_by")
    .eq("vehicle_id", id)
    .order("id", { ascending: false })
    .limit(50);

  const ids = [...new Set((logs ?? []).map((l) => l.changed_by).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id,name").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title={vehicle.plate_no}
        subtitle={`${vehicle.type}${vehicle.model ? ` · ${vehicle.model}` : ""}`}
        actions={
          <Link href="/master/vehicles" className="tap inline-flex items-center rounded-lg border border-border px-3 text-sm hover:bg-background">
            ← Daftar kendaraan
          </Link>
        }
      />
      <section className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Cabang" value={vehicle.branches?.name ?? "-"} />
        <Info label="Tahun" value={vehicle.year ?? "-"} />
        <Info label="Odometer" value={`${fmt(vehicle.odometer)} km`} />
        <Info
          label="Status"
          value={<Badge tone={vehicle.status === "ACTIVE" ? "good" : "warn"}>{STATUS[vehicle.status] ?? vehicle.status}</Badge>}
        />
        {vehicle.notes && <Info label="Catatan" value={vehicle.notes} />}
      </section>

      <h2 className="mb-2 font-semibold">Riwayat Odometer</h2>
      {!logs?.length ? (
        <EmptyState>Belum ada perubahan odometer.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Waktu</th>
                <th className="px-3 py-2 font-medium">Lama (km)</th>
                <th className="px-3 py-2 font-medium">Baru (km)</th>
                <th className="px-3 py-2 font-medium">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{fmtDate(l.changed_at)}</td>
                  <td className="px-3 py-2">{fmt(l.old_value)}</td>
                  <td className="px-3 py-2">{fmt(l.new_value)}</td>
                  <td className="px-3 py-2">{l.changed_by ? (who.get(l.changed_by) ?? "-") : "Sistem"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">Rencana perawatan, work order, pemakaian sparepart, dan insiden akan muncul di sini pada rilis berikutnya.</p>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
