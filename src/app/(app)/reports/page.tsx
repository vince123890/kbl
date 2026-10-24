import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { canViewReport, REPORTS } from "@/lib/reports";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Laporan" };

const GROUPS = ["Stok", "Perawatan", "Anomali Jadwal", "Emergensi", "Approval"] as const;

export default async function ReportsPage() {
  const user = await requirePermission("report.view");
  const allowed = REPORTS.filter((r) => canViewReport(user, r));

  return (
    <>
      <PageHeader title="Laporan" subtitle="Laporan bersifat tetap agar bentuknya sama setiap periode dan dapat diaudit. Data dibatasi sesuai cabang Anda." />
      {!allowed.length && <EmptyState>Role Anda belum memiliki laporan yang dapat dibuka.</EmptyState>}
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const list = allowed.filter((r) => r.group === g);
          if (!list.length) return null;
          return (
            <section key={g}>
              <h2 className="mb-2 font-heading text-lg">{g}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((r) => (
                  <Link key={r.code} href={`/reports/${r.slug}`} className="rounded-xl border border-border bg-surface p-4 hover:border-brand">
                    <p className="text-xs font-medium text-muted">{r.code}</p>
                    <p className="font-semibold">{r.title}</p>
                    <p className="mt-1 text-sm text-muted">{r.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
