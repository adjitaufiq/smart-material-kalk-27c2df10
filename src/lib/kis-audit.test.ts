import { describe, expect, it } from "vitest";
import { auditSpec, auditTable, shopCategory } from "./kis-audit";
import type { BomItem } from "./estimator/types";

const b = (id: string, group: BomItem["group"], name: string, qty = 1, unit = "pcs"): BomItem => ({ id, group, name, qty, unit, unitPrice: 1, total: 1, trace: [], explanation: "" });
const ai = (counts: { id: never | string; qty: number | null }[]) => ({ scannedAt: "", doors: null, drawers: null, extra: [], counts: counts.map((c) => ({ ...c, evidence: "" })) }) as never;

describe("AI audit spek vs gambar", () => {
  it("sebelum Terapkan: pintu/laci/engsel/gas spring menunggu scan, bukan template 4/0/8", () => {
    const r = auditTable({ results: [], bom: [b("e", "hardware", "Engsel TACO ET-01", 4, "set")], ai: ai([{ id: "pintu", qty: 10 }]) });
    for (const id of ["pintu", "laci", "engsel", "rel", "hidrolik"]) expect(r.find((x) => x.id === id)?.spec).toBeNull();
    expect(auditSpec({ results: [], bom: [], ai: ai([{ id: "pintu", qty: 10 }, { id: "hidrolik", qty: 4 }]) })).toEqual([]);
  });
  it("Adji setelah Terapkan: 10 pintu, 2 kaca angkat, 3 laci, 9 ambalan = PASS semua", () => {
    const a = ai([{ id: "pintu", qty: 10 }, { id: "kaca", qty: 2 }, { id: "laci", qty: 3 }, { id: "engsel", qty: 16 }, { id: "rel", qty: 3 }, { id: "hidrolik", qty: 4 }, { id: "ambalan", qty: 9 }]);
    const r = auditTable({ results: [], bom: [], ai: a, applied: true });
    expect(r.find((x) => x.id === "hidrolik")?.spec).toBe(4);
    expect(r.find((x) => x.id === "engsel")?.spec).toBe(16);
    expect(r.find((x) => x.id === "rel")?.spec).toBe(3);
    expect(r.filter((x) => ["pintu", "laci", "engsel", "rel", "hidrolik", "kaca", "ambalan"].includes(x.id)).every((x) => x.status === "pass")).toBe(true);
  });
  it("granit, sink, backsplash dari AI bukan GAP workshop", () => {
    const a = { ...(ai([]) as object), extra: ["Top granit", "Sink", "Backsplash keramik", "Cutlery tray"] } as never;
    expect(auditSpec({ results: [], bom: [], ai: a })).toEqual([]);
  });
  it("rak sayur di BOM tapi gambar 0 = GAP lebih", () => {
    const f = auditSpec({ results: [], bom: [b("rak-sayur", "hardware", "Rak Sayur RS-60")], ai: ai([{ id: "rak-sayur", qty: 0 }]) });
    expect(f[0]?.type).toBe("lebih");
  });
  it("AI tidak bisa hitung = tidak jelas, bukan gap", () => {
    expect(auditSpec({ results: [], bom: [], ai: ai([{ id: "led", qty: null }]) })).toEqual([]);
  });
  it("paku masuk perintilan workshop", () => {
    expect(shopCategory(b("paku-f30", "hardware", "Paku F30"))).toBe("Perintilan Workshop");
  });
});

import { parseFinishExtras } from "./kis";
import { auditSpec as _as, auditTable as _at } from "./kis-audit";
describe("sinkron KIS: LED eksak & kaki adjuster", () => {
  const ex = parseFinishExtras({ finishExtras: { ledRun: { qty: 2 }, spotlights: { qty: 2 } } })!;
  it("ledRun.qty 2 terbaca", () => expect(ex.ledQty).toBe(2));
  it("LED spek 2 vs gambar 1 = GAP, 2 vs 2 = PASS", () => {
    const mk = (n: number) => ({ scannedAt: "", counts: [{ id: "led" as const, qty: n, evidence: "" }], doors: null, drawers: null, extra: [] });
    expect(_at({ results: [], bom: [], extras: ex, ai: mk(1) }).find((r) => r.id === "led")?.status).toBe("lebih");
    expect(_at({ results: [], bom: [], extras: ex, ai: mk(2) }).find((r) => r.id === "led")?.status).toBe("pass");
  });
  it("kaki adjuster bukan temuan gap", () => {
    const f = _as({ results: [], bom: [], extras: ex, ai: { scannedAt: "", counts: [], doors: null, drawers: null, extra: ["Kaki adjuster plastik hitam"] } });
    expect(f.some((x) => /adjuster/i.test(x.item))).toBe(false);
  });
});
