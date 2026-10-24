import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Body {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/** Menyimpan langganan Web Push perangkat milik pengguna login. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.endpoint?.startsWith("https://") || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Langganan tidak valid" }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ endpoint: body.endpoint, user_id: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.endpoint) await createAdminClient().from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
