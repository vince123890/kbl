import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fmtAge, fmtDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { PushToggle } from "@/components/push-toggle";
import { markReadAction } from "./actions";

export const metadata = { title: "Notifikasi" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,title,body,link,status,created_at")
    .eq("user_id", user.id)
    .eq("channel", "INAPP")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const unread = rows.filter((r) => r.status !== "READ").length;

  return (
    <>
      <PageHeader
        title="Notifikasi"
        subtitle={unread ? `${unread} belum dibaca` : "Semua sudah dibaca"}
        actions={unread ? <ActionButton label="Tandai semua dibaca" action={() => markReadAction()} /> : undefined}
      />
      <div className="mb-4">
        <Card title="Notifikasi di perangkat ini">
          <PushToggle />
        </Card>
      </div>
      {!rows.length ? (
        <EmptyState>Belum ada notifikasi. Persetujuan, insiden, dan pengingat akan muncul di sini.</EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {rows.map((n) => {
            const body = (
              <div className="flex items-start gap-3 px-4 py-3">
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.status === "READ" ? "bg-border" : "bg-brand"}`} />
                <div className="min-w-0">
                  <p className={`text-sm ${n.status === "READ" ? "" : "font-semibold"}`}>{n.title}</p>
                  {n.body && <p className="text-sm text-muted">{n.body}</p>}
                  <p className="text-xs text-muted" title={fmtDateTime(n.created_at)}>
                    {fmtAge(n.created_at)} lalu
                  </p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-background">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </>
  );
}
