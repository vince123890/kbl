import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Ganti Password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });
  return <ChangePasswordForm forced={user.mustChangePassword} />;
}
