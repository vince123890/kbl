import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Stub minimal skema Supabase yang dipakai migrasi: auth.users, auth.uid(), role anon/authenticated/service_role.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

/** Jalankan fungsi sebagai pengguna login (role authenticated + sub JWT). */
export async function asUser<T>(db: Db, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

/** Jalankan sebagai service_role (tanpa sub JWT), seperti server dengan service key. */
export async function asService<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role service_role; select set_config('request.jwt.claim.sub', '', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}

export async function makeUser(
  db: Db,
  opts: { email: string; name: string; branchCode: string; roles: string[] },
): Promise<string> {
  const u = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [opts.email]);
  const id = u.rows[0].id;
  await db.query(
    `insert into public.profiles (id, name, email, branch_id, must_change_password)
     values ($1, $2, $3, (select id from public.branches where code = $4), false)`,
    [id, opts.name, opts.email, opts.branchCode],
  );
  for (const r of opts.roles) {
    await db.query(
      `insert into public.user_roles (user_id, role_id) values ($1, (select id from public.roles where name = $2))`,
      [id, r],
    );
  }
  return id;
}

export async function expectError(p: Promise<unknown>, pattern: RegExp | string) {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  if (!err) throw new Error(`Diharapkan galat ${pattern}, tetapi berhasil`);
  const msg = (err as Error).message;
  if (typeof pattern === "string" ? !msg.includes(pattern) : !pattern.test(msg)) {
    throw new Error(`Galat tidak cocok. Diharapkan ${pattern}, dapat: ${msg}`);
  }
}
