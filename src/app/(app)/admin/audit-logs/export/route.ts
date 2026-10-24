import { NextResponse, type NextRequest } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { applyAuditFilters, csvCell } from "@/lib/audit-query";

const MAX_ROWS = 50_000;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(user, "audit.view") || !can(user, "report.export")) return new NextResponse("Forbidden", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const filters = {
    entity: sp.get("entity") ?? "",
    action: sp.get("action") ?? "",
    user: sp.get("user") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
  };

  const supabase = await createClient();
  const base = supabase.from("audit_logs").select("id,at,user_id,entity,entity_id,action,before,after,ip,meta");
  const { data, error } = await applyAuditFilters(base, filters).order("id", { ascending: false }).limit(MAX_ROWS);
  if (error) return new NextResponse(error.message, { status: 500 });

  const { data: people } = await supabase.from("profiles").select("id,name");
  const who = new Map((people ?? []).map((p) => [p.id, p.name]));

  const header = ["id", "waktu_utc", "user", "entitas", "entitas_id", "aksi", "sebelum", "sesudah", "ip", "meta"];
  const lines = [header.join(",")];
  for (const r of data ?? []) {
    lines.push(
      [r.id, r.at, r.user_id ? (who.get(r.user_id) ?? r.user_id) : "Sistem", r.entity, r.entity_id, r.action, r.before, r.after, r.ip, r.meta]
        .map(csvCell)
        .join(","),
    );
  }
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
