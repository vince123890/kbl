import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profil Saya" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Profil Saya" />
      <div className="max-w-md space-y-6">
        <ProfileForm name={user.name} phone={user.phone ?? ""} />
        <dl className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
          <Row label="Email" value={user.email} />
          <Row label="Cabang" value={user.branchName} />
          <Row label="Role" value={user.roles.join(", ") || "-"} />
        </dl>
        <Link href="/change-password" className="tap inline-flex items-center rounded-lg border border-border px-4 text-sm hover:bg-background">
          Ganti password
        </Link>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
