import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadMovementFormData } from "@/lib/inventory-form-data";
import { PageHeader } from "@/components/ui";
import { MovementForm } from "@/components/movement-form";

export const metadata = { title: "Ubah Mutasi" };

export default async function EditMovementPage({ params }: PageProps<"/inventory/movements/[id]/edit">) {
  const { id } = await params;
  const user = await requirePermission("stock.create");
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("stock_documents")
    .select("*,stock_document_lines(sparepart_id,qty,notes,line_no)")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();
  if (d.status !== "DRAFT" || d.type === "ADJUSTMENT") redirect(`/inventory/movements/${id}`);

  const data = await loadMovementFormData(supabase, user, d.branch_id);
  const lines = [...(d.stock_document_lines as { sparepart_id: string; qty: string; notes: string | null; line_no: number }[])]
    .sort((a, b) => a.line_no - b.line_no)
    .map((l) => ({ sparepart_id: l.sparepart_id, qty: String(Number(l.qty)), notes: l.notes ?? "" }));

  return (
    <>
      <PageHeader title={`Ubah ${d.doc_no}`} subtitle="Dokumen masih Draft sehingga dapat diubah." />
      <MovementForm
        initial={{
          id: d.id,
          version: d.row_version,
          type: d.type,
          doc_date: d.doc_date,
          vehicle_id: d.vehicle_id ?? "",
          work_order_id: d.work_order_id ?? "",
          from_location_id: d.from_location_id ?? "",
          to_location_id: d.to_location_id ?? "",
          notes: d.notes ?? "",
          lines,
        }}
        branchId={d.branch_id}
        {...data}
      />
    </>
  );
}
