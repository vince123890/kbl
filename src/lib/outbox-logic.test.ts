import { describe, expect, it } from "vitest";
import { classify, effectiveWoStatus, outboxKey, planBatches, type OutboxItem } from "./outbox-logic";

const item = (p: Partial<OutboxItem>): OutboxItem => ({
  key: "k",
  userId: "u1",
  kind: "COUNT_LINE",
  ref: "c1",
  payload: {},
  createdAt: "2026-10-26T01:00:00.000Z",
  attempts: 0,
  state: "PENDING",
  ...p,
});

describe("antrean sinkron offline", () => {
  it("kunci baris opname yang sama bernilai sama, sehingga hitung ulang menimpa antrean lama", () => {
    expect(outboxKey("COUNT_LINE", "u1", "c1", "sp1")).toBe(outboxKey("COUNT_LINE", "u1", "c1", "sp1"));
    expect(outboxKey("COUNT_LINE", "u1", "c1", "sp1")).not.toBe(outboxKey("COUNT_LINE", "u1", "c1", "sp2"));
  });

  it("baris opname satu sesi dikirim sekali; WO mulai sebelum selesai; foto paling akhir", () => {
    const items = [
      item({ key: "a", kind: "ATTACHMENT", ref: "w1", createdAt: "2026-10-26T01:00:00.000Z" }),
      item({ key: "b", kind: "WO_COMPLETE", ref: "w1", createdAt: "2026-10-26T01:00:03.000Z" }),
      item({ key: "c", kind: "COUNT_LINE", ref: "c1", createdAt: "2026-10-26T01:00:04.000Z" }),
      item({ key: "d", kind: "COUNT_LINE", ref: "c1", createdAt: "2026-10-26T01:00:05.000Z" }),
      item({ key: "e", kind: "WO_START", ref: "w1", createdAt: "2026-10-26T01:00:06.000Z" }),
    ];
    const order = planBatches(items, "u1").map((b) => (b.type === "COUNT" ? `count:${b.items.length}` : b.item.kind));
    expect(order).toEqual(["WO_START", "WO_COMPLETE", "count:2", "ATTACHMENT"]);
  });

  it("hanya item PENDING milik user yang sedang login yang dikirim", () => {
    const items = [item({ key: "a", userId: "u2" }), item({ key: "b", state: "CONFLICT" }), item({ key: "c" })];
    const batches = planBatches(items, "u1");
    expect(batches).toHaveLength(1);
    expect(batches[0].type === "COUNT" && batches[0].items.map((i) => i.key)).toEqual(["c"]);
  });

  it("hasil server diklasifikasikan: sukses, sesi habis, sudah tercapai, dan konflik aturan bisnis", () => {
    expect(classify("WO_START", { ok: true })).toBe("DONE");
    expect(classify("WO_START", { ok: false, error: "Sesi berakhir, silakan login kembali" })).toBe("AUTH");
    expect(classify("WO_START", { ok: false, error: "Hanya WO berstatus Scheduled yang dapat dimulai (saat ini IN_PROGRESS)" })).toBe("DONE");
    expect(classify("WO_START", { ok: false, error: "Work Order ini ditugaskan kepada teknisi lain" })).toBe("CONFLICT");
    expect(classify("WO_COMPLETE", { ok: false, error: "Hanya WO yang sedang dikerjakan yang dapat diselesaikan (saat ini COMPLETED)" })).toBe("DONE");
    expect(classify("WO_COMPLETE", { ok: false, error: "Odometer akhir 10 km tidak boleh lebih kecil dari odometer kendaraan 20 km" })).toBe("CONFLICT");
    expect(classify("COUNT_LINE", { ok: false, error: "Opname berstatus REVIEW sehingga hasil hitung tidak dapat diubah" })).toBe("CONFLICT");
    expect(classify("ATTACHMENT", { ok: false, error: "Lampiran sudah tersimpan" })).toBe("DONE");
  });

  it("tampilan optimistis: status WO mengikuti aksi yang masih menunggu sinkron", () => {
    const start = item({ key: "s", kind: "WO_START", ref: "w1" });
    const done = item({ key: "d", kind: "WO_COMPLETE", ref: "w1" });
    expect(effectiveWoStatus("SCHEDULED", [], "w1")).toEqual({ status: "SCHEDULED", pending: false });
    expect(effectiveWoStatus("SCHEDULED", [start], "w1")).toEqual({ status: "IN_PROGRESS", pending: true });
    expect(effectiveWoStatus("SCHEDULED", [start, done], "w1")).toEqual({ status: "COMPLETED", pending: true });
    expect(effectiveWoStatus("SCHEDULED", [start], "w2")).toEqual({ status: "SCHEDULED", pending: false });
  });
});
