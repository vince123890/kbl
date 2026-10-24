import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { queryWorkOrders } from "@/lib/wo-query";
import { PRIORITY, WO_STATUS, WO_TYPE } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "wo.read")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const { rows } = await queryWorkOrders(await createClient(), sp, [0, 49_999]);
  const csv = toCsv(
    ["No. WO", "Kendaraan", "Jenis", "Prioritas", "Status", "Jadwal mulai", "Jadwal selesai", "Jatuh tempo", "Overdue", "Bengkel", "Teknisi", "Deskripsi"],
    rows.map((r) => [
      r.wo_no,
      r.vehicles?.plate_no,
      WO_TYPE[r.type]?.label,
      PRIORITY[r.priority]?.label,
      WO_STATUS[r.status]?.label,
      r.scheduled_start ? fmtDateTime(r.scheduled_start) : "",
      r.scheduled_end ? fmtDateTime(r.scheduled_end) : "",
      r.due_at ? fmtDateTime(r.due_at) : "",
      r.is_overdue ? "Ya" : "",
      r.vendors?.name,
      r.profiles?.name,
      r.description,
    ]),
  );
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="work-order.csv"' } });
}
