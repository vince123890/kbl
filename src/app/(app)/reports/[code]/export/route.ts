import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { canViewReport, cellText, EXPORT_LIMIT, getReport, runReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteContext<"/reports/[code]/export">) {
  const { code } = await ctx.params;
  const def = getReport(code);
  if (!def) return NextResponse.json({ error: "Laporan tidak dikenal" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user || !can(user, "report.export") || !canViewReport(user, def)) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const { rows, count } = await runReport(await createClient(), def, sp, [0, EXPORT_LIMIT - 1]);
  if (count > EXPORT_LIMIT) {
    return NextResponse.json({ error: `Hasil ${count} baris melebihi batas ekspor ${EXPORT_LIMIT}. Persempit periode atau filter.` }, { status: 413 });
  }
  const csv = toCsv(
    def.columns.map((c) => c.label),
    rows.map((r) => def.columns.map((c) => (c.kind === "num" && r[c.key] !== null ? Number(r[c.key]) : cellText(c, r[c.key]) === "-" ? "" : cellText(c, r[c.key])))),
  );
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${def.code.toLowerCase()}.csv"` },
  });
}
