import { beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, createDb, expectError, makeUser, type Db } from "./harness";

let db: Db;
let sysadmin: string;
let hq: string;
let mechA: string;
let mechB: string;
let whA: string;
let branchA: string;
let branchB: string;
let sysadmin2: string;

beforeAll(async () => {
  db = await createDb();
  await db.exec(`insert into public.branches (code, name) values ('JKT', 'Jakarta'), ('SBY', 'Surabaya')`);
  branchA = (await db.query<{ id: string }>(`select id from public.branches where code='JKT'`)).rows[0].id;
  branchB = (await db.query<{ id: string }>(`select id from public.branches where code='SBY'`)).rows[0].id;
  sysadmin = await makeUser(db, { email: "sa@x.id", name: "SA", branchCode: "HQ", roles: ["SYS_ADMIN"] });
  hq = await makeUser(db, { email: "hq@x.id", name: "HQ", branchCode: "HQ", roles: ["HQ_ADMIN"] });
  mechA = await makeUser(db, { email: "ma@x.id", name: "Mek A", branchCode: "JKT", roles: ["MECHANIC"] });
  mechB = await makeUser(db, { email: "mb@x.id", name: "Mek B", branchCode: "SBY", roles: ["MECHANIC"] });
  whA = await makeUser(db, { email: "wa@x.id", name: "Gudang A", branchCode: "JKT", roles: ["WAREHOUSE"] });
  sysadmin2 = await makeUser(db, { email: "sa2@x.id", name: "SA2", branchCode: "HQ", roles: ["SYS_ADMIN"] });
}, 120_000);

const sql = (q: string, p: unknown[] = []) => db.query(q, p);

describe("master data: akses", () => {
  it("MECHANIC dapat membaca tetapi tidak menulis sparepart (403 setara)", async () => {
    await asService(db, () => sql(`insert into spareparts (code,name,category,uom) values ('OLI-001','Oli','Pelumas','liter')`));
    const rows = await asUser(db, mechA, () => sql(`select code from spareparts`));
    expect(rows.rows).toHaveLength(1);
    await expectError(
      asUser(db, whA, () => sql(`insert into spareparts (code,name,category,uom) values ('X','x','x','pcs')`)),
      /row-level security/,
    );
  });

  it("SYS_ADMIN dapat menulis; kode duplikat ditolak", async () => {
    await asUser(db, sysadmin, () => sql(`insert into spareparts (code,name,category,uom) values ('FIL-001','Filter','Filter','pcs')`));
    await expectError(
      asUser(db, sysadmin, () => sql(`insert into spareparts (code,name,category,uom) values ('FIL-001','Dup','Filter','pcs')`)),
      /duplicate key|unique/,
    );
  });

  it("tidak ada hak DELETE pada master", async () => {
    await expectError(asUser(db, sysadmin, () => sql(`delete from spareparts`)), /permission denied/);
    await expectError(asUser(db, sysadmin, () => sql(`delete from vehicles`)), /permission denied/);
  });

  it("stok minimum negatif ditolak", async () => {
    await expectError(
      asUser(db, sysadmin, () => sql(`insert into spareparts (code,name,category,uom,min_stock) values ('NEG','n','c','pcs',-1)`)),
      /check/,
    );
  });
});

describe("isolasi cabang", () => {
  beforeAll(async () => {
    await asUser(db, sysadmin, async () => {
      await sql(`insert into vehicles (plate_no,type,branch_id) values ('B 1111 AA','Truk',$1)`, [branchA]);
      await sql(`insert into vehicles (plate_no,type,branch_id) values ('L 2222 BB','Truk',$1)`, [branchB]);
    });
  });

  it("pengguna cabang A hanya melihat kendaraan cabang A", async () => {
    const r = await asUser(db, mechA, () => sql(`select plate_no from vehicles`));
    expect(r.rows.map((x: any) => x.plate_no)).toEqual(["B 1111 AA"]);
  });

  it("HQ_ADMIN melihat semua cabang", async () => {
    const r = await asUser(db, hq, () => sql(`select plate_no from vehicles order by plate_no`));
    expect(r.rows).toHaveLength(2);
  });

  it("detail cabang lain tidak terlihat", async () => {
    const r = await asUser(db, mechA, () => sql(`select * from vehicles where plate_no='L 2222 BB'`));
    expect(r.rows).toHaveLength(0);
  });

  it("nomor polisi dinormalisasi: spasi dan huruf besar/kecil dianggap sama", async () => {
    await expectError(
      asUser(db, sysadmin, () => sql(`insert into vehicles (plate_no,type,branch_id) values ('b1111aa','Truk',$1)`, [branchA])),
      /unique|duplicate/,
    );
  });
});

describe("kendaraan & odometer", () => {
  it("odometer naik dicatat; turun ditolak dengan nilai lama", async () => {
    const id = (await sql(`select id from vehicles where plate_no='B 1111 AA'`)).rows[0] as { id: string };
    await asUser(db, sysadmin, () => sql(`update vehicles set odometer=10000 where id=$1`, [id.id]));
    await asUser(db, sysadmin, () => sql(`update vehicles set odometer=10250 where id=$1`, [id.id]));
    const logs = await sql(`select old_value::float as o, new_value::float as n from vehicle_odometer_logs where vehicle_id=$1 order by id`, [id.id]);
    expect(logs.rows).toEqual([{ o: 0, n: 10000 }, { o: 10000, n: 10250 }]);
    await expectError(
      asUser(db, sysadmin, () => sql(`update vehicles set odometer=9900 where id=$1`, [id.id])),
      /Odometer tidak boleh lebih kecil dari 10250/,
    );
  });

  it("status Dalam Perawatan tidak bisa dipilih manual", async () => {
    await expectError(
      asUser(db, sysadmin, () => sql(`update vehicles set status='IN_MAINTENANCE' where plate_no='B 1111 AA'`)),
      /diatur otomatis/,
    );
    await asUser(db, sysadmin, () => sql(`update vehicles set status='OUT_OF_SERVICE' where plate_no='B 1111 AA'`));
  });
});

describe("cabang", () => {
  it("hanya satu cabang pusat", async () => {
    await expectError(asUser(db, sysadmin, () => sql(`update branches set is_hq=true where code='JKT'`)), /unique|duplicate/);
  });
  it("cabang pusat tidak bisa dinonaktifkan", async () => {
    await expectError(asUser(db, sysadmin, () => sql(`update branches set is_active=false where code='HQ'`)), /branches_hq_active|check/);
  });
  it("kode cabang terkunci setelah dipakai", async () => {
    await expectError(
      asUser(db, sysadmin, () => sql(`update branches set code='JKT2' where code='JKT'`)),
      /tidak dapat diubah/,
    );
  });
});

describe("vendor", () => {
  it("tipe tidak dikenal ditolak", async () => {
    await expectError(asUser(db, sysadmin, () => sql(`insert into vendors (name,type,phone) values ('V','LAINNYA','1')`)), /check/);
  });
  it("telepon wajib", async () => {
    await expectError(asUser(db, sysadmin, () => sql(`insert into vendors (name,type) values ('V','DEREK')`)), /not-null|null value/);
  });
});

describe("parameter sistem", () => {
  it("nilai awal sesuai asumsi", async () => {
    const r = await sql(`select key, value from system_parameters where key in ('maintenance.lead_days','maintenance.lead_km','incident.ack_minutes','incident.validation_hours')`);
    const m = Object.fromEntries((r.rows as any[]).map((x) => [x.key, x.value]));
    expect(m).toEqual({
      "maintenance.lead_days": "7",
      "maintenance.lead_km": "500",
      "incident.ack_minutes": "5",
      "incident.validation_hours": "24",
    });
  });
  it("nilai tidak valid ditolak", async () => {
    await expectError(asUser(db, sysadmin, () => sql(`update system_parameters set value='-3' where key='maintenance.lead_days'`)), /minimal 0/);
    await expectError(asUser(db, sysadmin, () => sql(`update system_parameters set value='abc' where key='maintenance.lead_days'`)), /bilangan bulat/);
  });
  it("hanya admin.param yang boleh mengubah", async () => {
    const r = await asUser(db, hq, () => sql(`update system_parameters set value='10' where key='maintenance.lead_days' returning key`));
    expect(r.rows).toHaveLength(0); // RLS menyaring: tidak ada baris yang boleh diubah
  });
  it("perubahan tercatat di audit dengan sebelum/sesudah", async () => {
    await asUser(db, sysadmin, () => sql(`update system_parameters set value='9' where key='maintenance.lead_days'`));
    const r = await sql(`select before->>'value' as b, after->>'value' as a, user_id from audit_logs where entity='system_parameters' and entity_id='maintenance.lead_days' order by id desc limit 1`);
    expect(r.rows[0]).toMatchObject({ b: "7", a: "9", user_id: sysadmin });
  });
});

describe("kategori alasan", () => {
  it("data awal lengkap, hanya Lainnya wajib keterangan", async () => {
    const r = await sql(`select name, require_note from reason_codes order by name`);
    expect(r.rows).toHaveLength(7);
    expect((r.rows as any[]).filter((x) => x.require_note).map((x) => x.name)).toEqual(["Lainnya"]);
  });
});

describe("role & user", () => {
  it("7 role bawaan tersedia", async () => {
    const r = await sql(`select name from roles where is_builtin order by name`);
    expect((r.rows as any[]).map((x) => x.name)).toEqual(
      ["DEPT_HEAD", "DRIVER", "HQ_ADMIN", "MECHANIC", "SUPERVISOR", "SYS_ADMIN", "WAREHOUSE"],
    );
  });
  it("role bawaan tidak dapat dihapus", async () => {
    await expectError(asUser(db, sysadmin, () => sql(`delete from roles where name='DRIVER'`)), /bawaan tidak dapat dihapus/);
  });
  it("role kustom terpakai tidak dapat dihapus; yang bebas bisa", async () => {
    await asUser(db, sysadmin, () => sql(`insert into roles (name) values ('AUDITOR')`));
    await asUser(db, sysadmin, () =>
      sql(`insert into user_roles (user_id, role_id) values ($1, (select id from roles where name='AUDITOR'))`, [whA]),
    );
    await expectError(asUser(db, sysadmin, () => sql(`delete from roles where name='AUDITOR'`)), /masih dipakai 1 user/);
    await asUser(db, sysadmin, () => sql(`delete from user_roles where user_id=$1 and role_id=(select id from roles where name='AUDITOR')`, [whA]));
    await asUser(db, sysadmin, () => sql(`delete from roles where name='AUDITOR'`));
  });
  it("hanya admin.role yang boleh mengubah permission", async () => {
    await expectError(
      asUser(db, hq, () => sql(`insert into role_permissions values ((select id from roles where name='DRIVER'),'report.view')`)),
      /row-level security/,
    );
  });
  it("SYS_ADMIN wajib mempertahankan permission pengelolaan", async () => {
    await expectError(
      asUser(db, sysadmin, () => sql(`delete from role_permissions where permission_code='admin.user' and role_id=(select id from roles where name='SYS_ADMIN')`)),
      /harus tetap memiliki/,
    );
  });
  it("SYS_ADMIN terakhir tidak bisa dinonaktifkan; yang bukan terakhir bisa", async () => {
    await asUser(db, sysadmin, () => sql(`update profiles set is_active=false where id=$1`, [sysadmin2]));
    await expectError(
      asUser(db, sysadmin, () => sql(`update profiles set is_active=false where id=$1`, [sysadmin])),
      /Minimal satu SYS_ADMIN aktif/,
    );
    await asUser(db, sysadmin, () => sql(`update profiles set is_active=true where id=$1`, [sysadmin2]));
  });
  it("pengguna biasa hanya dapat mengubah nama dan telepon sendiri", async () => {
    await asUser(db, mechA, () => sql(`update profiles set phone='0812' where id=$1`, [mechA]));
    await expectError(
      asUser(db, mechA, () => sql(`update profiles set branch_id=$1 where id=$2`, [branchB, mechA])),
      /Hanya nama dan telepon/,
    );
    const other = await asUser(db, mechA, () => sql(`update profiles set phone='1' where id=$1 returning id`, [mechB]));
    expect(other.rows).toHaveLength(0);
  });
  it("email profil unik tanpa membedakan huruf besar/kecil", async () => {
    const u = await sql(`insert into auth.users (email) values ('dup@x.id') returning id`);
    await expectError(
      sql(`insert into profiles (id,name,email,branch_id) values ($1,'D','MA@X.ID',$2)`, [(u.rows[0] as any).id, branchA]),
      /unique|duplicate/,
    );
  });
});

describe("audit log", () => {
  it("perubahan master tercatat dengan sebelum dan sesudah", async () => {
    await asUser(db, sysadmin, () => sql(`update spareparts set min_stock=5 where code='OLI-001'`));
    await asUser(db, sysadmin, () => sql(`update spareparts set min_stock=8 where code='OLI-001'`));
    const r = await sql(`select action, before->>'min_stock' as b, after->>'min_stock' as a, user_id from audit_logs where entity='spareparts' and after->>'code'='OLI-001' order by id desc limit 1`);
    expect(r.rows[0]).toMatchObject({ action: "UPDATE", b: "5.000", a: "8.000", user_id: sysadmin });
  });
  it("nonaktif dicatat sebagai DEACTIVATE", async () => {
    await asUser(db, sysadmin, () => sql(`update spareparts set is_active=false where code='FIL-001'`));
    const r = await sql(`select action from audit_logs where entity='spareparts' and after->>'code'='FIL-001' order by id desc limit 1`);
    expect((r.rows[0] as any).action).toBe("DEACTIVATE");
  });
  it("penghitung gagal login tidak membanjiri audit", async () => {
    const before = (await sql(`select count(*)::int as c from audit_logs where entity='profiles'`)).rows[0] as any;
    await asService(db, () => sql(`update profiles set failed_attempts=3, locked_until=now() where id=$1`, [mechB]));
    const after = (await sql(`select count(*)::int as c from audit_logs where entity='profiles'`)).rows[0] as any;
    expect(after.c).toBe(before.c);
  });
  it("tidak dapat diubah/dihapus walau oleh service_role atau pemilik tabel", async () => {
    await expectError(asService(db, () => sql(`update audit_logs set action='X'`)), /permission denied/);
    await expectError(asService(db, () => sql(`delete from audit_logs`)), /permission denied/);
    await expectError(sql(`update audit_logs set action='X'`), /append-only/);
    await expectError(sql(`delete from audit_logs`), /append-only/);
    await expectError(sql(`truncate audit_logs`), /append-only/);
  });
  it("hanya audit.view yang dapat membaca", async () => {
    expect((await asUser(db, hq, () => sql(`select 1 from audit_logs limit 1`))).rows.length).toBe(1);
    expect((await asUser(db, mechA, () => sql(`select 1 from audit_logs limit 1`))).rows.length).toBe(0);
  });
  it("event keamanan hanya bisa ditulis service_role", async () => {
    await expectError(
      asUser(db, mechA, () => sql(`select log_security_event($1,'LOGIN_SUCCESS')`, [mechA])),
      /permission denied/,
    );
    await asService(db, () => sql(`select log_security_event($1,'LOGIN_SUCCESS','{"x":1}'::jsonb,'1.2.3.4')`, [mechA]));
    const r = await sql(`select action, ip from audit_logs where entity='security' order by id desc limit 1`);
    expect(r.rows[0]).toMatchObject({ action: "LOGIN_SUCCESS", ip: "1.2.3.4" });
  });
  it("perubahan ikut dibatalkan bila penulisan audit gagal (atomik)", async () => {
    await sql(`create function boom() returns trigger language plpgsql as $$ begin raise exception 'audit gagal'; end $$`);
    await sql(`create trigger zz_boom before insert on audit_logs for each row execute function boom()`);
    await expectError(
      asUser(db, sysadmin, () => sql(`update spareparts set min_stock=99 where code='OLI-001'`)),
      /audit gagal/,
    );
    await sql(`drop trigger zz_boom on audit_logs`);
    const r = await sql(`select min_stock::int as m from spareparts where code='OLI-001'`);
    expect((r.rows[0] as any).m).toBe(8);
  });
});

describe("konkurensi (row_version)", () => {
  it("versi bertambah setiap update", async () => {
    const a = (await sql(`select row_version from vendors limit 0`)).rows;
    expect(a).toEqual([]);
    await asUser(db, sysadmin, () => sql(`insert into vendors (name,type,phone) values ('Derek A','DEREK','0811')`));
    await asUser(db, sysadmin, () => sql(`update vendors set pic='Budi' where name='Derek A'`));
    const r = (await sql(`select row_version from vendors where name='Derek A'`)).rows[0] as any;
    expect(r.row_version).toBe(2);
  });
});
