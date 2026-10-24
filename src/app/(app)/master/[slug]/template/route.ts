import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const TEMPLATES: Record<string, { headers: string[]; sample: unknown[] }> = {
  vehicles: { headers: ["nopol", "tipe", "model", "tahun", "cabang", "odometer", "status", "catatan"], sample: ["B 9001 KBL", "Truk", "Hino 500", 2021, "JKT", 84250, "ACTIVE", ""] },
  spareparts: { headers: ["kode", "nama", "kategori", "satuan", "stok_min", "deskripsi"], sample: ["FLT-OLI-01", "Filter Oli Hino 500", "Filter", "pcs", 10, ""] },
};

export async function GET(_request: Request, ctx: RouteContext<"/master/[slug]/template">) {
  const { slug } = await ctx.params;
  const t = TEMPLATES[slug];
  const user = await getCurrentUser();
  if (!t) return NextResponse.json({ error: "Template tidak tersedia" }, { status: 404 });
  if (!user || !can(user, "master.write")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  return new NextResponse(toCsv(t.headers, [t.sample]), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="template-${slug}.csv"` },
  });
}
