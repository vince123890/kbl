import type { ReactNode } from "react";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { MASTERS } from "@/lib/masters";

type Item = NavGroup["items"][number];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const handler = can(user, "incident.handle");

  const [unread, unacked] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("channel", "INAPP").neq("status", "READ"),
    handler ? supabase.from("incidents").select("id", { count: "exact", head: true }).eq("status", "REPORTED") : null,
  ]);

  const group = (title: string, items: (Item | false)[]): NavGroup | null => {
    const list = items.filter((x): x is Item => !!x);
    return list.length ? { title, items: list } : null;
  };
  const canMaster = can(user, "master.read");

  const nav = [
    group("Utama", [{ href: "/dashboard", label: "Dashboard" }]),
    canMaster && group("Master Data", MASTERS.map((m) => ({ href: `/master/${m.slug}`, label: m.label }))),
    group("Inventori Sparepart", [
      can(user, "stock.read") && { href: "/inventory/movements", label: "Mutasi Sparepart" },
      can(user, "stock.read") && { href: "/inventory/balances", label: "Saldo Stok" },
      can(user, "stock.read") && { href: "/inventory/stock-cards", label: "Kartu Stok" },
      can(user, "stock.read") && { href: "/inventory/counts", label: "Stock Opname" },
    ]),
    group("Perawatan", [
      canMaster && { href: "/maintenance/plans", label: "Rencana Perawatan" },
      can(user, "wo.read") && { href: "/maintenance/work-orders", label: "Work Order" },
      can(user, "wo.read") && { href: "/maintenance/calendar", label: "Kalender Jadwal" },
      (can(user, "schedule.request") || can(user, "approval.act") || can(user, "wo.execute")) && { href: "/maintenance/schedule-changes", label: "Perubahan Jadwal" },
    ]),
    group("Emergensi", [
      can(user, "incident.report") && { href: "/emergency/report", label: "Lapor Darurat" },
      can(user, "incident.report") && canMaster && { href: "/emergency/incidents", label: "Insiden", badge: unacked?.count ?? 0 },
      can(user, "incident.report") && { href: "/emergency/contacts", label: "Kontak Darurat" },
      can(user, "incident.report") && { href: "/emergency/playbooks", label: "Langkah Cepat" },
    ]),
    group("Approval", [
      can(user, "approval.act") && { href: "/approvals/inbox", label: "Kotak Masuk" },
      can(user, "approval.viewall") && { href: "/approvals/all", label: "Semua Antrean" },
      (can(user, "approval.act") || can(user, "approval.viewall") || can(user, "stock.create") || can(user, "schedule.request")) && { href: "/approvals/history", label: "Riwayat" },
    ]),
    group("Laporan", [can(user, "report.view") && { href: "/reports", label: "Laporan" }]),
    group("Administrasi", [
      can(user, "admin.user") && { href: "/admin/users", label: "User" },
      can(user, "admin.role") && { href: "/admin/roles", label: "Role & Permission" },
      can(user, "admin.flow") && { href: "/admin/approval-flows", label: "Alur Approval" },
      can(user, "admin.param") && { href: "/admin/parameters", label: "Parameter Sistem" },
      can(user, "audit.view") && { href: "/admin/audit-logs", label: "Audit Log" },
      can(user, "admin.notif") && { href: "/admin/notifications", label: "Log Notifikasi" },
    ]),
  ].filter((g): g is NavGroup => !!g);

  return (
    <AppShell nav={nav} user={{ name: user.name, branchName: user.branchName, roles: user.roles }} unread={unread.count ?? 0} alertCount={unacked?.count ?? 0}>
      {children}
    </AppShell>
  );
}
