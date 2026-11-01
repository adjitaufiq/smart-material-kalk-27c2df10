import { describe, expect, it } from "vitest";
import { auditSpec, auditTable, shopCategory } from "./kis-audit";
import type { BomItem } from "./estimator/types";

const b = (id: string, group: BomItem["group"], name: string, qty = 1, unit = "pcs"): BomItem => ({ id, group, name, qty, unit, unitPrice: 1, total: 1, trace: [], explanation: "" });
const ai = (counts: { id: never | string; qty: number | null }[]) => ({ scannedAt: "", doors: null, drawers: null, extra: [], counts: counts.map((c) => ({ ...c, evidence: "" })) }) as never;

describe("AI audit spek vs gambar", () => {
  it("engsel set 2 pcs: 4 set = 8 pcs, gambar 8 = PASS", () => {
    const r = auditTable({ results: [], bom: [b("e", "hardware", "Engsel TACO ET-01", 4, "set")], ai: ai([{ id: "engsel", qty: 8 }]) });
    expect(r.find((x) => x.id === "engsel")?.status).toBe("pass");
  });
  it("hidrolik terlihat 2, BOM 0 = GAP kurang", () => {
    const f = auditSpec({ results: [], bom: [], ai: ai([{ id: "hidrolik", qty: 2 }]) });
    expect(f).toContainEqual(expect.objectContaining({ type: "kurang", item: "Hidrolik / gas spring" }));
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
