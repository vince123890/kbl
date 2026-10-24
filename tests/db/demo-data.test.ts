import { beforeAll, describe, expect, it } from "vitest";
import { createDb, makeUser, type Db } from "./harness";
import { validatePassword } from "../../src/lib/password";
import { DEMO_BRANCHES, DEMO_LOCATIONS, DEMO_PASSWORD, DEMO_SPAREPARTS, DEMO_USERS, DEMO_VEHICLES, DEMO_VENDORS } from "../../scripts/demo-data";

let db: Db;

async function insert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  await db.query(
    `insert into public.${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
    cols.map((c) => row[c]),
  );
}

beforeAll(async () => {
  db = await createDb();
}, 120_000);

describe("data demo valid terhadap skema", () => {
  it("password demo memenuhi kebijakan", () => {
    expect(validatePassword(DEMO_PASSWORD)).toBeNull();
  });

  it("setiap role bawaan dipakai minimal satu user demo", async () => {
    const roles = ((await db.query(`select name from roles where is_builtin`)).rows as { name: string }[]).map((r) => r.name);
    const used = new Set(DEMO_USERS.flatMap((u) => u.roles));
    expect(roles.filter((r) => !used.has(r))).toEqual([]);
    expect([...used].filter((r) => !roles.includes(r))).toEqual([]);
  });

  it("email unik dan kode cabang user dikenal", () => {
    const emails = DEMO_USERS.map((u) => u.email.toLowerCase());
    expect(new Set(emails).size).toBe(emails.length);
    const known = new Set(["HQ", ...DEMO_BRANCHES.map((b) => b.code)]);
    for (const u of DEMO_USERS) expect(known.has(u.branch)).toBe(true);
  });

  it("master dapat disisipkan seluruhnya tanpa melanggar constraint", async () => {
    for (const b of DEMO_BRANCHES) await insert("branches", b);
    const branch = Object.fromEntries(
      ((await db.query(`select id, code from branches`)).rows as { id: string; code: string }[]).map((r) => [r.code, r.id]),
    );
    for (const l of DEMO_LOCATIONS) await insert("locations", { branch_id: branch[l.branch], code: l.code, name: l.name });
    for (const s of DEMO_SPAREPARTS) await insert("spareparts", s);
    for (const v of DEMO_VENDORS) await insert("vendors", v);

    const ids: Record<string, string> = {};
    for (const u of DEMO_USERS) {
      ids[u.email] = await makeUser(db, { email: u.email, name: u.name, branchCode: u.branch, roles: u.roles });
    }
    for (const v of DEMO_VEHICLES) {
      await insert("vehicles", {
        plate_no: v.plate_no,
        type: v.type,
        model: v.model,
        year: v.year,
        branch_id: branch[v.branch],
        odometer: v.odometer,
        status: (v as { status?: string }).status ?? "ACTIVE",
        main_driver_id: v.driver ? ids[v.driver] : null,
      });
    }

    const count = async (t: string) => ((await db.query(`select count(*)::int as c from ${t}`)).rows[0] as { c: number }).c;
    expect(await count("branches")).toBe(1 + DEMO_BRANCHES.length);
    expect(await count("locations")).toBe(DEMO_LOCATIONS.length);
    expect(await count("spareparts")).toBe(DEMO_SPAREPARTS.length);
    expect(await count("vendors")).toBe(DEMO_VENDORS.length);
    expect(await count("vehicles")).toBe(DEMO_VEHICLES.length);
    expect(await count("profiles")).toBe(DEMO_USERS.length);
  });

  it("nomor polisi dan kode sparepart demo unik", () => {
    const plates = DEMO_VEHICLES.map((v) => v.plate_no.replace(/\s/g, "").toUpperCase());
    expect(new Set(plates).size).toBe(plates.length);
    const codes = DEMO_SPAREPARTS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("pengemudi utama menunjuk user ber-role DRIVER", async () => {
    const r = await db.query(`
      select v.plate_no, r.name as role
      from vehicles v
      join user_roles ur on ur.user_id = v.main_driver_id
      join roles r on r.id = ur.role_id
      where v.main_driver_id is not null`);
    expect((r.rows as { role: string }[]).every((x) => x.role === "DRIVER")).toBe(true);
    expect(r.rows.length).toBe(DEMO_VEHICLES.filter((v) => v.driver).length);
  });
});
