import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;

interface Queued {
  id: string;
  user_id: string;
  channel: "PUSH" | "WHATSAPP" | "SMS" | "EMAIL";
  title: string;
  body: string | null;
  link: string | null;
  attempts: number;
}

export interface DispatchResult {
  sent: number;
  failed: number;
}

function pushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function webhookConfigured(): boolean {
  return !!process.env.NOTIFY_WEBHOOK_URL;
}

/**
 * Mengirim notifikasi berstatus QUEUED. Dalam aplikasi (INAPP) sudah SENT saat dibuat.
 * - PUSH: Web Push (VAPID) ke semua perangkat yang berlangganan.
 * - WHATSAPP / SMS / EMAIL: POST JSON ke NOTIFY_WEBHOOK_URL (penyedia dipilih pemilik sistem; lihat README).
 * Kanal yang belum dikonfigurasi ditandai FAILED dengan alasan yang jelas, dan dapat dikirim ulang dari Log Notifikasi.
 * Kegagalan di sini tidak pernah membatalkan transaksi bisnis karena baris dibuat lebih dulu di basis data.
 */
export async function dispatchQueued(limit = 50, opts: { includeFailed?: boolean } = {}): Promise<DispatchResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { sent: 0, failed: 0 };
  const db = createAdminClient();
  let q = db
    .from("notifications")
    .select("id,user_id,channel,title,body,link,attempts")
    .neq("channel", "INAPP")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(limit);
  q = opts.includeFailed ? q.in("status", ["QUEUED", "FAILED"]) : q.eq("status", "QUEUED");
  const { data } = await q;
  const rows = (data ?? []) as Queued[];
  if (!rows.length) return { sent: 0, failed: 0 };

  if (pushConfigured()) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  const res: DispatchResult = { sent: 0, failed: 0 };
  const phones = new Map<string, string | null>();

  for (const n of rows) {
    let error: string | null = null;
    try {
      if (n.channel === "PUSH") {
        if (!pushConfigured()) throw new Error("Web Push belum dikonfigurasi (isi kunci VAPID)");
        const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", n.user_id);
        if (!subs?.length) throw new Error("Pengguna belum mengaktifkan notifikasi di perangkatnya");
        const payload = JSON.stringify({ title: n.title, body: n.body, url: n.link ?? "/dashboard" });
        let ok = 0;
        for (const s of subs) {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
            ok++;
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
        if (!ok) throw new Error("Tidak ada perangkat yang dapat dijangkau");
      } else {
        if (!webhookConfigured()) throw new Error(`Kanal ${n.channel} belum dikonfigurasi (isi NOTIFY_WEBHOOK_URL)`);
        if (!phones.has(n.user_id)) {
          const { data: p } = await db.from("profiles").select("phone,email").eq("id", n.user_id).maybeSingle();
          phones.set(n.user_id, n.channel === "EMAIL" ? (p?.email ?? null) : (p?.phone ?? null));
        }
        const to = phones.get(n.user_id);
        if (!to) throw new Error(n.channel === "EMAIL" ? "Pengguna tidak punya email" : "Pengguna tidak punya nomor telepon");
        const r = await fetch(process.env.NOTIFY_WEBHOOK_URL!, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(process.env.NOTIFY_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.NOTIFY_WEBHOOK_TOKEN}` } : {}),
          },
          body: JSON.stringify({ channel: n.channel, to, title: n.title, body: n.body, link: n.link, id: n.id }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) throw new Error(`Penyedia membalas ${r.status}`);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    if (error) {
      res.failed++;
      await db.from("notifications").update({ status: "FAILED", attempts: n.attempts + 1, last_error: error }).eq("id", n.id);
    } else {
      res.sent++;
      await db.from("notifications").update({ status: "SENT", attempts: n.attempts + 1, last_error: null, sent_at: new Date().toISOString() }).eq("id", n.id);
    }
  }
  return res;
}
