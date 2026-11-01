import { describe, expect, it } from "vitest";
import { auditSpec, shopCategory } from "./kis-audit";
import type { BomItem } from "./estimator/types";

const b = (id: string, group: BomItem["group"], name: string): BomItem => ({ id, group, name, qty: 1, unit: "pcs", unitPrice: 1, total: 1, trace: [], explanation: "" });

describe("audit spek QC", () => {
  it("lampu terlihat di gambar tapi tidak di spek = kurang", () => {
    const f = auditSpec({ results: [], bom: [], visual: { lampu: true } });
    expect(f).toEqual([expect.objectContaining({ type: "kurang", item: "Lampu LED / sorot" })]);
  });
  it("rak sayur di spek tapi tidak terlihat = lebih", () => {
    const f = auditSpec({ results: [], bom: [b("rak-sayur", "hardware", "Rak Sayur RS-60")], visual: { "rak-sayur": false } });
    expect(f[0]?.type).toBe("lebih");
  });
  it("semua sesuai = tanpa temuan", () => {
    expect(auditSpec({ results: [], bom: [], visual: { kaca: false } })).toEqual([]);
  });
  it("paku masuk perintilan workshop", () => {
    expect(shopCategory(b("paku-f30", "hardware", "Paku F30"))).toBe("Perintilan Workshop");
  });
});

describe("AI QC layer", () => {
  it("melaporkan item terlihat AI yang tidak ada di BOM dan selisih pintu", () => {
    const f = auditSpec({
      results: [],
      bom: [],
      ai: { scannedAt: "", items: [{ id: "lampu", status: "ada", evidence: "LED bawah kabinet" }], doors: 4, drawers: null, extra: ["Rak sepatu"] },
    });
    expect(f.map((x) => x.item)).toEqual(["Daun pintu", "Rak sepatu", "Lampu LED / sorot"]);
    expect(f.every((x) => x.type === "kurang")).toBe(true);
  });
});
