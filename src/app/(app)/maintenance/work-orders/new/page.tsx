import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadWoFormData } from "@/lib/wo-form-data";
import { one } from "@/lib/lookups";
import { PageHeader } from "@/components/ui";
import { WoForm } from "@/components/wo-form";

export const metadata = { title: "Work Order Baru" };

export default async function NewWoPage({ searchParams }: PageProps<"/maintenance/work-orders/new">) {
  const user = await requirePermission("wo.write");
  const sp = await searchParams;
  const supabase = await createClient();
  const data = await loadWoFormData(supabase, user.branchId);
  const type = ["PREVENTIVE", "CORRECTIVE", "EMERGENCY"].includes(one(sp, "type")) ? one(sp, "type") : "CORRECTIVE";

  return (
    <>
      <PageHeader title="Work Order Baru" subtitle={`Cabang ${user.branchName}. Bentrok jadwal kendaraan atau teknisi ditolak, kecuali WO emergensi.`} />
      <WoForm
        initial={{
          type,
          priority: "NORMAL",
          vehicle_id: one(sp, "vehicle"),
          start: "",
          end: "",
          vendor_id: "",
          assignee_id: "",
          description: "",
          source_note: "",
          parts: [],
        }}
        {...data}
      />
    </>
  );
}
