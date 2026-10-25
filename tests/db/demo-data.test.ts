import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, makeUser, type Db } from "./harness";
import { validatePassword } from "../../src/lib/password";
import { DEMO_BRANCHES, DEMO_LOCATIONS, DEMO_PASSWORD, DEMO_PLANS, DEMO_SPAREPARTS, DEMO_STOCK, DEMO_USERS, DEMO_VEHICLES, DEMO_VENDORS } from "../../scripts/demo-data";

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

describe("transaksi demo berjalan lewat fungsi resmi (parameter bernama seperti PostgREST)", () => {
  const users = new Map<string, string>();
  let branch: Record<string, string>;
  let loc: Record<string, { id: string; branch_id: string }>;
  let part: Record<string, string>;
  let veh: Record<string, string>;

  const uid = async (email: string) => {
    if (!users.has(email)) users.set(email, ((await db.query(`select id from profiles where email=$1`, [email])).rows[0] as { id: string }).id);
    return users.get(email)!;
  };
  const call = async <T = unknown>(email: string, sql: string, params: unknown[] = []): Promise<T> => {
    const id = await uid(email);
    return asUser(db, id, async () => (await db.query(sql, params)).rows[0] as T);
  };
  const approveAll = async (docType: string, order: string[]) => {
    for (let pass = 0; pass <= order.length; pass++) {
      const pending = (await db.query(`select id from approval_requests where doc_type=$1 and status='PENDING'`, [docType])).rows as { id: string }[];
      if (!pending.length) return;
      for (const r of pending) {
        for (const e of order) {
          try {
            await call(e, `select public.approval_act(p_request => $1, p_action => 'APPROVE', p_note => 'ok') as r`, [r.id]);
            break;
          } catch {
            /* bukan giliran approver ini */
          }
        }
      }
    }
  };

  it("stok awal: mutasi masuk disetujui lintas level dan diposting; stok kritis terdeteksi", async () => {
    branch = Object.fromEntries(((await db.query(`select id, code from branches`)).rows as { id: string; code: string }[]).map((b) => [b.code, b.id]));
    loc = Object.fromEntries(((await db.query(`select id, code, branch_id from locations`)).rows as { id: string; code: string; branch_id: string }[]).map((l) => [l.code, l]));
    part = Object.fromEntries(((await db.query(`select id, code from spareparts`)).rows as { id: string; code: string }[]).map((p) => [p.code, p.id]));
    veh = Object.fromEntries(((await db.query(`select id, plate_no from vehicles`)).rows as { id: string; plate_no: string }[]).map((v) => [v.plate_no, v.id]));

    for (const b of DEMO_STOCK) {
      for (const l of b.lines) {
        const r = await call<{ id: string }>(
          b.warehouseUser,
          `select public.stock_doc_save(p_id => null, p_type => 'IN', p_branch => $1, p_date => null, p_vehicle => null, p_wo => null, p_from => null, p_to => $2, p_notes => 'Saldo awal', p_lines => $3::jsonb, p_version => null) as id`,
          [branch[b.branch], loc[l.location].id, JSON.stringify(l.items.map((i) => ({ sparepart_id: part[i.code], qty: String(i.qty) })))],
        );
        await call(b.warehouseUser, `select public.stock_doc_submit(p_id => $1)`, [r.id]);
      }
    }
    await approveAll("STOCK", ["supervisor.jkt@example.com", "supervisor.sby@example.com", "depthead.jkt@example.com", "hqadmin@example.com"]);
    const left = (await db.query(`select count(*)::int as c from stock_documents where status <> 'POSTED'`)).rows[0] as { c: number };
    expect(left.c).toBe(0);
    const low = (await db.query(`select count(*)::int as c from rpt_03_posisi_stok where di_bawah_min`)).rows[0] as { c: number };
    expect(low.c).toBeGreaterThan(0);
  });

  it("rencana demo: job membuat WO preventif untuk yang dekat jatuh tempo", async () => {
    for (const p of DEMO_PLANS) {
      const id = await uid(p.supervisor);
      const last = new Date(Date.now() - p.lastDaysAgo * 86_400_000).toISOString().slice(0, 10);
      const branchCode = DEMO_VEHICLES.find((v) => v.plate_no === p.plate)!.branch;
      await asUser(db, id, async () => {
        const plan = (
          await db.query(
            `insert into maintenance_plans (vehicle_id, branch_id, task_name, interval_days, interval_km, last_done_at, last_done_km) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
            [veh[p.plate], branch[branchCode], p.task, p.days, p.km, last, p.lastKm],
          )
        ).rows[0] as { id: string };
        for (const x of p.parts) await db.query(`insert into maintenance_plan_parts (plan_id, sparepart_id, qty) values ($1,$2,$3)`, [plan.id, part[x.code], x.qty]);
      });
    }
    const n = (await db.query(`select public._run_jobs() as r`)).rows[0] as { r: { preventive_wo: number } };
    expect(n.r.preventive_wo).toBeGreaterThanOrEqual(1);
  });

  it("WO korektif, perubahan jadwal, opname, dan insiden demo berjalan", async () => {
    const mech = await uid("mechanic.jkt@example.com");
    const tomorrow = (h: number) => new Date(Date.now() + 86_400_000 + h * 3_600_000).toISOString();
    const sched = await call<{ r: { id: string } }>(
      "supervisor.jkt@example.com",
      `select public.wo_save(p_id => null, p_type => 'CORRECTIVE', p_priority => 'HIGH', p_vehicle => $1, p_start => $2, p_end => $3, p_vendor => null, p_assignee => $4, p_description => 'Rem', p_parts => $5::jsonb, p_source => null, p_version => null) as r`,
      [veh["B 9002 KBL"], tomorrow(2), tomorrow(6), mech, JSON.stringify([{ sparepart_id: part["KMP-RM-BK"], qty: "1", location_id: loc["GU-JKT"].id }])],
    );
    const reason = ((await db.query(`select id from reason_codes where code='PART_UNAVAILABLE'`)).rows[0] as { id: string }).id;
    const sc = await call<{ r: { request_id: string } }>(
      "mechanic.jkt@example.com",
      `select public.schedule_change_request(p_wo => $1, p_new_start => $2, p_new_end => null, p_reason => $3, p_note => 'menunggu part') as r`,
      [sched.r.id, tomorrow(50), reason],
    );
    expect(sc.r.request_id).toBeTruthy();

    const countId = (await call<{ id: string }>("warehouse.jkt@example.com", `select public.count_open(p_location => $1, p_type => 'PERIODIC', p_category => 'Filter', p_notes => null) as id`, [loc["GU-JKT"].id])).id;
    const lines = (await db.query(`select sparepart_id, system_qty from stock_count_lines where count_id=$1`, [countId])).rows as { sparepart_id: string; system_qty: string }[];
    const dmg = ((await db.query(`select id from reason_codes where code='SUDDEN_DAMAGE'`)).rows[0] as { id: string }).id;
    const payload = lines.map((l, i) =>
      i === 0
        ? { sparepart_id: l.sparepart_id, counted_qty: String(Math.max(0, Number(l.system_qty) - 1)), reason_code_id: dmg, reason_note: "Rusak" }
        : { sparepart_id: l.sparepart_id, counted_qty: l.system_qty },
    );
    await call("warehouse.jkt@example.com", `select public.count_enter(p_id => $1, p_lines => $2::jsonb)`, [countId, JSON.stringify(payload)]);
    await call("warehouse.jkt@example.com", `select public.count_submit(p_id => $1)`, [countId]);

    const inc = await call<{ r: { incident: { id: string } } }>(
      "driver.jkt@example.com",
      `select public.incident_report(p_vehicle => $1, p_type => 'BREAKDOWN', p_lat => -6.2, p_lng => 106.8, p_address => 'Tol', p_description => null, p_casualties => null, p_idem => 'demo-incident-1', p_driver => null) as r`,
      [veh["B 9001 KBL"]],
    );
    await call("hqadmin@example.com", `select public.incident_ack(p_id => $1)`, [inc.r.incident.id]);
    const open = (await db.query(`select count(*)::int as c from approval_requests where status='PENDING'`)).rows[0] as { c: number };
    expect(open.c).toBeGreaterThanOrEqual(2); // perubahan jadwal + opname menunggu keputusan
  });

  it("transaksi demo merujuk kode dan nomor polisi yang ada", () => {
    const codes = new Set(DEMO_SPAREPARTS.map((s) => s.code));
    const locs = new Set(DEMO_LOCATIONS.map((l) => l.code));
    const plates = new Set(DEMO_VEHICLES.map((v) => v.plate_no));
    for (const b of DEMO_STOCK) {
      for (const l of b.lines) {
        expect(locs.has(l.location)).toBe(true);
        for (const i of l.items) {
          expect(codes.has(i.code)).toBe(true);
          expect(i.qty).toBeGreaterThan(0);
        }
      }
    }
    for (const p of DEMO_PLANS) {
      expect(plates.has(p.plate)).toBe(true);
      for (const x of p.parts) expect(codes.has(x.code)).toBe(true);
    }
  });
});
