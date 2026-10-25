import Link from "next/link";
import { can, requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/lookups";
import { addDays, dayLabel, monthLabel, shift, visibleRange, type CalView } from "@/lib/calendar";
import { fmtTime, toLocalInput, todayWib } from "@/lib/format";
import { WO_STATUS, WO_TYPE } from "@/lib/labels";
import { PageHeader, StatusBadge } from "@/components/ui";
import { FilterSelect } from "@/components/list-controls";
import { CalendarBoard, CalendarLegend, type CalEvent } from "@/components/calendar-board";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Kalender Jadwal" };

interface Row {
  id: string;
  wo_no: string;
  type: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  due_at: string | null;
  is_overdue: boolean;
  vehicles: { plate_no: string } | null;
  vendors: { name: string } | null;
  profiles: { name: string } | null;
}

const VIEWS: { v: CalView; label: string }[] = [
  { v: "month", label: "Bulan" },
  { v: "week", label: "Minggu" },
  { v: "day", label: "Hari" },
  { v: "agenda", label: "Agenda" },
];

export default async function CalendarPage({ searchParams }: PageProps<"/maintenance/calendar">) {
  const user = await requirePermission("wo.read");
  const sp = await searchParams;
  const view = (VIEWS.some((x) => x.v === one(sp, "view")) ? one(sp, "view") : "month") as CalView;
  const today = todayWib();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp, "date")) ? one(sp, "date") : today;
  const group = one(sp, "group") === "technician" ? "technician" : "vehicle";
  const { from, to, days } = visibleRange(view, date);
  const supabase = await createClient();

  const base = () => {
    let q = supabase
      .from("work_orders")
      .select("id,wo_no,type,status,scheduled_start,scheduled_end,due_at,is_overdue,vehicles(plate_no),vendors(name),profiles!work_orders_assignee_id_fkey(name)")
      .neq("status", "CANCELLED");
    if (one(sp, "branch")) q = q.eq("branch_id", one(sp, "branch"));
    if (one(sp, "vehicle")) q = q.eq("vehicle_id", one(sp, "vehicle"));
    if (one(sp, "vendor")) q = q.eq("vendor_id", one(sp, "vendor"));
    if (one(sp, "type")) q = q.eq("type", one(sp, "type"));
    if (one(sp, "status")) q = q.eq("status", one(sp, "status"));
    return q;
  };
  const [scheduled, unscheduled, { data: reasons }, { data: branches }, { data: vehicles }, { data: vendors }] = await Promise.all([
    base().gte("scheduled_start", `${from}T00:00:00+07:00`).lt("scheduled_start", `${to}T00:00:00+07:00`).order("scheduled_start").limit(1500),
    base().is("scheduled_start", null).in("status", ["PLANNED"]).gte("due_at", `${from}T00:00:00+07:00`).lt("due_at", `${to}T00:00:00+07:00`).limit(500),
    supabase.from("reason_codes").select("id,name,require_note").eq("is_active", true).in("used_for", ["SCHEDULE_CHANGE", "ALL"]).order("name"),
    supabase.from("branches").select("id,name").order("name"),
    supabase.from("vehicles").select("id,plate_no").eq("is_active", true).order("plate_no"),
    supabase.from("vendors").select("id,name").eq("type", "BENGKEL").order("name"),
  ]);

  const canMove = can(user, "schedule.request");
  const toEvent = (r: Row, isUnscheduled: boolean): CalEvent => {
    const local = toLocalInput(isUnscheduled ? r.due_at : r.scheduled_start);
    return {
      id: r.id,
      woNo: r.wo_no,
      type: r.type,
      status: r.status,
      plate: r.vehicles?.plate_no ?? "",
      tech: r.profiles?.name ?? null,
      vendor: r.vendors?.name ?? null,
      date: local.slice(0, 10),
      time: isUnscheduled ? null : `${fmtTime(r.scheduled_start)}–${fmtTime(r.scheduled_end)}`,
      startLocal: isUnscheduled ? "" : local,
      overdue: r.is_overdue,
      unscheduled: isUnscheduled,
      movable: canMove && !isUnscheduled && ["PLANNED", "SCHEDULED"].includes(r.status),
    };
  };
  const events = [
    ...((scheduled.data ?? []) as unknown as Row[]).map((r) => toEvent(r, false)),
    ...((unscheduled.data ?? []) as unknown as Row[]).map((r) => toEvent(r, true)),
  ];

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, view, date, ...patch })) if (typeof v === "string" && v) p.set(k, v);
    return `/maintenance/calendar?${p.toString()}`;
  };
  const title = view === "month" ? monthLabel(date) : view === "day" ? dayLabel(date) : `${dayLabel(days[0])} – ${dayLabel(days[days.length - 1])}`;
  const reasonOpts = (reasons ?? []) as { id: string; name: string; require_note: boolean }[];

  // agenda: kelompokkan per kendaraan atau teknisi, lalu per tanggal
  const grouped = new Map<string, CalEvent[]>();
  for (const e of events) {
    const key = group === "technician" ? (e.tech ?? "Belum ditugaskan") : e.plate;
    grouped.set(key, [...(grouped.get(key) ?? []), e]);
  }

  return (
    <>
      <PageHeader
        title="Kalender Jadwal"
        subtitle={canMove ? "Seret WO ke hari lain untuk mengajukan perubahan jadwal (alasan wajib; tidak langsung berpindah)." : "Klik WO untuk melihat detail."}
        actions={<PrintButton label="Cetak jadwal" />}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <nav aria-label="Tampilan" className="flex overflow-hidden rounded-lg border border-border">
          {VIEWS.map((x) => (
            <Link key={x.v} href={href({ view: x.v })} className={`tap flex items-center px-3 text-sm ${view === x.v ? "bg-brand font-medium text-on-brand" : "bg-surface hover:bg-brand-soft"}`}>
              {x.label}
            </Link>
          ))}
        </nav>
        <Link href={href({ date: shift(view, date, -1) })} aria-label="Sebelumnya" className="tap flex items-center rounded-lg border border-border px-3 hover:bg-brand-soft">
          ‹
        </Link>
        <Link href={href({ date: today })} className="tap flex items-center rounded-lg border border-border px-3 text-sm hover:bg-brand-soft">
          Hari ini
        </Link>
        <Link href={href({ date: shift(view, date, 1) })} aria-label="Berikutnya" className="tap flex items-center rounded-lg border border-border px-3 hover:bg-brand-soft">
          ›
        </Link>
        <h2 className="ml-1 font-heading text-lg">{title}</h2>
      </div>
      <div className="filter-bar print:hidden">
        <FilterSelect name="branch" label="Cabang" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect name="vehicle" label="Kendaraan" options={(vehicles ?? []).map((v) => ({ value: v.id, label: v.plate_no }))} />
        <FilterSelect name="vendor" label="Bengkel" options={(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))} />
        <FilterSelect name="type" label="Jenis" options={Object.entries(WO_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        <FilterSelect name="status" label="Status" options={Object.entries(WO_STATUS).map(([value, d]) => ({ value, label: d.label }))} />
        {view === "agenda" && (
          <nav aria-label="Pengelompokan" className="flex overflow-hidden rounded-lg border border-border text-sm">
            <Link href={href({ group: "vehicle" })} className={`tap flex items-center px-3 ${group === "vehicle" ? "bg-brand font-medium text-on-brand" : "bg-surface"}`}>
              Per kendaraan
            </Link>
            <Link href={href({ group: "technician" })} className={`tap flex items-center px-3 ${group === "technician" ? "bg-brand font-medium text-on-brand" : "bg-surface"}`}>
              Per teknisi
            </Link>
          </nav>
        )}
      </div>
      <div className="mb-3">
        <CalendarLegend />
      </div>

      {(view === "month" || view === "week") && (
        <>
          {/* layar lebar: grid kalender (bisa diseret). Ponsel: daftar per tanggal yang mudah dibaca dan diketuk */}
          <div className="hidden md:block">
            <CalendarBoard days={days} events={events} inMonth={view === "month" ? date.slice(0, 7) : undefined} today={today} tall={view === "week"} reasons={reasonOpts} />
          </div>
          <div className="space-y-3 md:hidden">
            {events.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">Tidak ada WO pada rentang ini.</p>}
            {days
              .filter((d) => events.some((e) => e.date === d))
              .map((d) => (
                <section key={d}>
                  <h3 className={`mb-1 text-sm font-semibold ${d === today ? "text-foreground" : "text-muted"}`}>
                    {dayLabel(d)}
                    {d === today && " · hari ini"}
                  </h3>
                  <div className="space-y-2">
                    {events
                      .filter((e) => e.date === d)
                      .sort((a, b) => a.startLocal.localeCompare(b.startLocal))
                      .map((e) => (
                        <EventRow key={e.id} e={e} />
                      ))}
                  </div>
                </section>
              ))}
          </div>
        </>
      )}

      {view === "day" && (
        <div className="space-y-2">
          {events.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">Tidak ada WO pada hari ini.</p>}
          {events
            .sort((a, b) => a.startLocal.localeCompare(b.startLocal))
            .map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
        </div>
      )}

      {view === "agenda" && (
        <div className="space-y-4">
          {events.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">Tidak ada WO pada 30 hari ke depan.</p>}
          {[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, list]) => (
            <section key={name} className="rounded-xl border border-border bg-surface p-3">
              <h3 className="mb-2 font-semibold">{name}</h3>
              <div className="space-y-2">
                {list
                  .sort((a, b) => a.date.localeCompare(b.date) || a.startLocal.localeCompare(b.startLocal))
                  .map((e) => (
                    <EventRow key={e.id} e={e} showDate />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted print:hidden">Rentang ditampilkan: {days[0]} s.d. {addDays(to, -1)} (WIB).</p>
    </>
  );
}

function EventRow({ e, showDate }: { e: CalEvent; showDate?: boolean }) {
  const color = e.type === "EMERGENCY" ? "border-danger/50" : e.type === "PREVENTIVE" ? "border-sky-300" : "border-amber-300";
  return (
    <Link href={`/maintenance/work-orders/${e.id}`} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-l-4 bg-surface px-3 py-2 text-sm hover:bg-background ${color} ${e.overdue ? "ring-2 ring-danger" : ""}`}>
      <b>{e.woNo}</b>
      <span>{e.plate}</span>
      {showDate && <span className="text-muted">{e.date}</span>}
      <span className="text-muted">{e.time ?? "jatuh tempo (belum dijadwalkan)"}</span>
      {e.tech && <span>· {e.tech}</span>}
      {e.vendor && <span>· {e.vendor}</span>}
      <StatusBadge map={WO_TYPE} value={e.type} />
      <StatusBadge map={WO_STATUS} value={e.status} />
    </Link>
  );
}
