import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { INCIDENT_TYPE } from "@/lib/labels";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { PlaybookDialog, type PlaybookRow } from "@/components/playbook-dialog";
import { togglePlaybookAction } from "../actions";

export const metadata = { title: "Langkah Cepat" };

const ALL_TYPES = ["GENERAL", "BREAKDOWN", "ACCIDENT", "TIRE", "FIRE", "MEDICAL", "OTHER"];

export default async function PlaybooksPage() {
  const user = await requireUser();
  const manage = can(user, "contact.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("emergency_playbooks").select("id,incident_type,title,steps,is_active,version,updated_at").order("incident_type");
  const rows = (data ?? []) as unknown as (PlaybookRow & { is_active: boolean; version: number; updated_at: string })[];
  const activeTypes = new Set(rows.filter((r) => r.is_active).map((r) => r.incident_type));
  const free = ALL_TYPES.filter((t) => !activeTypes.has(t));

  return (
    <>
      <PageHeader
        title="Langkah Cepat (Playbook)"
        subtitle="Satu langkah cepat aktif per jenis kejadian. Bila tidak ada, pengemudi melihat langkah cepat Umum."
        actions={manage && free.length ? <PlaybookDialog availableTypes={free} /> : undefined}
      />
      {!rows.length ? (
        <EmptyState>Belum ada langkah cepat.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((p) => (
            <Card
              key={p.id}
              title={`${p.incident_type === "GENERAL" ? "Umum (cadangan)" : (INCIDENT_TYPE[p.incident_type]?.label ?? p.incident_type)} · ${p.title}`}
              actions={p.is_active ? <Badge tone="good">Aktif</Badge> : <Badge>Nonaktif</Badge>}
            >
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {p.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">
                Versi {p.version} · diubah {fmtDateTime(p.updated_at)}. Riwayat perubahan tercatat di Audit Log.
              </p>
              {manage && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <PlaybookDialog playbook={p} compact />
                  {p.incident_type !== "GENERAL" && (
                    <ActionButton
                      label={p.is_active ? "Nonaktifkan" : "Aktifkan"}
                      tone={p.is_active ? "danger" : "ghost"}
                      action={() => togglePlaybookAction(p.id, !p.is_active)}
                    />
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
