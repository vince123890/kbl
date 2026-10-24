import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ParameterForm, type ParameterRow } from "@/components/parameter-row";

export const metadata = { title: "Parameter Sistem" };

export default async function ParametersPage() {
  await requirePermission("admin.param");
  const supabase = await createClient();
  const { data } = await supabase.from("system_parameters").select("*").order("grp").order("label");

  const groups = new Map<string, ParameterRow[]>();
  for (const p of (data ?? []) as (ParameterRow & { grp: string })[]) {
    groups.set(p.grp, [...(groups.get(p.grp) ?? []), p]);
  }

  return (
    <>
      <PageHeader
        title="Parameter Sistem"
        subtitle="Nilai awal mengikuti asumsi di docs/assumption.md. Setiap perubahan tercatat di Audit Log."
      />
      <div className="space-y-5">
        {[...groups.entries()].map(([grp, items]) => (
          <section key={grp} className="rounded-xl border border-border bg-surface">
            <h2 className="border-b border-border px-4 py-2 text-sm font-semibold">{grp}</h2>
            <ul className="divide-y divide-border">
              {items.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.label}</p>
                    <code className="text-xs text-muted">{p.key}</code>
                  </div>
                  <ParameterForm p={p} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
