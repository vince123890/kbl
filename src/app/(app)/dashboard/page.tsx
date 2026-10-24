import Link from "next/link";
import { can, requireUser, type CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/calendar";
import { nowMs } from "@/lib/clock";
import { fmtAge, fmtDateTime, todayWib } from "@/lib/format";
import { DOC_TYPE, INCIDENT_STATUS, INCIDENT_TYPE, WO_TYPE, label } from "@/lib/labels";
import { Badge, PageHeader, StatusBadge } from "@/components/ui";
import { LiveRefresh } from "@/components/live-refresh";

export const metadata = { title: "Dashboard" };

const has = (u: CurrentUser, ...roles: string[]) => u.roles.some((r) => roles.includes(r));

function Widget({ code, title, href, children, tone }: { code: string; title: string; href?: string; children: React.ReactNode; tone?: "bad" }) {
  const body = (
    <section aria-label={title} className={`h-full rounded-xl border bg-surface p-4 ${tone === "bad" ? "border-danger/50" : "border-border"} ${href ? "hover:border-brand" : ""}`}>
      <p className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted">
        <span>{title}</span>
        <span>{code}</span>
      </p>
      {children}
    </section>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

const Empty = () => <p className="text-sm text-muted">Tidak ada data.</p>;
const Big = ({ n, unit }: { n: number; unit?: string }) => (
  <p className="text-3xl font-semibold tabular-nums">
    {n.toLocaleString("id-ID")} {unit && <span className="text-sm font-normal text-muted">{unit}</span>}
  </p>
);

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayWib();
  const dayStart = `${today}T00:00:00+07:00`;
  const dayEnd = `${addDays(today, 1)}T00:00:00+07:00`;
  const weekEnd = `${addDays(today, 7)}T00:00:00+07:00`;

  const central = has(user, "SUPERVISOR", "DEPT_HEAD", "HQ_ADMIN");
  const w1 = has(user, "DRIVER", "SUPERVISOR", "HQ_ADMIN");
  const w2 = can(user, "approval.act");
  const w3 = can(user, "approval.viewall");
  const w7 = has(user, "WAREHOUSE", "SUPERVISOR", "DEPT_HEAD", "HQ_ADMIN", "SYS_ADMIN");
  const w6 = has(user, "SUPERVISOR", "HQ_ADMIN");
  const w9 = has(user, "DEPT_HEAD", "HQ_ADMIN");
  const w10 = central || has(user, "SYS_ADMIN");
  const w11 = has(user, "MECHANIC", "DRIVER");
  const w12 = can(user, "incident.report");
  const generic = !w1 && !w2 && !w7 && !central && !w11 && !w12; // role buatan sendiri

  const [inc, myPending, allPending, woRows, overdue, plans, lowStock, anomalies, validation, fleet, mine] = await Promise.all([
    w1 ? supabase.from("incidents").select("id,incident_no,type,status,reported_at,vehicles(plate_no)").neq("status", "CLOSED").order("reported_at", { ascending: false }).limit(6) : null,
    w2
      ? supabase.from("approval_requests").select("id,doc_type,doc_no,summary,steps,current_step,step_started_at,requested_by").eq("status", "PENDING").order("requested_at").limit(100)
      : null,
    w3 ? supabase.from("approval_requests").select("doc_type,steps,current_step,step_started_at").eq("status", "PENDING").limit(1000) : null,
    central ? supabase.from("work_orders").select("status,scheduled_start").neq("status", "CANCELLED").gte("scheduled_start", dayStart).lt("scheduled_start", weekEnd).limit(1000) : null,
    central ? supabase.from("work_orders").select("id,wo_no,due_at,vehicles(plate_no)").eq("is_overdue", true).order("due_at").limit(5) : null,
    w6
      ? supabase.from("maintenance_plans").select("id,task_name,next_due_at,next_due_km,vehicles(plate_no,odometer)").eq("is_active", true).or(`next_due_at.lte.${addDays(today, 7)},next_due_km.not.is.null`).limit(500)
      : null,
    w7 ? supabase.from("rpt_03_posisi_stok").select("sparepart,kode,branch_id,on_hand,stok_min,lokasi").eq("di_bawah_min", true).limit(60) : null,
    central ? supabase.from("rpt_07_anomali").select("tipe,alasan").gte("tgl", addDays(today, -30)).limit(1000) : null,
    w9 ? supabase.from("work_orders").select("id,wo_no,validation_due,vehicles(plate_no)").eq("type", "EMERGENCY").eq("emergency_validation", "PENDING").order("validation_due").limit(5) : null,
    w10 ? supabase.from("vehicles").select("status").eq("is_active", true).limit(5000) : null,
    w11
      ? supabase
          .from("work_orders")
          .select("id,wo_no,type,status,scheduled_start,description,vehicles(plate_no)")
          .in("status", ["PLANNED", "SCHEDULED", "IN_PROGRESS"])
          .order("scheduled_start", { ascending: true, nullsFirst: false })
          .limit(6)
      : null,
  ]);

  // W2: hanya yang menunggu role saya
  type Step = { role: string; sla_hours: number };
  const mineApprovals = (myPending?.data ?? []).filter((r) => {
    const s = (r.steps as Step[])[r.current_step - 1];
    return s && user.roles.includes(s.role) && r.requested_by !== user.id;
  });
  const now = nowMs();
  const isLate = (r: { steps: unknown; current_step: number; step_started_at: string }) => {
    const s = (r.steps as Step[])[r.current_step - 1];
    return !!s && now > new Date(r.step_started_at).getTime() + s.sla_hours * 3_600_000;
  };

  const woToday = (woRows?.data ?? []).filter((w) => w.scheduled_start && w.scheduled_start >= dayStart && w.scheduled_start < dayEnd);
  const count = (list: { status: string }[], s: string) => list.filter((w) => w.status === s).length;
  const fleetBy = (s: string) => (fleet?.data ?? []).filter((v) => v.status === s).length;

  const planRows = ((plans?.data ?? []) as unknown as { id: string; task_name: string; next_due_at: string | null; next_due_km: string | null; vehicles: { plate_no: string; odometer: string } }[])
    .map((p) => ({
      ...p,
      days: p.next_due_at ? Math.round((new Date(`${p.next_due_at}T00:00:00+07:00`).getTime() - new Date(`${today}T00:00:00+07:00`).getTime()) / 86_400_000) : null,
      km: p.next_due_km ? Number(p.next_due_km) - Number(p.vehicles.odometer) : null,
    }))
    .filter((p) => (p.days !== null && p.days <= 7) || (p.km !== null && p.km <= 500))
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
    .slice(0, 5);

  const anom = (anomalies?.data ?? []) as { tipe: string; alasan: string }[];
  const reasonCount = new Map<string, number>();
  for (const a of anom) reasonCount.set(a.alasan, (reasonCount.get(a.alasan) ?? 0) + 1);
  const topReasons = [...reasonCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const lowRows = (lowStock?.data ?? []) as { sparepart: string; kode: string; on_hand: string; stok_min: string }[];
  const lowUnique = [...new Map(lowRows.map((r) => [r.kode, r])).values()];

  const unackedIncidents = (inc?.data ?? []).filter((i) => i.status === "REPORTED").length;

  return (
    <>
      {(w1 || w2) && <LiveRefresh seconds={60} />}
      <PageHeader title={`Halo, ${user.name}`} subtitle={`${user.branchName} · ${user.roles.join(", ") || "tanpa role"}`} />

      {w12 && (
        <Link
          href="/emergency/report"
          className="mb-4 flex min-h-20 items-center justify-center gap-3 rounded-2xl border-2 border-danger bg-danger-soft px-4 py-4 text-xl font-semibold text-danger hover:bg-danger hover:text-white"
        >
          <span aria-hidden>🚨</span> LAPOR DARURAT
        </Link>
      )}

      {generic && (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
          Belum ada widget untuk role Anda. Gunakan menu di samping untuk membuka modul yang tersedia.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {w1 && (
          <Widget code="W1" title="Insiden emergensi aktif" href="/emergency/incidents" tone={unackedIncidents ? "bad" : undefined}>
            {inc?.data?.length ? (
              <ul className="space-y-1.5 text-sm">
                {(inc.data as unknown as { id: string; incident_no: string; type: string; status: string; reported_at: string; vehicles: { plate_no: string } | null }[]).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span>
                      {i.vehicles?.plate_no} · {label(INCIDENT_TYPE, i.type)}
                      <span className="block text-xs text-muted">{fmtAge(i.reported_at)} lalu</span>
                    </span>
                    <StatusBadge map={INCIDENT_STATUS} value={i.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Widget>
        )}

        {w2 && (
          <Widget code="W2" title="Antrean approval saya" href="/approvals/inbox">
            <Big n={mineApprovals.length} unit="dokumen" />
            {mineApprovals.slice(0, 5).map((r) => (
              <p key={r.id} className="mt-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {label(DOC_TYPE, r.doc_type)} · {r.doc_no}
                </span>
                {isLate(r) && <Badge tone="bad">Terlambat</Badge>}
              </p>
            ))}
            {!mineApprovals.length && <p className="mt-1 text-sm text-muted">Tidak ada yang menunggu.</p>}
          </Widget>
        )}

        {w3 && (
          <Widget code="W3" title="Semua antrean approval" href="/approvals/all">
            <Big n={allPending?.data?.length ?? 0} unit="menunggu" />
            <p className="text-sm text-muted">{(allPending?.data ?? []).filter(isLate).length} terlambat SLA</p>
            <ul className="mt-1 text-sm">
              {Object.keys(DOC_TYPE).map((t) => {
                const n = (allPending?.data ?? []).filter((r) => r.doc_type === t).length;
                return n ? (
                  <li key={t}>
                    {label(DOC_TYPE, t)}: <b>{n}</b>
                  </li>
                ) : null;
              })}
            </ul>
          </Widget>
        )}

        {central && (
          <Widget code="W4" title="WO hari ini & minggu ini" href="/maintenance/work-orders">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted">Hari ini</p>
                <Big n={woToday.length} />
                <p className="text-xs text-muted">
                  {count(woToday, "SCHEDULED")} terjadwal · {count(woToday, "IN_PROGRESS")} berjalan · {count(woToday, "COMPLETED")} selesai
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">7 hari ke depan</p>
                <Big n={woRows?.data?.length ?? 0} />
              </div>
            </div>
          </Widget>
        )}

        {central && (
          <Widget code="W5" title="WO overdue" href="/maintenance/work-orders?overdue=1" tone={overdue?.data?.length ? "bad" : undefined}>
            {overdue?.data?.length ? (
              <ul className="space-y-1 text-sm">
                {(overdue.data as unknown as { id: string; wo_no: string; due_at: string; vehicles: { plate_no: string } | null }[]).map((w) => (
                  <li key={w.id}>
                    {w.vehicles?.plate_no} · {w.wo_no}
                    <span className="block text-xs text-danger">jatuh tempo {fmtDateTime(w.due_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Widget>
        )}

        {w6 && (
          <Widget code="W6" title="Perawatan jatuh tempo ≤ 7 hari" href="/maintenance/plans">
            {planRows.length ? (
              <ul className="space-y-1 text-sm">
                {planRows.map((p) => (
                  <li key={p.id}>
                    {p.vehicles.plate_no} · {p.task_name}
                    <span className="block text-xs text-muted">{[p.days !== null && (p.days < 0 ? `terlambat ${-p.days} hari` : `${p.days} hari`), p.km !== null && p.km <= 500 && `${Math.round(p.km)} km`].filter(Boolean).join(" / ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Widget>
        )}

        {w7 && (
          <Widget code="W7" title="Stok kritis" href="/inventory/balances?low=1" tone={lowUnique.length ? "bad" : undefined}>
            <Big n={lowUnique.length} unit="sparepart" />
            <ul className="mt-1 space-y-0.5 text-sm">
              {lowUnique.slice(0, 5).map((r) => (
                <li key={r.kode}>
                  {r.sparepart} <span className="text-muted">({Number(r.on_hand)} / min {Number(r.stok_min)})</span>
                </li>
              ))}
            </ul>
            {!lowUnique.length && <p className="text-sm text-muted">Semua stok di atas minimum.</p>}
          </Widget>
        )}

        {central && (
          <Widget code="W8" title="Anomali jadwal 30 hari" href="/maintenance/schedule-changes">
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-muted">Percepatan</p>
                <Big n={anom.filter((a) => a.tipe === "Percepatan").length} />
              </div>
              <div>
                <p className="text-xs text-muted">Penundaan</p>
                <Big n={anom.filter((a) => a.tipe === "Penundaan").length} />
              </div>
            </div>
            {topReasons.length ? (
              <ol className="mt-2 text-sm">
                {topReasons.map(([n, c]) => (
                  <li key={n}>
                    {n} <b>({c})</b>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">Belum ada anomali.</p>
            )}
          </Widget>
        )}

        {w9 && (
          <Widget code="W9" title="Validasi pasca-kejadian" href="/approvals/inbox">
            {validation?.data?.length ? (
              <ul className="space-y-1 text-sm">
                {(validation.data as unknown as { id: string; wo_no: string; validation_due: string; vehicles: { plate_no: string } | null }[]).map((w) => {
                  const hrs = Math.round((new Date(w.validation_due).getTime() - now) / 3_600_000);
                  return (
                    <li key={w.id}>
                      {w.vehicles?.plate_no} · {w.wo_no}
                      <span className={`block text-xs ${hrs < 0 ? "font-semibold text-danger" : "text-muted"}`}>{hrs < 0 ? `terlambat ${-hrs} jam` : `sisa ${hrs} jam`}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty />
            )}
          </Widget>
        )}

        {w10 && (
          <Widget code="W10" title="Status armada" href="/master/vehicles">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <Big n={fleetBy("ACTIVE")} />
                <p className="text-xs text-muted">Aktif</p>
              </div>
              <div>
                <Big n={fleetBy("IN_MAINTENANCE")} />
                <p className="text-xs text-muted">Dirawat</p>
              </div>
              <div>
                <Big n={fleetBy("OUT_OF_SERVICE")} />
                <p className="text-xs text-muted">Tidak beroperasi</p>
              </div>
            </div>
          </Widget>
        )}

        {w11 && (
          <Widget code="W11" title="Tugas saya" href="/maintenance/work-orders">
            {mine?.data?.length ? (
              <ul className="space-y-1.5 text-sm">
                {(mine.data as unknown as { id: string; wo_no: string; type: string; scheduled_start: string | null; description: string | null; vehicles: { plate_no: string } | null }[]).map((w) => (
                  <li key={w.id}>
                    <Link href={`/maintenance/work-orders/${w.id}`} className="underline decoration-brand decoration-2 underline-offset-2">
                      {w.vehicles?.plate_no} · {w.wo_no}
                    </Link>
                    <span className="block text-xs text-muted">
                      {label(WO_TYPE, w.type)} · {w.scheduled_start ? fmtDateTime(w.scheduled_start) : "belum dijadwalkan"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Widget>
        )}
      </div>
    </>
  );
}
