import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { CreateRoleButton, RoleEditor } from "@/components/role-admin";

export const metadata = { title: "Role & Permission" };

const GROUP_TITLES: Record<string, string> = {
  master: "Master Data",
  stock: "Stok & Mutasi",
  count: "Stock Opname",
  plan: "Perawatan",
  wo: "Work Order",
  schedule: "Jadwal",
  incident: "Emergensi",
  contact: "Emergensi",
  approval: "Approval",
  report: "Laporan",
  admin: "Administrasi",
  audit: "Administrasi",
  branch: "Akses Data",
};

export default async function RolesPage() {
  await requirePermission("admin.role");
  const supabase = await createClient();
  const [{ data: roles }, { data: perms }, { data: rp }, { data: ur }] = await Promise.all([
    supabase.from("roles").select("id,name,description,is_builtin").order("is_builtin", { ascending: false }).order("name"),
    supabase.from("permissions").select("code,description").order("code"),
    supabase.from("role_permissions").select("role_id,permission_code"),
    supabase.from("user_roles").select("role_id"),
  ]);

  const grouped = new Map<string, { code: string; description: string }[]>();
  for (const p of perms ?? []) {
    const title = GROUP_TITLES[p.code.split(".")[0]] ?? "Lainnya";
    grouped.set(title, [...(grouped.get(title) ?? []), p]);
  }
  const groups = [...grouped.entries()].map(([title, list]) => ({ title, perms: list }));

  return (
    <>
      <PageHeader
        title="Role & Permission"
        subtitle="Role hanyalah pengelompokan; yang diperiksa backend adalah permission."
        actions={<CreateRoleButton />}
      />
      <div className="space-y-3">
        {(roles ?? []).map((r) => (
          <RoleEditor
            key={r.id}
            role={r}
            groups={groups}
            granted={(rp ?? []).filter((x) => x.role_id === r.id).map((x) => x.permission_code)}
            userCount={(ur ?? []).filter((x) => x.role_id === r.id).length}
          />
        ))}
      </div>
    </>
  );
}
