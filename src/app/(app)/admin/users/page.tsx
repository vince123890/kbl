import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/list-controls";
import { UserAdminToolbar, UserRowActions, type UserRow } from "@/components/user-admin";
import { CsvImport } from "@/components/csv-import";
import { importUsersAction } from "./actions";

export const metadata = { title: "User" };
const PAGE_SIZE = 50;
const isFuture = (iso: string | null) => !!iso && new Date(iso).getTime() > Date.now();

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requirePermission("admin.user");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = one("q").replace(/[,()%*\\]/g, " ").trim();
  const page = Math.max(1, Number(one("page")) || 1);

  const supabase = await createClient();
  const [{ data: branches }, { data: roles }] = await Promise.all([
    supabase.from("branches").select("id,name").eq("is_active", true).order("name"),
    supabase.from("roles").select("id,name").order("name"),
  ]);

  let query = supabase
    .from("profiles")
    .select("id,name,email,phone,branch_id,is_active,row_version,locked_until,last_login_at,user_roles(role_id,roles(name))", {
      count: "exact",
    });

  const roleFilter = one("role");
  if (roleFilter) {
    const { data: ur } = await supabase.from("user_roles").select("user_id").eq("role_id", roleFilter);
    query = query.in("id", (ur ?? []).map((r) => r.user_id).concat("00000000-0000-0000-0000-000000000000"));
  }
  if (one("branch")) query = query.eq("branch_id", one("branch"));
  const status = one("status");
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (status === "locked") query = query.gt("locked_until", new Date().toISOString());
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("name").range(from, from + PAGE_SIZE - 1);

  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const rows = (data ?? []).map((u) => ({
    ...u,
    locked: isFuture(u.locked_until),
    roleIds: (u.user_roles as unknown as { role_id: string }[]).map((r) => r.role_id),
    roleNames: (u.user_roles as unknown as { roles: { name: string } | null }[]).map((r) => r.roles?.name).filter(Boolean) as string[],
  }));

  const hrefFor = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") next.set(k, v);
    next.set("page", String(p));
    return `/admin/users?${next.toString()}`;
  };

  return (
    <>
      <PageHeader title="User" subtitle={`${count ?? 0} pengguna`} />
      <UserAdminToolbar branches={branches ?? []} roles={roles ?? []} />
      <CsvImport title="Impor user dari CSV (onboarding)" templateHref="/admin/users/template" action={importUsersAction} columns="nama; email; telepon; cabang (kode); role (pisahkan dengan |)" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Cari nama, email, telepon…" />
        <FilterSelect name="branch" label="Cabang" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect name="role" label="Role" options={(roles ?? []).map((r) => ({ value: r.id, label: r.name }))} />
        <FilterSelect
          name="status"
          label="Status"
          options={[
            { value: "active", label: "Aktif" },
            { value: "inactive", label: "Nonaktif" },
            { value: "locked", label: "Terkunci" },
          ]}
        />
      </div>

      {!rows.length ? (
        <EmptyState>Tidak ada pengguna yang cocok.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">Email / Telepon</th>
                <th className="px-3 py-2 font-medium">Cabang</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Login terakhir</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const userRow: UserRow = {
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  phone: u.phone,
                  branch_id: u.branch_id,
                  is_active: u.is_active,
                  row_version: u.row_version,
                  locked: u.locked,
                  roleIds: u.roleIds,
                };
                return (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 align-top font-medium">{u.name}</td>
                    <td className="px-3 py-2 align-top">
                      {u.email}
                      <span className="block text-xs text-muted">{u.phone ?? "-"}</span>
                    </td>
                    <td className="px-3 py-2 align-top">{branchName.get(u.branch_id) ?? "-"}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {u.roleNames.map((r) => (
                          <Badge key={r}>{r}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {!u.is_active ? <Badge>Nonaktif</Badge> : u.locked ? <Badge tone="bad">Terkunci</Badge> : <Badge tone="good">Aktif</Badge>}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Belum pernah"}
                    </td>
                    <td className="px-3 py-2">
                      <UserRowActions user={userRow} branches={branches ?? []} roles={roles ?? []} selfId={me.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefFor} />
    </>
  );
}
