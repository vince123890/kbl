import Link from "next/link";
import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Ringkasan sederhana; widget operasional menyusul bersama modulnya (lihat MENU-SUBMENU-SPESIFIKASI §1).
  const [vehicles, spareparts] = await Promise.all([
    can(user, "master.read") ? supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("is_active", true) : null,
    can(user, "master.read") ? supabase.from("spareparts").select("id", { count: "exact", head: true }).eq("is_active", true) : null,
  ]);

  return (
    <>
      <PageHeader title={`Halo, ${user.name}`} subtitle={`${user.branchName} · ${user.roles.join(", ")}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles && <Stat label="Kendaraan aktif" value={vehicles.count ?? 0} href="/master/vehicles" />}
        {spareparts && <Stat label="Sparepart aktif" value={spareparts.count ?? 0} href="/master/spareparts" />}
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          Mutasi sparepart, perawatan, approval, dan emergensi akan tersedia pada rilis berikutnya.
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-surface p-4 hover:border-brand">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value.toLocaleString("id-ID")}</p>
    </Link>
  );
}
