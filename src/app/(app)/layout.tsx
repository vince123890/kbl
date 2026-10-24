import type { ReactNode } from "react";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { can, requireUser } from "@/lib/auth/session";
import { MASTERS } from "@/lib/masters";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  const nav: NavGroup[] = [{ title: "Utama", items: [{ href: "/", label: "Dashboard" }] }];
  if (can(user, "master.read")) {
    nav.push({ title: "Master Data", items: MASTERS.map((m) => ({ href: `/master/${m.slug}`, label: m.label })) });
  }
  const admin: NavGroup["items"] = [];
  if (can(user, "admin.user")) admin.push({ href: "/admin/users", label: "User" });
  if (can(user, "admin.role")) admin.push({ href: "/admin/roles", label: "Role & Permission" });
  if (can(user, "admin.param")) admin.push({ href: "/admin/parameters", label: "Parameter Sistem" });
  if (can(user, "audit.view")) admin.push({ href: "/admin/audit-logs", label: "Audit Log" });
  if (admin.length) nav.push({ title: "Administrasi", items: admin });

  return (
    <AppShell nav={nav} user={{ name: user.name, branchName: user.branchName, roles: user.roles }}>
      {children}
    </AppShell>
  );
}
