import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchQueued } from "@/lib/notify-dispatch";

// Dipicu Vercel Cron (header Authorization: Bearer $CRON_SECRET) atau penjadwal lain. Tanpa rahasia yang benar: 401.
export const dynamic = "force-dynamic";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  const db = createAdminClient();
  const { data, error } = await db.rpc("_run_jobs");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const dispatched = await dispatchQueued(200);
  return NextResponse.json({ jobs: data, notifications: dispatched });
}

export const GET = run;
export const POST = run;
