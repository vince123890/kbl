import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "plan.write")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const csv = toCsv(
    ["nopol", "tugas", "interval_hari", "interval_km", "terakhir_tanggal", "terakhir_km"],
    [["B 9001 KBL", "Ganti oli mesin", 90, 10000, "2026-09-01", 80000]],
  );
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="template-rencana-perawatan.csv"' } });
}
