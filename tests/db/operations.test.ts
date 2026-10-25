import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, expectError, makeUser, type Db } from "./harness";

let db: Db;
const U: Record<string, string> = {};
const ID: Record<string, string> = {};

async function q(user: string, text: string, params: unknown[] = []) {
  return asUser(db, user, () => db.query(text, params));
}
async function one<T = Record<string, unknown>>(user: string, text: string, params: unknown[] = []): Promise<T> {
  return (await q(user, text, params)).rows[0] as T;
}
async function admin<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query(text, params)).rows as T[];
}
const iso = (days: number, hour = 8) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** Membuat dokumen mutasi lalu mengajukannya. Mengembalikan id dokumen dan hasil ajukan. */
async function makeDoc(
  user: string,
  type: string,
  lines: { sparepart_id: string; qty: string }[],
  opts: { from?: string | null; to?: string | null; vehicle?: string | null; wo?: string | null; branch?: string } = {},
) {
  const r = await one<{ id: string }>(
    user,
    `select public.stock_doc_save(null, $1, $2, current_date, $3, $4, $5, $6, null, $7::jsonb) as id`,
    [type, opts.branch ?? ID.JKT, opts.vehicle ?? null, opts.wo ?? null, opts.from ?? null, opts.to ?? null, JSON.stringify(lines)],
  );
  return r.id;
}
async function submit(user: string, id: string) {
  return (await one<{ r: { status: string; request_id: string } }>(user, `select public.stock_doc_submit($1) as r`, [id])).r;
}
async function act(user: string, req: string, action: string, note: string | null = null) {
  return (await one<{ r: { ok: boolean; status?: string; error?: string } }>(user, `select public.approval_act($1, $2, $3) as r`, [req, action, note])).r;
}
async function balance(sp: string, loc: string) {
  const r = await admin<{ qty_on_hand: string; qty_reserved: string }>(
    `select qty_on_hand, qty_reserved from stock_balances where sparepart_id=$1 and location_id=$2`, [sp, loc]);
  return r[0] ? { onhand: Number(r[0].qty_on_hand), reserved: Number(r[0].qty_reserved) } : { onhand: 0, reserved: 0 };
}
/** Stok awal lewat jalur resmi: mutasi masuk, disetujui supervisor. */
async function stockIn(sp: string, loc: string, qty: string, branch = ID.JKT) {
  const id = await makeDoc(U.wh, "IN", [{ sparepart_id: sp, qty }], { to: loc, branch });
  const s = await submit(U.wh, id);
  await act(U.spv, s.request_id, "APPROVE");
  return id;
}

beforeAll(async () => {
  db = await createDb();
  for (const [code, name] of [["JKT", "Jakarta"], ["SBY", "Surabaya"]]) {
    await db.query(`insert into branches (code, name) values ($1, $2)`, [code, name]);
  }
  const br = await admin<{ id: string; code: string }>(`select id, code from branches`);
  for (const b of br) ID[b.code] = b.id;

  const users: [string, string, string, string[]][] = [
    ["wh", "wh@x.com", "JKT", ["WAREHOUSE"]],
    ["spv", "spv@x.com", "JKT", ["SUPERVISOR"]],
    ["dept", "dept@x.com", "JKT", ["DEPT_HEAD"]],
    ["hq", "hq@x.com", "HQ", ["HQ_ADMIN"]],
    ["mech", "mech@x.com", "JKT", ["MECHANIC"]],
    ["mech2", "mech2@x.com", "JKT", ["MECHANIC"]],
    ["driver", "driver@x.com", "JKT", ["DRIVER"]],
    ["driver2", "driver2@x.com", "JKT", ["DRIVER"]],
    ["spvS", "spvs@x.com", "SBY", ["SUPERVISOR"]],
    ["whSpv", "whspv@x.com", "JKT", ["WAREHOUSE", "SUPERVISOR"]],
    ["sys", "sys@x.com", "HQ", ["SYS_ADMIN"]],
  ];
  for (const [key, email, branch, roles] of users) U[key] = await makeUser(db, { email, name: key.toUpperCase(), branchCode: branch, roles });

  await db.query(`insert into locations (branch_id, code, name) values ($1,'GU','Gudang JKT'), ($1,'WS','Workshop JKT'), ($2,'GU','Gudang SBY')`, [ID.JKT, ID.SBY]);
  const locs = await admin<{ id: string; name: string }>(`select id, name from locations`);
  for (const l of locs) ID[l.name] = l.id;
  await db.query(`insert into spareparts (code, name, category, uom, min_stock) values
    ('OLI','Oli Mesin','Pelumas','liter',10), ('FLT','Filter Oli','Filter','pcs',5), ('AKI','Aki 12V','Listrik','pcs',0)`);
  for (const s of await admin<{ id: string; code: string }>(`select id, code from spareparts`)) ID[s.code] = s.id;

  await db.query(`insert into vehicles (plate_no, type, branch_id, odometer, main_driver_id) values
    ('B 1 JKT','Truk',$1,1000,$2), ('B 2 JKT','Truk',$1,5000,null), ('L 1 SBY','Truk',$3,200,null)`, [ID.JKT, U.driver, ID.SBY]);
  for (const v of await admin<{ id: string; plate_no: string }>(`select id, plate_no from vehicles`)) ID[v.plate_no] = v.id;
  await db.query(`insert into emergency_contacts (scope, role_label, name, phone, priority) values ('GLOBAL','Derek','Derek Cepat','0812-3456',2)`);
}, 120_000);

describe("mutasi sparepart dan approval", () => {
  it("mutasi masuk: draft → ajukan → disetujui supervisor → posting menambah saldo dan ledger", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.OLI, qty: "30" }, { sparepart_id: ID.FLT, qty: "10" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.wh, id);
    expect(s.status).toBe("SUBMITTED");
    expect(await balance(ID.OLI, ID["Gudang JKT"])).toEqual({ onhand: 0, reserved: 0 });

    const r = await act(U.spv, s.request_id, "APPROVE");
    expect(r).toMatchObject({ ok: true, status: "APPROVED" });
    expect((await balance(ID.OLI, ID["Gudang JKT"])).onhand).toBe(30);
    const doc = await admin<{ status: string }>(`select status from stock_documents where id=$1`, [id]);
    expect(doc[0].status).toBe("POSTED");
    const mv = await admin<{ balance_after: string }>(`select balance_after from stock_movements where document_id=$1 order by id`, [id]);
    expect(mv.map((m) => Number(m.balance_after)).sort()).toEqual([10, 30]);
  });

  it("nomor dokumen berformat PREFIX-CABANG-YYYYMM-urut", async () => {
    const r = await admin<{ doc_no: string }>(`select doc_no from stock_documents order by created_at limit 1`);
    expect(r[0].doc_no).toMatch(/^MSK-JKT-\d{6}-0001$/);
  });

  it("qty melebihi stok ditolak dengan angka dan lokasi, saldo tidak berubah", async () => {
    const id = await makeDoc(U.wh, "OUT", [{ sparepart_id: ID.OLI, qty: "99" }], { from: ID["Gudang JKT"], vehicle: ID["B 1 JKT"] });
    await expectError(submit(U.wh, id), "Oli Mesin: diminta 99, tersedia 30 di Gudang JKT");
    expect((await balance(ID.OLI, ID["Gudang JKT"])).onhand).toBe(30);
  });

  it("mutasi keluar wajib kendaraan atau WO", async () => {
    const id = await makeDoc(U.wh, "OUT", [{ sparepart_id: ID.OLI, qty: "1" }], { from: ID["Gudang JKT"] });
    await expectError(submit(U.wh, id), "kendaraan atau Work Order");
  });

  it("satuan pcs harus bilangan bulat, liter boleh desimal", async () => {
    await expectError(makeDoc(U.wh, "IN", [{ sparepart_id: ID.FLT, qty: "1.5" }], { to: ID["Gudang JKT"] }), "bilangan bulat");
    const ok = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.OLI, qty: "1.5" }], { to: ID["Gudang JKT"] });
    expect(ok).toBeTruthy();
  });

  it("pengaju tidak boleh menyetujui dokumennya sendiri walau memegang dua role", async () => {
    const id = await makeDoc(U.whSpv, "IN", [{ sparepart_id: ID.AKI, qty: "5" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.whSpv, id);
    await expectError(act(U.whSpv, s.request_id, "APPROVE"), "tidak dapat memutuskan dokumen yang Anda ajukan sendiri");
    await act(U.spv, s.request_id, "REJECT", "Salah input");
  });

  it("dokumen yang sudah diajukan atau diposting tidak dapat diubah atau dihapus", async () => {
    const posted = (await admin<{ id: string }>(`select id from stock_documents where status='POSTED' limit 1`))[0].id;
    await expectError(db.query(`update stock_documents set notes='x' where id=$1`, [posted]), "sudah diajukan");
    await expectError(db.query(`delete from stock_documents where id=$1`, [posted]), "tidak dapat dihapus");
    await expectError(db.query(`update stock_document_lines set qty=1 where document_id=$1`, [posted]), "berstatus Draft");
    await expectError(db.query(`update stock_movements set qty_delta=1`), "append-only");
    await expectError(q(U.wh, `update stock_balances set qty_on_hand=999`), /permission denied|row-level/);
  });

  it("penolakan wajib catatan; revisi mengembalikan ke draft; keputusan kedua ditolak", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "2" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.wh, id);
    await expectError(act(U.spv, s.request_id, "REJECT"), "Catatan wajib");
    await act(U.spv, s.request_id, "REVISE", "Qty salah");
    expect((await admin<{ status: string }>(`select status from stock_documents where id=$1`, [id]))[0].status).toBe("DRAFT");
    await expectError(act(U.spv, s.request_id, "APPROVE"), "sudah diputuskan oleh SPV");
    const log = await admin<{ action: string }>(`select action from approval_actions where request_id=$1 order by id`, [s.request_id]);
    expect(log.map((l) => l.action)).toEqual(["SUBMIT", "REVISE"]);
    await expectError(db.query(`delete from approval_actions`), "append-only");
  });

  it("qty besar membutuhkan level kedua (Kepala Dept) dan role yang tepat", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "60" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.wh, id);
    const steps = await admin<{ steps: { role: string }[] }>(`select steps from approval_requests where id=$1`, [s.request_id]);
    expect(steps[0].steps.map((x) => x.role)).toEqual(["SUPERVISOR", "DEPT_HEAD"]);
    await expectError(act(U.dept, s.request_id, "APPROVE"), "menunggu persetujuan SUPERVISOR");
    expect(await act(U.spv, s.request_id, "APPROVE")).toMatchObject({ status: "PENDING" });
    await expectError(act(U.spv, s.request_id, "APPROVE"), "menunggu persetujuan DEPT_HEAD");
    expect(await act(U.dept, s.request_id, "APPROVE")).toMatchObject({ status: "APPROVED" });
    expect((await balance(ID.AKI, ID["Gudang JKT"])).onhand).toBe(60);
  });

  it("override HQ butuh catatan dan melompati level", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "55" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.wh, id);
    await expectError(one(U.hq, `select public.approval_override($1, '')`, [s.request_id]), "Catatan wajib");
    await expectError(one(U.spv, `select public.approval_override($1, 'x')`, [s.request_id]), "tidak berwenang");
    await one(U.hq, `select public.approval_override($1, 'Mendesak')`, [s.request_id]);
    const log = await admin<{ action: string }>(`select action from approval_actions where request_id=$1 order by id`, [s.request_id]);
    expect(log.map((l) => l.action)).toEqual(["SUBMIT", "OVERRIDE"]);
    expect((await balance(ID.AKI, ID["Gudang JKT"])).onhand).toBe(115);
  });

  it("pembalik: membuat dokumen baru, melalui approval, mengembalikan saldo; tidak bisa dibalik dua kali", async () => {
    const orig = await stockIn(ID.FLT, ID["Gudang JKT"], "4");
    const before = (await balance(ID.FLT, ID["Gudang JKT"])).onhand;
    const rev = (await one<{ id: string }>(U.wh, `select public.stock_doc_reverse($1) as id`, [orig])).id;
    const s = await submit(U.wh, rev);
    await act(U.spv, s.request_id, "APPROVE");
    expect((await balance(ID.FLT, ID["Gudang JKT"])).onhand).toBe(before - 4);
    await expectError(one(U.wh, `select public.stock_doc_reverse($1)`, [orig]), "sudah memiliki dokumen pembalik");
  });

  it("transfer memindahkan stok antar lokasi dengan dua baris ledger", async () => {
    const id = await makeDoc(U.wh, "TRANSFER", [{ sparepart_id: ID.OLI, qty: "10" }], { from: ID["Gudang JKT"], to: ID["Workshop JKT"] });
    const s = await submit(U.wh, id);
    await act(U.spv, s.request_id, "APPROVE");
    expect((await balance(ID.OLI, ID["Workshop JKT"])).onhand).toBe(10);
    const mv = await admin(`select 1 from stock_movements where document_id=$1`, [id]);
    expect(mv.length).toBe(2);
    await expectError(makeDoc(U.wh, "TRANSFER", [{ sparepart_id: ID.OLI, qty: "1" }], { from: ID["Gudang JKT"], to: ID["Gudang JKT"] }).then((d) => submit(U.wh, d)), "tidak boleh sama");
  });

  it("batal draft/diajukan perlu alasan dan membatalkan approval yang berjalan", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.wh, id);
    await expectError(one(U.wh, `select public.stock_doc_cancel($1, '')`, [id]), "Alasan pembatalan wajib");
    await one(U.wh, `select public.stock_doc_cancel($1, 'Salah gudang')`, [id]);
    const req = await admin<{ status: string }>(`select status from approval_requests where id=$1`, [s.request_id]);
    expect(req[0].status).toBe("CANCELLED");
    await expectError(one(U.mech, `select public.stock_doc_cancel($1, 'x')`, [id]), "tidak berwenang");
  });

  it("isolasi cabang: supervisor Surabaya tidak melihat atau memutuskan dokumen Jakarta", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.wh, id);
    expect((await q(U.spvS, `select 1 from stock_documents where id=$1`, [id])).rows.length).toBe(0);
    expect((await q(U.spvS, `select 1 from approval_requests where id=$1`, [s.request_id])).rows.length).toBe(0);
    await expectError(act(U.spvS, s.request_id, "APPROVE"), "cabang lain");
    expect((await q(U.hq, `select 1 from stock_documents where id=$1`, [id])).rows.length).toBe(1);
    await expectError(makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang SBY"], branch: ID.SBY }), "bukan cabang Anda");
    await act(U.spv, s.request_id, "REJECT", "bersih-bersih");
  });

  it("fungsi tidak dapat dipanggil tanpa login (anon)", async () => {
    await db.exec(`set role anon`);
    try {
      await expectError(db.query(`select public.stock_doc_submit(gen_random_uuid())`), /permission denied/);
      await expectError(db.query(`select public._approval_submit('STOCK', gen_random_uuid(), 'x', 'x', gen_random_uuid(), '{}')`), /permission denied/);
    } finally {
      await db.exec(`reset role`);
    }
    await expectError(q(U.wh, `select public._approval_submit('STOCK', gen_random_uuid(), 'x', 'x', gen_random_uuid(), '{}')`), /permission denied/);
  });

  it("stok di bawah minimum membuat notifikasi ke gudang", async () => {
    await db.query(`update spareparts set min_stock = 15 where id=$1`, [ID.OLI]);
    const id = await makeDoc(U.wh, "OUT", [{ sparepart_id: ID.OLI, qty: "20" }], { from: ID["Gudang JKT"], vehicle: ID["B 2 JKT"] });
    const s = await submit(U.wh, id);
    await act(U.spv, s.request_id, "APPROVE");
    await db.query(`update spareparts set min_stock = 10 where id=$1`, [ID.OLI]);
    const n = await admin(`select 1 from notifications where user_id=$1 and kind='stock' and title='Stok di bawah minimum'`, [U.wh]);
    expect(n.length).toBeGreaterThan(0);
  });

  it("approver mendapat notifikasi dalam aplikasi dan dapat menandainya terbaca", async () => {
    const n = (await q(U.spv, `select id from notifications where user_id=$1 and channel='INAPP' and status<>'READ'`, [U.spv])).rows;
    expect(n.length).toBeGreaterThan(0);
    const r = await one<{ c: number }>(U.spv, `select public.notification_mark_read(null) as c`);
    expect(r.c).toBeGreaterThan(0);
    expect((await q(U.wh, `select 1 from notifications where user_id=$1`, [U.spv])).rows.length).toBe(0);
  });
});

describe("alur approval dapat dikonfigurasi", () => {
  it("hanya admin.flow; metrik dan role divalidasi; versi baru menggantikan versi lama", async () => {
    const steps = JSON.stringify([{ role: "SUPERVISOR", sla_hours: 8 }]);
    await expectError(one(U.spv, `select public.approval_flow_save('STOCK','x',$1::jsonb)`, [steps]), "tidak berwenang");
    await expectError(one(U.sys, `select public.approval_flow_save('STOCK','x',$1::jsonb)`, [JSON.stringify([{ role: "DRIVER" }])]), "tidak memiliki permission approval.act");
    await expectError(one(U.sys, `select public.approval_flow_save('STOCK','x',$1::jsonb)`, [JSON.stringify([{ role: "SUPERVISOR", metric: "abs_diff_total", op: ">", value: 1 }])]), "tidak berlaku");
    await one(U.sys, `select public.approval_flow_save('STOCK','Mutasi v2',$1::jsonb)`, [steps]);
    const act1 = await admin<{ version: number }>(`select version from approval_flows where doc_type='STOCK' and is_active`);
    expect(act1.length).toBe(1);
    expect(act1[0].version).toBe(2);
    // qty besar kini cukup satu level
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "70" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.wh, id);
    expect(await act(U.spv, s.request_id, "APPROVE")).toMatchObject({ status: "APPROVED" });
    // alur tanpa level = otomatis disetujui
    await one(U.sys, `select public.approval_flow_save('STOCK','Tanpa approval','[]'::jsonb)`);
    const id2 = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang JKT"] });
    expect((await submit(U.wh, id2)).status).toBe("POSTED");
    // pulihkan alur awal
    await one(U.sys, `select public.approval_flow_save('STOCK','Mutasi sparepart',$1::jsonb)`, [JSON.stringify([
      { role: "SUPERVISOR", sla_hours: 24 }, { role: "DEPT_HEAD", sla_hours: 24, metric: "total_qty", op: ">", value: 50 }])]);
  });
});

describe("stock opname", () => {
  let count: string;
  it("sesi opname mengambil snapshot, satu sesi berjalan per lokasi", async () => {
    count = (await one<{ id: string }>(U.wh, `select public.count_open($1,'PERIODIC',null,null) as id`, [ID["Gudang JKT"]])).id;
    const lines = await admin<{ system_qty: string }>(`select system_qty from stock_count_lines where count_id=$1`, [count]);
    expect(lines.length).toBeGreaterThan(0);
    await expectError(one(U.wh, `select public.count_open($1,'AD_HOC',null,null)`, [ID["Gudang JKT"]]), "masih memiliki sesi opname");
  });

  it("selama opname (mode freeze) mutasi di lokasi itu ditahan", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang JKT"] });
    await expectError(submit(U.wh, id), "sedang diopname");
  });

  it("selisih tanpa alasan atau item belum dihitung tidak dapat diajukan", async () => {
    await expectError(one(U.wh, `select public.count_submit($1)`, [count]), /Penghitungan|belum dihitung/);
    const lines = await admin<{ sparepart_id: string; system_qty: string }>(`select sparepart_id, system_qty from stock_count_lines where count_id=$1`, [count]);
    const payload = lines.map((l) => ({ sparepart_id: l.sparepart_id, counted_qty: l.sparepart_id === ID.OLI ? String(Number(l.system_qty) + 2) : l.system_qty }));
    await one(U.wh, `select public.count_enter($1,$2::jsonb)`, [count, JSON.stringify(payload)]);
    await expectError(one(U.wh, `select public.count_submit($1)`, [count]), /berselisih .* alasan wajib/);
  });

  it("disetujui → mutasi Penyesuaian terposting dan saldo = hasil hitung", async () => {
    const reason = (await admin<{ id: string }>(`select id from reason_codes where code='SUDDEN_DAMAGE'`))[0].id;
    const oli = (await admin<{ system_qty: string }>(`select system_qty from stock_count_lines where count_id=$1 and sparepart_id=$2`, [count, ID.OLI]))[0];
    await one(U.wh, `select public.count_enter($1,$2::jsonb)`, [count, JSON.stringify([
      { sparepart_id: ID.OLI, counted_qty: String(Number(oli.system_qty) + 2), reason_code_id: reason }])]);
    const s = (await one<{ r: { request_id: string; status: string } }>(U.wh, `select public.count_submit($1) as r`, [count])).r;
    expect(s.status).toBe("REVIEW");
    await expectError(act(U.wh, s.request_id, "APPROVE"), /tidak berwenang/);
    const before = (await balance(ID.OLI, ID["Gudang JKT"])).onhand;
    expect(await act(U.spv, s.request_id, "APPROVE")).toMatchObject({ status: "APPROVED" });
    expect((await balance(ID.OLI, ID["Gudang JKT"])).onhand).toBe(before + 2);
    const c = await admin<{ status: string; adjustment_doc_id: string }>(`select status, adjustment_doc_id from stock_counts where id=$1`, [count]);
    expect(c[0].status).toBe("ADJUSTED");
    expect(c[0].adjustment_doc_id).toBeTruthy();
    // freeze selesai: mutasi boleh lagi
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang JKT"] });
    expect((await submit(U.wh, id)).status).toBe("SUBMITTED");
  });

  it("opname yang ditolak kembali ke penghitungan; batal butuh alasan", async () => {
    const c2 = (await one<{ id: string }>(U.wh, `select public.count_open($1,'AD_HOC',null,null) as id`, [ID["Workshop JKT"]])).id;
    const lines = await admin<{ sparepart_id: string; system_qty: string }>(`select sparepart_id, system_qty from stock_count_lines where count_id=$1`, [c2]);
    await one(U.wh, `select public.count_enter($1,$2::jsonb)`, [c2, JSON.stringify(lines.map((l) => ({ sparepart_id: l.sparepart_id, counted_qty: l.system_qty })))]);
    const s = (await one<{ r: { request_id: string } }>(U.wh, `select public.count_submit($1) as r`, [c2])).r;
    await act(U.spv, s.request_id, "REJECT", "Hitung ulang");
    expect((await admin<{ status: string }>(`select status from stock_counts where id=$1`, [c2]))[0].status).toBe("COUNTING");
    await expectError(one(U.wh, `select public.count_cancel($1,'')`, [c2]), "Alasan pembatalan wajib");
    await one(U.wh, `select public.count_cancel($1,'Salah lokasi')`, [c2]);
    await expectError(db.query(`delete from stock_counts where id=$1`, [c2]), "tidak dapat dihapus");
  });
});

describe("work order, jadwal, dan reservasi", () => {
  let plan: string;
  let wo1: string;

  it("mekanik hanya boleh mutasi Keluar untuk WO yang ditugaskan kepadanya", async () => {
    await expectError(makeDoc(U.mech, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang JKT"] }), "hanya dapat membuat mutasi Keluar");
    await expectError(makeDoc(U.mech, "OUT", [{ sparepart_id: ID.AKI, qty: "1" }], { from: ID["Gudang JKT"], vehicle: ID["B 1 JKT"] }), "Work Order yang ditugaskan kepada Anda");
  });

  it("WO dibuat supervisor; teknisi harus berhak; bentrok kendaraan diblokir", async () => {
    const parts = JSON.stringify([{ sparepart_id: ID.OLI, qty: "5", location_id: ID["Gudang JKT"] }]);
    const r = await one<{ r: { id: string } }>(U.spv, `select public.wo_save(null,'CORRECTIVE','HIGH',$1,$2,$3,null,$4,'Ganti oli',$5::jsonb) as r`,
      [ID["B 1 JKT"], iso(3, 1), iso(3, 5), U.mech, parts]);
    wo1 = r.r.id;
    const w = (await admin<{ status: string; wo_no: string }>(`select status, wo_no from work_orders where id=$1`, [wo1]))[0];
    expect(w.status).toBe("SCHEDULED");
    expect(w.wo_no).toMatch(/^WO-JKT-\d{6}-0001$/);
    await expectError(one(U.spv, `select public.wo_save(null,'CORRECTIVE','NORMAL',$1,$2,$3,null,$4,'x','[]'::jsonb)`, [ID["B 1 JKT"], iso(3, 3), iso(3, 6), U.mech2]), /Kendaraan B 1 JKT sudah dijadwalkan/);
    await expectError(one(U.spv, `select public.wo_save(null,'CORRECTIVE','NORMAL',$1,$2,$3,null,$4,'x','[]'::jsonb)`, [ID["B 2 JKT"], iso(3, 3), iso(3, 6), U.mech]), /Teknisi MECH sudah bertugas/);
    await expectError(one(U.spv, `select public.wo_save(null,'CORRECTIVE','NORMAL',$1,null,null,null,$2,'x','[]'::jsonb)`, [ID["B 2 JKT"], U.driver]), "tidak dapat menjalankan Work Order");
    await expectError(one(U.mech, `select public.wo_save(null,'CORRECTIVE','NORMAL',$1,null,null,null,null,'x','[]'::jsonb)`, [ID["B 2 JKT"]]), "tidak berwenang");
  });

  it("reservasi part mengurangi stok tersedia dan dilepas saat WO dibatalkan", async () => {
    expect((await balance(ID.OLI, ID["Gudang JKT"])).reserved).toBe(5);
    const id = await makeDoc(U.wh, "OUT", [{ sparepart_id: ID.OLI, qty: "999" }], { from: ID["Gudang JKT"], vehicle: ID["B 2 JKT"] });
    await expectError(submit(U.wh, id), /diminta 999/);
    const parts = JSON.stringify([{ sparepart_id: ID.OLI, qty: "1", location_id: ID["Gudang JKT"] }]);
    const tmp = (await one<{ r: { id: string } }>(U.spv, `select public.wo_save(null,'CORRECTIVE','LOW',$1,null,null,null,null,'tmp',$2::jsonb) as r`, [ID["B 2 JKT"], parts])).r.id;
    expect((await balance(ID.OLI, ID["Gudang JKT"])).reserved).toBe(6);
    await expectError(one(U.spv, `select public.wo_cancel($1,'')`, [tmp]), "Alasan pembatalan wajib");
    await one(U.spv, `select public.wo_cancel($1,'Tidak jadi')`, [tmp]);
    expect((await balance(ID.OLI, ID["Gudang JKT"])).reserved).toBe(5);
  });

  it("mekanik memakai part lewat mutasi Keluar untuk WO-nya; pemakaian tercatat dan reservasi berkurang", async () => {
    await stockIn(ID.OLI, ID["Gudang JKT"], "20");
    const id = await makeDoc(U.mech, "OUT", [{ sparepart_id: ID.OLI, qty: "5" }], { from: ID["Gudang JKT"], wo: wo1 });
    const s = await submit(U.mech, id);
    await act(U.spv, s.request_id, "APPROVE");
    const p = (await admin<{ qty_used: string; qty_reserved_applied: string }>(`select qty_used, qty_reserved_applied from wo_parts where work_order_id=$1`, [wo1]))[0];
    expect(Number(p.qty_used)).toBe(5);
    expect(Number(p.qty_reserved_applied)).toBe(0);
    expect((await balance(ID.OLI, ID["Gudang JKT"])).reserved).toBe(0);
    await expectError(one(U.spv, `select public.wo_cancel($1,'x')`, [wo1]), "Mutasi Retur");
  });

  it("mulai → selesai: status kendaraan, odometer, dan rencana ikut diperbarui", async () => {
    await expectError(one(U.mech2, `select public.wo_start($1)`, [wo1]), "ditugaskan kepada teknisi lain");
    await one(U.mech, `select public.wo_start($1)`, [wo1]);
    expect((await admin<{ status: string }>(`select status from vehicles where id=$1`, [ID["B 1 JKT"]]))[0].status).toBe("IN_MAINTENANCE");
    await expectError(one(U.mech, `select public.wo_complete($1, 500, 'x')`, [wo1]), "tidak boleh lebih kecil");
    await one(U.mech, `select public.wo_complete($1, 1250, 'Selesai')`, [wo1]);
    const v = (await admin<{ status: string; odometer: string }>(`select status, odometer from vehicles where id=$1`, [ID["B 1 JKT"]]))[0];
    expect(v).toMatchObject({ status: "ACTIVE" });
    expect(Number(v.odometer)).toBe(1250);
    await expectError(one(U.spv, `select public.wo_cancel($1,'x')`, [wo1]), "tidak dapat dibatalkan");
    await expectError(db.query(`delete from work_orders where id=$1`, [wo1]), "tidak dapat dihapus");
  });

  it("rencana perawatan: jatuh tempo dihitung; job membuat WO preventif sekali saja", async () => {
    const r = await one<{ id: string }>(U.spv, `insert into maintenance_plans (vehicle_id, branch_id, task_name, interval_days, interval_km, last_done_at, last_done_km)
      values ($1, $2, 'Servis berkala', 90, 5000, current_date - 85, 100) returning id`, [ID["B 2 JKT"], ID.JKT]);
    plan = r.id;
    await db.query(`insert into maintenance_plan_parts (plan_id, sparepart_id, qty) values ($1,$2,2)`, [plan, ID.OLI]);
    const p = (await admin<{ next_due_at: string; next_due_km: string; branch_id: string }>(`select next_due_at::text, next_due_km, branch_id from maintenance_plans where id=$1`, [plan]))[0];
    expect(Number(p.next_due_km)).toBe(5100);
    expect(p.branch_id).toBe(ID.JKT);
    await expectError(db.query(`insert into maintenance_plans (vehicle_id, branch_id, task_name) values ($1,$2,'x')`, [ID["B 2 JKT"], ID.JKT]), /maintenance_plans_interval/);
    const n1 = (await admin<{ n: number }>(`select public._wo_generate_preventive() as n`))[0].n;
    const n2 = (await admin<{ n: number }>(`select public._wo_generate_preventive() as n`))[0].n;
    expect(n1).toBe(1);
    expect(n2).toBe(0);
    const w = (await admin<{ type: string; status: string; auto_generated: boolean }>(`select type, status, auto_generated from work_orders where plan_id=$1`, [plan]))[0];
    expect(w).toMatchObject({ type: "PREVENTIVE", status: "PLANNED", auto_generated: true });
    expect((await admin(`select 1 from wo_parts where work_order_id=(select id from work_orders where plan_id=$1)`, [plan])).length).toBe(1);
    await expectError(db.query(`insert into work_orders (wo_no, branch_id, vehicle_id, type, plan_id) values ('X',$1,$2,'PREVENTIVE',$3)`, [ID.JKT, ID["B 2 JKT"], plan]), /one_active_per_plan/);
  });

  it("job overdue menandai WO terlambat dan melepasnya bila sudah diselesaikan", async () => {
    await db.query(`update work_orders set due_at = now() - interval '2 days' where plan_id=$1`, [plan]);
    expect((await admin<{ n: number }>(`select public._wo_mark_overdue() as n`))[0].n).toBe(1);
    const w = (await admin<{ is_overdue: boolean }>(`select is_overdue from work_orders where plan_id=$1`, [plan]))[0];
    expect(w.is_overdue).toBe(true);
    const rep = await q(U.spv, `select hari_terlambat from rpt_06_overdue`);
    expect(Number((rep.rows[0] as { hari_terlambat: number }).hari_terlambat)).toBeGreaterThanOrEqual(1);
  });

  describe("perubahan jadwal (anomali)", () => {
    let wo: string;
    let reason: string;
    beforeAll(async () => {
      reason = (await admin<{ id: string }>(`select id from reason_codes where code='PART_UNAVAILABLE'`))[0].id;
      wo = (await one<{ r: { id: string } }>(U.spv, `select public.wo_save(null,'CORRECTIVE','NORMAL',$1,$2,$3,null,$4,'Rem','[]'::jsonb) as r`,
        [ID["L 1 SBY"] === undefined ? ID["B 2 JKT"] : ID["B 2 JKT"], iso(10, 1), iso(10, 4), U.mech2])).r.id;
    });

    it("tanpa alasan atau jadwal sama ditolak; alasan 'Lainnya' wajib keterangan", async () => {
      await expectError(one(U.mech2, `select public.schedule_change_request($1,$2,null,null,null)`, [wo, iso(11, 1)]), "Kategori alasan wajib");
      await expectError(one(U.mech2, `select public.schedule_change_request($1,$2,null,$3,null)`, [wo, iso(10, 1), reason]), "harus berbeda");
      const other = (await admin<{ id: string }>(`select id from reason_codes where code='OTHER'`))[0].id;
      await expectError(one(U.mech2, `select public.schedule_change_request($1,$2,null,$3,'')`, [wo, iso(11, 1), other]), "wajib disertai keterangan");
    });

    it("Supervisor tidak mengajukan (hanya memutuskan); teknisi lain dan pengemudi juga ditolak", async () => {
      await expectError(one(U.spv, `select public.schedule_change_request($1,$2,null,$3,null)`, [wo, iso(11, 1), reason]), "tidak berwenang");
      await expectError(one(U.driver, `select public.schedule_change_request($1,$2,null,$3,null)`, [wo, iso(11, 1), reason]), "tidak berwenang");
      await expectError(one(U.mech, `select public.schedule_change_request($1,$2,null,$3,null)`, [wo, iso(11, 1), reason]), /teknisi yang ditugaskan|cabang lain/);
    });

    it("penundaan > 7 hari butuh tiga level dan baru berlaku setelah disetujui", async () => {
      const r = (await one<{ r: { id: string; request_id: string; notice: string } }>(U.mech2,
        `select public.schedule_change_request($1,$2,null,$3,'Part indent') as r`, [wo, iso(20, 1), reason])).r;
      expect(r.notice).toMatch(/melebihi 7 hari; akan dieskalasi ke Admin Pusat/);
      expect((await admin<{ scheduled_start: string }>(`select scheduled_start from work_orders where id=$1`, [wo]))[0].scheduled_start).toBeTruthy();
      const steps = (await admin<{ steps: { role: string }[] }>(`select steps from approval_requests where id=$1`, [r.request_id]))[0].steps;
      expect(steps.map((s) => s.role)).toEqual(["SUPERVISOR", "DEPT_HEAD", "HQ_ADMIN"]);
      await expectError(one(U.mech2, `select public.schedule_change_request($1,$2,null,$3,null)`, [wo, iso(21, 1), reason]), /masih memiliki pengajuan/);
      await act(U.spv, r.request_id, "APPROVE"); // pengajuan tidak lagi macet di Supervisor
      await act(U.dept, r.request_id, "APPROVE");
      expect(await act(U.hq, r.request_id, "APPROVE")).toMatchObject({ status: "APPROVED" });
      const w = (await admin<{ scheduled_start: string; schedule_changed: boolean; original_start: string }>(`select scheduled_start, original_start, schedule_changed from work_orders where id=$1`, [wo]))[0];
      expect(w.schedule_changed).toBe(true);
      expect(new Date(w.scheduled_start).toISOString()).toBe(iso(20, 1));
      expect(new Date(w.original_start).toISOString()).toBe(iso(10, 1));
      const rep = await q(U.hq, `select tipe, selisih_hari from rpt_07_anomali`);
      expect(rep.rows[0]).toMatchObject({ tipe: "Penundaan" });
    });

    it("pengaju dapat menarik kembali; WO yang berubah jadwal langsung diblokir lewat edit biasa", async () => {
      const r = (await one<{ r: { id: string } }>(U.mech2, `select public.schedule_change_request($1,$2,null,$3,null) as r`, [wo, iso(19, 1), reason])).r;
      await expectError(one(U.hq, `select public.schedule_change_withdraw($1)`, [r.id]), "Hanya pengaju");
      await one(U.mech2, `select public.schedule_change_withdraw($1)`, [r.id]);
      expect((await admin<{ status: string }>(`select status from schedule_changes where id=$1`, [r.id]))[0].status).toBe("WITHDRAWN");
      await expectError(one(U.spv, `select public.wo_save($1,null,'NORMAL',null,$2,$3,null,$4,'x','[]'::jsonb)`, [wo, iso(1, 1), iso(1, 4), U.mech2]), "Ajukan Perubahan Jadwal");
      await expectError(db.query(`delete from schedule_changes where id=$1`, [r.id]), "tidak boleh dihapus");
    });

    it("WO emergensi boleh bentrok (peringatan) dan menandai WO lain; validasi pasca-kejadian lewat approval", async () => {
      const r = (await one<{ r: { id: string; warnings: string[] } }>(U.spv,
        `select public.wo_save(null,'EMERGENCY','LOW',$1,$2,$3,null,$4,'Mogok','[]'::jsonb) as r`, [ID["B 2 JKT"], iso(20, 2), iso(20, 6), U.mech])).r;
      expect(r.warnings.length).toBeGreaterThan(0);
      const em = (await admin<{ priority: string; emergency_validation: string }>(`select priority, emergency_validation from work_orders where id=$1`, [r.id]))[0];
      expect(em).toMatchObject({ priority: "URGENT", emergency_validation: "PENDING" });
      expect((await admin<{ needs_reschedule: boolean }>(`select needs_reschedule from work_orders where id=$1`, [wo]))[0].needs_reschedule).toBe(true);
      const req = (await admin<{ id: string }>(`select id from approval_requests where doc_id=$1`, [r.id]))[0].id;
      await act(U.dept, req, "APPROVE");
      expect((await admin<{ emergency_validation: string }>(`select emergency_validation from work_orders where id=$1`, [r.id]))[0].emergency_validation).toBe("VALIDATED");
    });
  });
});

describe("emergensi", () => {
  let inc: string;
  const idem = "11111111-1111-1111-1111-111111111111";

  it("pengemudi melapor: respon memuat langkah cepat dan kontak; kirim ulang tidak membuat insiden ganda", async () => {
    const call = () => one<{ r: { incident: { id: string; incident_no: string }; playbook: { steps: string[] }; contacts: { phone: string }[] } }>(
      U.driver, `select public.incident_report($1,'BREAKDOWN',-6.2,106.8,'Tol Cikampek',null,0,$2) as r`, [ID["B 1 JKT"], idem]);
    const a = (await call()).r;
    const b = (await call()).r;
    expect(a.incident.id).toBe(b.incident.id);
    inc = a.incident.id;
    expect(a.incident.incident_no).toMatch(/^INC-JKT-\d{6}-0001$/);
    expect(a.playbook.steps.length).toBeGreaterThan(2);
    expect(a.contacts.map((c) => c.phone)).toContain("(061) 80044515");
    expect((await admin(`select 1 from incidents`)).length).toBe(1);
  });

  it("pengemudi hanya boleh melapor untuk kendaraannya; gagal validasi jenis", async () => {
    await expectError(one(U.driver, `select public.incident_report($1,'BREAKDOWN',null,null,null,null,null,null)`, [ID["B 2 JKT"]]), "kendaraan yang ditugaskan kepada Anda");
    await expectError(one(U.driver, `select public.incident_report($1,'BOM',null,null,null,null,null,null)`, [ID["B 1 JKT"]]), "Jenis kejadian tidak valid");
    await expectError(one(U.sys, `select public.incident_report($1,'FIRE',null,null,null,null,null,null)`, [ID["B 1 JKT"]]), "tidak berwenang");
  });

  it("supervisor dan Admin Pusat mendapat notifikasi; pengemudi lain tidak melihat insiden ini", async () => {
    expect((await admin(`select 1 from notifications where user_id=$1 and kind='incident'`, [U.spv])).length).toBeGreaterThan(0);
    expect((await admin(`select 1 from notifications where user_id=$1 and kind='incident' and channel='WHATSAPP'`, [U.hq])).length).toBeGreaterThan(0);
    expect((await q(U.driver, `select 1 from incidents`)).rows.length).toBe(1);
    expect((await q(U.driver2, `select 1 from incidents`)).rows.length).toBe(0);
    expect((await q(U.mech, `select 1 from incidents`)).rows.length).toBe(1);
    expect((await q(U.spvS, `select 1 from incidents`)).rows.length).toBe(0);
    expect((await q(U.sys, `select 1 from incidents`)).rows.length).toBe(0);
  });

  it("insiden tanpa ACK dieskalasi otomatis sesuai batas menit", async () => {
    expect((await admin<{ n: number }>(`select public._incident_escalate() as n`))[0].n).toBe(0);
    await db.query(`update incidents set reported_at = now() - interval '6 minutes' where id=$1`, [inc]);
    expect((await admin<{ n: number }>(`select public._incident_escalate() as n`))[0].n).toBe(1);
    expect((await admin<{ n: number }>(`select public._incident_escalate() as n`))[0].n).toBe(0);
    expect((await admin<{ escalated_level: number }>(`select escalated_level from incidents where id=$1`, [inc]))[0].escalated_level).toBe(1);
    expect((await admin(`select 1 from incident_logs where incident_id=$1 and action='ESCALATED'`, [inc])).length).toBe(1);
  });

  it("alur penanganan: ACK → tindak lanjut → WO emergensi → selesai → ditutup HQ", async () => {
    await expectError(one(U.driver, `select public.incident_ack($1)`, [inc]), "tidak berwenang");
    await one(U.spv, `select public.incident_ack($1)`, [inc]);
    await expectError(one(U.spv, `select public.incident_ack($1)`, [inc]), "sudah dikonfirmasi");
    await expectError(one(U.spv, `select public.incident_log_action($1,'ASSIGN_TOW','')`, [inc]), "Catatan wajib");
    await one(U.spv, `select public.incident_log_action($1,'ASSIGN_TOW','Derek dikirim')`, [inc]);
    const wo = (await one<{ id: string }>(U.spv, `select public.incident_create_wo($1,$2) as id`, [inc, U.mech2])).id;
    await expectError(one(U.spv, `select public.incident_create_wo($1,null)`, [inc]), "sudah memiliki Work Order");
    expect((await admin<{ incident_id: string; type: string }>(`select incident_id, type from work_orders where id=$1`, [wo]))[0]).toMatchObject({ incident_id: inc, type: "EMERGENCY" });
    await expectError(one(U.spv, `select public.incident_close($1)`, [inc]), "Hanya Admin Pusat");
    await expectError(one(U.hq, `select public.incident_close($1)`, [inc]), "harus diselesaikan");
    await one(U.spv, `select public.incident_resolve($1,'Kendaraan ditarik ke bengkel')`, [inc]);
    await one(U.hq, `select public.incident_close($1)`, [inc]);
    const logs = (await q(U.driver, `select action from incident_logs where incident_id=$1 order by id`, [inc])).rows.map((r) => (r as { action: string }).action);
    expect(logs).toEqual(["REPORTED", "ESCALATED", "ACKNOWLEDGED", "ASSIGN_TOW", "WO_CREATED", "RESOLVED", "CLOSED"]);
    await expectError(db.query(`delete from incident_logs`), "append-only");
    await expectError(db.query(`delete from incidents`), "tidak dapat dihapus");
  });

  it("pusat dapat mencatat laporan telepon atas nama pengemudi; laporan keliru ditandai, bukan dihapus", async () => {
    const r = (await one<{ r: { incident: { id: string } } }>(U.hq, `select public.incident_report($1,'TIRE',null,null,'Jl. X',null,null,null,$2) as r`, [ID["B 2 JKT"], U.driver2])).r;
    expect((await admin<{ source: string; driver_id: string }>(`select source, driver_id from incidents where id=$1`, [r.incident.id]))[0]).toMatchObject({ source: "CENTER", driver_id: U.driver2 });
    await expectError(one(U.mech, `select public.incident_report($1,'TIRE',null,null,null,null,null,null,$2)`, [ID["B 2 JKT"], U.driver2]), "Hanya pusat");
    await one(U.hq, `select public.incident_mark_false($1,'Salah kendaraan')`, [r.incident.id]);
    const row = (await admin<{ is_false_report: boolean; status: string }>(`select is_false_report, status from incidents where id=$1`, [r.incident.id]))[0];
    expect(row).toMatchObject({ is_false_report: true, status: "CLOSED" });
  });

  it("kontak Global terakhir tidak dapat dinonaktifkan; format telepon divalidasi; langkah cepat minimal satu", async () => {
    const globals = await admin<{ id: string }>(`select id from emergency_contacts where scope='GLOBAL' and is_active`);
    expect(globals.length).toBe(2);
    await q(U.hq, `update emergency_contacts set is_active=false where id=$1`, [globals[0].id]);
    await expectError(q(U.hq, `update emergency_contacts set is_active=false where id=$1`, [globals[1].id]), "Global terakhir");
    await expectError(q(U.hq, `update emergency_contacts set phone='abc' where id=$1`, [globals[1].id]), "Format telepon");
    expect((await q(U.spv, `update emergency_contacts set name='x' where id=$1`, [globals[1].id])).affectedRows).toBe(0);
    await expectError(q(U.spv, `insert into emergency_contacts (role_label, name, phone) values ('a','b','12345678')`), /row-level|permission/);
    await expectError(q(U.hq, `update emergency_playbooks set steps='[]' where incident_type='FIRE'`), "minimal satu langkah");
    await expectError(q(U.hq, `update emergency_playbooks set is_active=false where incident_type='GENERAL'`), "tidak dapat dinonaktifkan");
  });
});

describe("lampiran, laporan, dan master", () => {
  it("lampiran: batas jumlah dan tipe; tidak dapat ditambah setelah dokumen diajukan", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang JKT"] });
    const ins = (n: number, mime = "image/png") =>
      q(U.wh, `insert into attachments (entity_type, entity_id, branch_id, storage_path, file_name, mime, size_bytes, uploaded_by)
               values ('STOCK_DOC',$1,$2,$3,'f.png',$4,1000,$5)`, [id, ID.JKT, `p/${id}/${n}`, mime, U.wh]);
    await ins(1);
    await expectError(ins(2, "application/zip"), "gambar atau PDF");
    for (let i = 2; i <= 5; i++) await ins(i);
    await expectError(ins(6), "Maksimal 5 lampiran");
    await submit(U.wh, id);
    await expectError(ins(7), "tidak menerima lampiran baru");
    await expectError(q(U.wh, `delete from attachments where entity_id=$1`, [id]), "tidak dapat dihapus");
  });

  it("laporan hanya menampilkan data cabang pengguna; HQ melihat semua", async () => {
    const mine = (await q(U.spv, `select count(*)::int as c from rpt_01_mutasi`)).rows[0] as { c: number };
    const sby = (await q(U.spvS, `select count(*)::int as c from rpt_01_mutasi`)).rows[0] as { c: number };
    const hq = (await q(U.hq, `select count(*)::int as c from rpt_01_mutasi`)).rows[0] as { c: number };
    expect(mine.c).toBeGreaterThan(0);
    expect(sby.c).toBe(0);
    expect(hq.c).toBe(mine.c);
    for (const v of ["rpt_02_kartu_stok", "rpt_03_posisi_stok", "rpt_04_opname", "rpt_05_jadwal_realisasi", "rpt_08_rekap_alasan",
      "rpt_09_riwayat_perawatan", "rpt_10_pemakaian_part", "rpt_11_insiden", "rpt_12_waktu_respon", "rpt_13_kinerja_approval"]) {
      const r = await q(U.hq, `select * from ${v}`);
      expect(r.rows.length, v).toBeGreaterThanOrEqual(0);
    }
    expect(((await q(U.hq, `select * from rpt_13_kinerja_approval`)).rows as { jumlah: number }[]).length).toBeGreaterThan(0);
    expect(((await q(U.hq, `select * from rpt_09_riwayat_perawatan`)).rows[0] as { part_terpakai: string }).part_terpakai).toContain("Oli Mesin");
  });

  it("master yang masih dipakai tidak dapat dinonaktifkan", async () => {
    await expectError(q(U.sys, `update vehicles set is_active=false where id=$1`, [ID["B 2 JKT"]]), "Work Order aktif");
    await expectError(q(U.sys, `update spareparts set is_active=false where id=$1`, [ID.AKI]), /masih memiliki stok|dokumen mutasi/);
    await expectError(q(U.sys, `update spareparts set uom='box' where id=$1`, [ID.AKI]), "sudah memiliki mutasi");
  });

  it("job gabungan berjalan tanpa galat dan mengembalikan ringkasan", async () => {
    const r = (await admin<{ r: Record<string, number> }>(`select public._run_jobs() as r`))[0].r;
    expect(Object.keys(r).sort()).toEqual(["approval_sla", "emergency_validation", "incident_escalation", "low_stock", "overdue", "preventive_wo"]);
  });

  it("SLA approval melewati batas membuat catatan dan notifikasi sekali saja", async () => {
    const id = await makeDoc(U.wh, "IN", [{ sparepart_id: ID.AKI, qty: "1" }], { to: ID["Gudang JKT"] });
    const s = await submit(U.wh, id);
    await db.query(`update approval_requests set step_started_at = now() - interval '30 hours' where id=$1`, [s.request_id]);
    expect((await admin<{ n: number }>(`select public._approval_sla_check() as n`))[0].n).toBeGreaterThanOrEqual(1);
    expect((await admin<{ n: number }>(`select public._approval_sla_check() as n`))[0].n).toBe(0);
    expect((await admin(`select 1 from approval_actions where request_id=$1 and action='SLA_BREACH'`, [s.request_id])).length).toBe(1);
    await one(U.hq, `select public.approval_remind($1)`, [s.request_id]);
    await one(U.hq, `select public.approval_escalate($1,'x')`, [s.request_id]).catch(() => undefined);
  });
});

describe("kontrak query aplikasi", () => {
  it("nama relasi yang dipakai embed PostgREST di halaman benar-benar ada", async () => {
    const need = [
      "stock_documents_from_location_id_fkey",
      "stock_documents_to_location_id_fkey",
      "stock_document_lines_from_location_id_fkey",
      "stock_document_lines_to_location_id_fkey",
      "work_orders_assignee_id_fkey",
      "stock_documents_wo_fk",
      "stock_movements_wo_fk",
      "stock_movements_vehicle_id_fkey",
      "work_orders_incident_fk",
    ];
    const have = new Set((await admin<{ conname: string }>(`select conname from pg_constraint where contype='f'`)).map((r) => r.conname));
    expect(need.filter((n) => !have.has(n))).toEqual([]);
  });

  it("daftar teknisi untuk form WO hanya berisi yang boleh menjalankan WO di cabang itu", async () => {
    const r = await q(U.spv, `select id from wo_assignees($1)`, [ID.JKT]);
    const ids = (r.rows as { id: string }[]).map((x) => x.id).sort();
    expect(ids).toEqual(expect.arrayContaining([U.mech, U.mech2, U.spv, U.whSpv]));
    expect(ids).not.toContain(U.driver);
    expect(ids).not.toContain(U.wh);
    expect((await q(U.mech, `select id from wo_assignees($1)`, [ID.SBY])).rows.length).toBe(0);
  });

  it("pelapor menambah keterangan insiden miliknya; orang lain ditolak", async () => {
    const r = (await one<{ r: { incident: { id: string } } }>(U.driver, `select public.incident_report($1,'OTHER',null,null,null,null,null,$2) as r`, [ID["B 1 JKT"], "22222222-2222-2222-2222-222222222222"])).r;
    await one(U.driver, `select public.incident_add_detail($1,'Kaca pecah',2)`, [r.incident.id]);
    const row = (await admin<{ description: string; casualties: number }>(`select description, casualties from incidents where id=$1`, [r.incident.id]))[0];
    expect(row).toMatchObject({ description: "Kaca pecah", casualties: 2 });
    await expectError(one(U.driver2, `select public.incident_add_detail($1,'x',null)`, [r.incident.id]), "tidak berwenang");
    await expectError(one(U.driver, `select public.incident_add_detail($1,'',null)`, [r.incident.id]), "Isi keterangan");
  });
});
