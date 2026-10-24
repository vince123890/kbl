import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateTempPassword, validatePassword } from "./password";
import { afterFailure, isLocked, minutesLeft, sessionExpired, CLEAN_LOCK_STATE } from "./lockout";
import { getMaster, parseMasterInput } from "./masters";
import { friendlyDbError } from "./pg-errors";

describe("kebijakan password", () => {
  it("menerima Armada2026", () => expect(validatePassword("Armada2026")).toBeNull());
  it("menolak abc123 (6 karakter)", () => expect(validatePassword("abc123")).toBe("Minimal 8 karakter, huruf dan angka"));
  it("batas 7 vs 8 karakter", () => {
    expect(validatePassword("abcdef1")).not.toBeNull();
    expect(validatePassword("abcdefg1")).toBeNull();
  });
  it("menolak tanpa angka atau tanpa huruf", () => {
    expect(validatePassword("abcdefgh")).not.toBeNull();
    expect(validatePassword("12345678")).not.toBeNull();
  });
  it("menolak password yang sama dengan saat ini", () => {
    expect(validatePassword("Armada2026", "Armada2026")).toBe("Password baru harus berbeda");
    expect(validatePassword("Armada2027", "Armada2026")).toBeNull();
  });
  it("properti: valid jika dan hanya jika >= 8, ada huruf dan angka", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), (s) => {
        const ok = s.length >= 8 && /[A-Za-z]/.test(s) && /[0-9]/.test(s);
        expect(validatePassword(s) === null).toBe(ok);
      }),
    );
  });
  it("password sementara selalu memenuhi kebijakan", () => {
    for (let i = 0; i < 200; i++) expect(validatePassword(generateTempPassword())).toBeNull();
  });
});

describe("penguncian akun", () => {
  const t0 = new Date("2026-10-24T08:00:00Z");
  it("4 kegagalan belum mengunci, kelima mengunci 15 menit", () => {
    let s = { ...CLEAN_LOCK_STATE };
    for (let i = 1; i <= 4; i++) {
      const r = afterFailure(s, t0);
      expect(r.justLocked).toBe(false);
      s = r;
    }
    const fifth = afterFailure(s, t0);
    expect(fifth.justLocked).toBe(true);
    expect(isLocked(fifth, t0)).toBe(true);
    expect(minutesLeft(fifth, t0)).toBe(15);
  });
  it("kunci berakhir setelah 15 menit", () => {
    const locked = afterFailure({ failed_attempts: 4, locked_until: null }, t0);
    expect(isLocked(locked, new Date(t0.getTime() + 14 * 60_000))).toBe(true);
    expect(isLocked(locked, new Date(t0.getTime() + 15 * 60_000))).toBe(false);
  });
  it("kegagalan setelah kunci berakhir dihitung dari 0", () => {
    const later = new Date(t0.getTime() + 20 * 60_000);
    const r = afterFailure({ failed_attempts: 5, locked_until: t0.toISOString() }, later);
    expect(r.failed_attempts).toBe(1);
    expect(r.justLocked).toBe(false);
  });
});

describe("sesi 8 jam", () => {
  const t = Date.parse("2026-10-24T00:00:00Z");
  it("belum kedaluwarsa tepat 8 jam, kedaluwarsa setelahnya", () => {
    expect(sessionExpired(t, t + 8 * 3_600_000)).toBe(false);
    expect(sessionExpired(t, t + 8 * 3_600_000 + 1)).toBe(true);
  });
});

describe("validasi input master", () => {
  const sp = getMaster("spareparts")!;
  const veh = getMaster("vehicles")!;
  const vendor = getMaster("vendors")!;

  it("sparepart valid", () => {
    const r = parseMasterInput(sp, { code: " OLI-001 ", name: "Oli", category: "Pelumas", uom: "liter", min_stock: "5" }, "create");
    expect(r.errors).toEqual({});
    expect(r.values).toMatchObject({ code: "OLI-001", min_stock: 5 });
  });
  it("stok minimum negatif atau bukan angka ditolak", () => {
    expect(parseMasterInput(sp, { code: "A", name: "n", category: "c", uom: "u", min_stock: "-1" }, "create").errors.min_stock).toBeTruthy();
    expect(parseMasterInput(sp, { code: "A", name: "n", category: "c", uom: "u", min_stock: "abc" }, "create").errors.min_stock).toBeTruthy();
  });
  it("field wajib kosong ditolak", () => {
    const r = parseMasterInput(sp, { code: "", name: "", category: "", uom: "" }, "create");
    expect(Object.keys(r.errors).sort()).toEqual(["category", "code", "name", "uom"]);
  });
  it("vendor tanpa telepon atau tipe tak dikenal ditolak", () => {
    expect(parseMasterInput(vendor, { name: "V", type: "DEREK", phone: "" }, "create").errors.phone).toBeTruthy();
    expect(parseMasterInput(vendor, { name: "V", type: "LAINNYA", phone: "1" }, "create").errors.type).toBeTruthy();
  });
  it("odometer awal hanya saat create; status Dalam Perawatan tidak dapat dipilih", () => {
    const edit = parseMasterInput(veh, { plate_no: "B 1", type: "Truk", branch_id: "x", odometer: "999", status: "ACTIVE" }, "edit");
    expect("odometer" in edit.values).toBe(false);
    const manual = parseMasterInput(veh, { plate_no: "B 1", type: "Truk", branch_id: "x", odometer: "0", status: "IN_MAINTENANCE" }, "create");
    expect(manual.errors.status).toBeTruthy();
  });
  it("tahun harus bilangan bulat dalam rentang", () => {
    expect(parseMasterInput(veh, { plate_no: "B 1", type: "T", branch_id: "x", odometer: "0", year: "2020.5" }, "create").errors.year).toBeTruthy();
    expect(parseMasterInput(veh, { plate_no: "B 1", type: "T", branch_id: "x", odometer: "0", year: "1900" }, "create").errors.year).toBeTruthy();
  });
  it("cabang harus salah satu yang dikenal", () => {
    expect(parseMasterInput(veh, { plate_no: "B 1", type: "T", branch_id: "z", odometer: "0" }, "create", ["a", "b"]).errors.branch_id).toBeTruthy();
  });
  it("checkbox bernilai boolean", () => {
    const br = getMaster("branches")!;
    expect(parseMasterInput(br, { code: "C", name: "N", is_hq: "on" }, "create").values.is_hq).toBe(true);
    expect(parseMasterInput(br, { code: "C", name: "N" }, "create").values.is_hq).toBe(false);
  });
});

describe("pesan galat database", () => {
  it("unik: memakai pesan khusus master", () => {
    expect(friendlyDbError({ code: "23505", details: "Key (code)=(X) already exists." }, getMaster("spareparts"))).toBe("Kode sudah dipakai");
    expect(friendlyDbError({ code: "23505", details: "Key (plate_norm)=(B1) already exists." }, getMaster("vehicles"))).toBe("Nomor polisi sudah dipakai");
  });
  it("RLS dan raise exception", () => {
    expect(friendlyDbError({ code: "42501", message: "x" })).toMatch(/tidak berwenang/);
    expect(friendlyDbError({ code: "P0001", message: "Odometer tidak boleh lebih kecil dari 10000" })).toBe(
      "Odometer tidak boleh lebih kecil dari 10000",
    );
  });
});
