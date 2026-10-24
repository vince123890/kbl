// Seeder demo: user untuk SEMUA role + data master, sekali jalan, aman dijalankan berulang (idempoten).
//   npm run seed:demo -- --yes
// Hanya untuk development/staging. Memerlukan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local.
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_BRANCHES, DEMO_LOCATIONS, DEMO_PASSWORD, DEMO_SPAREPARTS, DEMO_USERS, DEMO_VEHICLES, DEMO_VENDORS } from "./demo-data";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Db = SupabaseClient;
const must = <T>(r: { data: T | null; error: { message: string } | null }, ctx: string): T => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data as T;
};

/** Menyisipkan hanya baris yang belum ada (berdasarkan kunci alami). Mengembalikan jumlah baris baru. */
async function insertMissing(
  db: Db,
  table: string,
  rows: Record<string, unknown>[],
  keyOf: (row: Record<string, unknown>) => string,
): Promise<number> {
  const existing = must(await db.from(table).select("*"), `baca ${table}`) as Record<string, unknown>[];
  const have = new Set(existing.map(keyOf));
  const fresh = rows.filter((r) => !have.has(keyOf(r)));
  if (fresh.length) must(await db.from(table).insert(fresh), `isi ${table}`);
  return fresh.length;
}

async function findAuthUserId(db: Db, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  if (!url || !key) throw new Error("Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local");
  if (process.env.NODE_ENV === "production") throw new Error("Seeder demo tidak boleh dijalankan dengan NODE_ENV=production");
  if (!process.argv.includes("--yes")) {
    console.log(`Seeder ini membuat ${DEMO_USERS.length} user demo (password ${DEMO_PASSWORD}) dan data master contoh di:\n  ${new URL(url).host}\n`);
    console.log("Jangan jalankan di database produksi. Ulangi dengan --yes untuk melanjutkan:\n  npm run seed:demo -- --yes");
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  console.log(`Target: ${new URL(url).host}\n`);

  // ---- cabang
  const b = await insertMissing(db, "branches", DEMO_BRANCHES, (r) => String(r.code));
  console.log(`Cabang       : +${b}`);
  const branches = must(await db.from("branches").select("id,code"), "baca cabang") as { id: string; code: string }[];
  const branchId = new Map(branches.map((x) => [x.code, x.id]));
  const bid = (code: string) => {
    const id = branchId.get(code);
    if (!id) throw new Error(`Cabang ${code} tidak ditemukan (migrasi sudah dijalankan?)`);
    return id;
  };

  // ---- master
  const l = await insertMissing(
    db,
    "locations",
    DEMO_LOCATIONS.map((x) => ({ branch_id: bid(x.branch), code: x.code, name: x.name })),
    (r) => `${r.branch_id}:${r.code}`,
  );
  console.log(`Lokasi       : +${l}`);

  const s = await insertMissing(db, "spareparts", DEMO_SPAREPARTS, (r) => String(r.code));
  console.log(`Sparepart    : +${s}`);

  const v = await insertMissing(db, "vendors", DEMO_VENDORS, (r) => `${r.name}|${r.type}`);
  console.log(`Vendor       : +${v}`);

  // ---- user (semua role)
  const roles = must(await db.from("roles").select("id,name"), "baca role") as { id: string; name: string }[];
  const roleId = new Map(roles.map((r) => [r.name, r.id]));
  const userIds = new Map<string, string>();
  let createdUsers = 0;

  for (const u of DEMO_USERS) {
    const email = u.email.toLowerCase();
    const { data: prof } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    let id: string | null = prof?.id ?? null;

    if (!id) {
      const created = await db.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
      if (created.error) {
        // akun auth sudah ada tetapi profil belum (sisa eksekusi yang terputus)
        id = await findAuthUserId(db, email);
        if (!id) throw new Error(`${email}: ${created.error.message}`);
        await db.auth.admin.updateUserById(id, { password: DEMO_PASSWORD });
      } else {
        id = created.data.user.id;
      }
      must(
        await db.from("profiles").insert({
          id,
          name: u.name,
          email,
          phone: u.phone,
          branch_id: bid(u.branch),
          must_change_password: false,
          is_active: u.active !== false,
        }),
        `profil ${email}`,
      );
      must(
        await db.from("user_roles").insert(
          u.roles.map((r) => {
            const rid = roleId.get(r);
            if (!rid) throw new Error(`Role ${r} tidak ditemukan`);
            return { user_id: id, role_id: rid };
          }),
        ),
        `role ${email}`,
      );
      if (u.active === false) await db.auth.admin.updateUserById(id, { ban_duration: "876000h" });
      createdUsers++;
    }
    userIds.set(email, id);
  }
  console.log(`User         : +${createdUsers} (total demo ${DEMO_USERS.length})`);

  // ---- kendaraan (setelah user, karena ada pengemudi utama)
  const vehicles = await insertMissing(
    db,
    "vehicles",
    DEMO_VEHICLES.map((x) => ({
      plate_no: x.plate_no,
      type: x.type,
      model: x.model,
      year: x.year,
      branch_id: bid(x.branch),
      odometer: x.odometer,
      status: x.status ?? "ACTIVE",
      main_driver_id: x.driver ? (userIds.get(x.driver) ?? null) : null,
    })),
    (r) => String(r.plate_no).replace(/\s/g, "").toUpperCase(),
  );
  console.log(`Kendaraan    : +${vehicles}`);

  console.log(`\nSelesai. Password semua user demo: ${DEMO_PASSWORD}\n`);
  console.table(DEMO_USERS.map((u) => ({ email: u.email, role: u.roles.join("+"), cabang: u.branch, catatan: u.note })));
}

main().catch((e) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  console.error("Aman dijalankan ulang: baris yang sudah ada dilewati.");
  process.exit(1);
});
