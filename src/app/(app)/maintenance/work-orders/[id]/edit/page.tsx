import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadWoFormData } from "@/lib/wo-form-data";
import { toLocalInput } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { WoForm } from "@/components/wo-form";

export const metadata = { title: "Ubah Work Order" };

export default async function EditWoPage({ params }: PageProps<"/maintenance/work-orders/[id]/edit">) {
  const { id } = await params;
  await requirePermission("wo.write");
  const supabase = await createClient();
  const { data: w } = await supabase.from("work_orders").select("*,wo_parts(sparepart_id,qty_planned,location_id)").eq("id", id).maybeSingle();
  if (!w) notFound();
  if (!["PLANNED", "SCHEDULED"].includes(w.status)) redirect(`/maintenance/work-orders/${id}`);
  const data = await loadWoFormData(supabase, w.branch_id);

  return (
    <>
      <PageHeader title={`Ubah ${w.wo_no}`} subtitle="Field selain jadwal dapat diubah selama WO belum berjalan." />
      <WoForm
        initial={{
          id: w.id,
          version: w.row_version,
          type: w.type,
          typeLocked: true,
          priority: w.priority,
          vehicle_id: w.vehicle_id,
          start: toLocalInput(w.scheduled_start),
          end: toLocalInput(w.scheduled_end),
          scheduleLocked: w.status === "SCHEDULED",
          vendor_id: w.vendor_id ?? "",
          assignee_id: w.assignee_id ?? "",
          description: w.description ?? "",
          source_note: w.source_note ?? "",
          parts: (w.wo_parts as { sparepart_id: string; qty_planned: string; location_id: string | null }[]).map((p) => ({
            sparepart_id: p.sparepart_id,
            qty: String(Number(p.qty_planned)),
            location_id: p.location_id ?? "",
          })),
        }}
        {...data}
      />
    </>
  );
}
