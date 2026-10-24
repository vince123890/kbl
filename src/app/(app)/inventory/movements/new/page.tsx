import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadMovementFormData } from "@/lib/inventory-form-data";
import { todayWib } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { MovementForm } from "@/components/movement-form";

export const metadata = { title: "Mutasi Baru" };

export default async function NewMovementPage({ searchParams }: PageProps<"/inventory/movements/new">) {
  const user = await requirePermission("stock.create");
  const sp = await searchParams;
  const supabase = await createClient();
  const data = await loadMovementFormData(supabase, user, user.branchId);
  const wo = typeof sp.wo === "string" ? data.workOrders.find((w) => w.id === sp.wo) : undefined;

  return (
    <>
      <PageHeader title="Mutasi Baru" subtitle={`Cabang ${user.branchName}. Simpan sebagai draft atau langsung ajukan untuk approval.`} />
      <MovementForm
        initial={{
          type: wo || user.permissions.includes("stock.cancel") === false ? "OUT" : "IN",
          doc_date: todayWib(),
          vehicle_id: "",
          work_order_id: wo?.id ?? "",
          from_location_id: "",
          to_location_id: "",
          notes: "",
          lines: [],
        }}
        branchId={user.branchId}
        {...data}
      />
    </>
  );
}
