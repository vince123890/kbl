import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk" };

const NOTICES: Record<string, string> = {
  expired: "Sesi Anda telah berakhir, silakan masuk kembali.",
  "invalid-link": "Link tidak berlaku. Minta link reset password yang baru.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;
  return <LoginForm notice={reason ? NOTICES[reason] : undefined} />;
}
