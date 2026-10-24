// Membuat SYS_ADMIN pertama. Jalankan sekali setelah migrasi:
//   npm run seed:admin
// Memerlukan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD di .env.local
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { validatePassword } from "../src/lib/password";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME?.trim() || "Admin Sistem";

async function main() {
  if (!url || !key || !email || !password) {
    throw new Error("Isi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD di .env.local");
  }
  const policy = validatePassword(password);
  if (policy) throw new Error(`SEED_ADMIN_PASSWORD: ${policy}`);

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { count } = await db.from("user_roles").select("user_id, roles!inner(name)", { count: "exact", head: true }).eq("roles.name", "SYS_ADMIN");
  if ((count ?? 0) > 0) {
    console.log("SYS_ADMIN sudah ada, tidak ada yang dibuat.");
    return;
  }

  const { data: hq, error: hqErr } = await db.from("branches").select("id").eq("is_hq", true).single();
  if (hqErr || !hq) throw new Error("Cabang pusat tidak ditemukan. Jalankan migrasi terlebih dahulu.");
  const { data: role, error: roleErr } = await db.from("roles").select("id").eq("name", "SYS_ADMIN").single();
  if (roleErr || !role) throw new Error("Role SYS_ADMIN tidak ditemukan. Jalankan migrasi terlebih dahulu.");

  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Gagal membuat akun auth");
  const id = created.data.user.id;

  const rollback = async (msg: string) => {
    await db.auth.admin.deleteUser(id);
    throw new Error(msg);
  };
  const { error: pErr } = await db.from("profiles").insert({ id, name, email, branch_id: hq.id, must_change_password: true });
  if (pErr) await rollback(pErr.message);
  const { error: rErr } = await db.from("user_roles").insert({ user_id: id, role_id: role.id });
  if (rErr) {
    await db.from("profiles").delete().eq("id", id);
    await rollback(rErr.message);
  }
  console.log(`SYS_ADMIN dibuat: ${email}. Pengguna wajib mengganti password saat login pertama.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
