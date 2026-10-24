import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { queryMovements } from "@/lib/inventory-query";
import { STOCK_STATUS, STOCK_TYPE } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "stock.read")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const supabase = await createClient();
  const { rows } = await queryMovements(supabase, sp, [0, 49_999]);
  const csv = toCsv(
    ["No. Dokumen", "Tanggal", "Tipe", "Kendaraan", "No. WO", "Dari", "Ke", "Jumlah Item", "Status"],
    rows.map((r) => [
      r.doc_no,
      r.doc_date,
      STOCK_TYPE[r.type]?.label,
      r.vehicles?.plate_no,
      r.work_orders?.wo_no,
      r.from_loc?.name,
      r.to_loc?.name,
      r.stock_document_lines[0]?.count ?? 0,
      STOCK_STATUS[r.status]?.label,
    ]),
  );
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="mutasi-sparepart.csv"' },
  });
}
