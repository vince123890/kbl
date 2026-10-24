import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "admin.user")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  return new NextResponse(toCsv(["nama", "email", "telepon", "cabang", "role"], [["Budi Mekanik", "budi@contoh.co.id", "081234567890", "JKT", "MECHANIC"]]), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="template-user.csv"' },
  });
}
