import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** Template CSV hasil hitung: kode, nama, sistem terisi; fisik/alasan/keterangan diisi petugas. */
export async function GET(_request: Request, ctx: RouteContext<"/inventory/counts/[id]/template">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user, "count.enter")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const supabase = await createClient();
  const { data: c } = await supabase.from("stock_counts").select("count_no").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  const { data } = await supabase.from("stock_count_lines").select("system_qty,spareparts(code,name)").eq("count_id", id);
  const rows = ((data ?? []) as unknown as { system_qty: string; spareparts: { code: string; name: string } }[])
    .sort((a, b) => a.spareparts.code.localeCompare(b.spareparts.code))
    .map((l) => [l.spareparts.code, l.spareparts.name, Number(l.system_qty), "", "", ""]);
  return new NextResponse(toCsv(["kode", "nama", "sistem", "fisik", "alasan", "keterangan"], rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="template-${c.count_no}.csv"` },
  });
}
