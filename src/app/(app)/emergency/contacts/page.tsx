import { can, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/lookups";
import { Badge, DataTable, EmptyState, PageHeader, TD } from "@/components/ui";
import { FilterSelect } from "@/components/list-controls";
import { ActionButton } from "@/components/action-button";
import { ContactDialog, type ContactRow } from "@/components/contact-dialog";
import { toggleContactAction } from "../actions";

export const metadata = { title: "Kontak Darurat" };

export default async function ContactsPage({ searchParams }: PageProps<"/emergency/contacts">) {
  const user = await requireUser();
  const manage = can(user, "contact.manage");
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("emergency_contacts").select("*,branches(name)").order("priority").order("name");
  if (one(sp, "scope")) query = query.eq("scope", one(sp, "scope"));
  if (one(sp, "role")) query = query.ilike("role_label", `%${one(sp, "role")}%`);
  if (one(sp, "status") === "inactive") query = query.eq("is_active", false);
  else if (one(sp, "status") !== "all") query = query.eq("is_active", true);
  const [{ data }, { data: branches }] = await Promise.all([query, supabase.from("branches").select("id,name").order("name")]);
  const rows = (data ?? []) as unknown as (ContactRow & { is_active: boolean; branches: { name: string } | null })[];

  return (
    <>
      <PageHeader
        title="Kontak Darurat"
        subtitle="Kontak Global selalu tampil di setiap layar langkah cepat pengemudi."
        actions={manage ? <ContactDialog branches={branches ?? []} /> : undefined}
      />
      <div className="filter-bar">
        <FilterSelect
          name="scope"
          label="Cakupan"
          options={[
            { value: "GLOBAL", label: "Global" },
            { value: "BRANCH", label: "Cabang" },
            { value: "REGION", label: "Wilayah" },
          ]}
        />
        {manage && (
          <FilterSelect
            name="status"
            label="Status"
            allLabel="Aktif"
            options={[
              { value: "inactive", label: "Nonaktif" },
              { value: "all", label: "Semua" },
            ]}
          />
        )}
      </div>
      {!rows.length ? (
        <EmptyState>Belum ada kontak darurat.</EmptyState>
      ) : (
        <DataTable head={["Urutan", "Peran", "Nama", "Telepon", "Cakupan", "Jam layanan", "Status", ""]}>
          {rows.map((c) => (
            <tr key={c.id}>
              <td className={TD}>{c.priority}</td>
              <td className={TD}>{c.role_label}</td>
              <td className={TD}>
                {c.name}
                {c.notes && <span className="block text-xs text-muted">{c.notes}</span>}
              </td>
              <td className={TD}>
                <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                  {c.phone}
                </a>
              </td>
              <td className={TD}>{c.scope === "GLOBAL" ? "Global" : c.scope === "BRANCH" ? `Cabang ${c.branches?.name ?? ""}` : `Wilayah ${c.region}`}</td>
              <td className={TD}>{c.service_hours ?? <span className="text-muted">-</span>}</td>
              <td className={TD}>{c.is_active ? <Badge tone="good">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
              <td className={TD}>
                {manage && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <ContactDialog contact={c} branches={branches ?? []} compact />
                    <ActionButton
                      label={c.is_active ? "Nonaktifkan" : "Aktifkan"}
                      tone={c.is_active ? "danger" : "ghost"}
                      confirm={c.is_active ? "Nonaktifkan kontak ini? Kontak Global terakhir tidak dapat dinonaktifkan." : undefined}
                      action={toggleContactAction.bind(null, c.id, !c.is_active)}
                    />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <p className="mt-3 text-xs text-muted">Uji panggilan: ketuk nomor telepon di atas dari ponsel untuk memastikan nomor tersambung.</p>
    </>
  );
}
