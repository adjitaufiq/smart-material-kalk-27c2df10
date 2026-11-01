import { describe, expect, it } from "vitest";
import { applyAuditToExtras, auditAdjustBom, type AiQcResult } from "./kis-audit";
import type { BomItem } from "./estimator/types";

const b = (id: string, name: string, qty: number, unit: string, unitPrice: number): BomItem =>
  ({ id, group: "hardware", name, qty, unit, unitPrice, total: qty * unitPrice, trace: [], explanation: "" }) as BomItem;
const ai: AiQcResult = {
  scannedAt: "t",
  doors: 9,
  drawers: 3,
  extra: [],
  counts: [
    { id: "pintu", qty: 9, evidence: "" },
    { id: "kaca", qty: 2, evidence: "" },
    { id: "laci", qty: 3, evidence: "" },
    { id: "handle", qty: 0, evidence: "" },
    { id: "sorot", qty: 2, evidence: "" },
    { id: "hidrolik", qty: null, evidence: "" },
  ],
};

describe("Terapkan Hasil Audit (Adji)", () => {
  const ex = applyAuditToExtras({ lighting: "led", otherAccessories: [{ id: "hidrolik", qty: 8 }] }, ai);
  it("gas spring = 2 pintu angkat × 2 = 4 pcs", () => expect(ex.otherAccessories?.find((o) => o.id === "hidrolik")?.qty).toBe(4));
  it("2 titik lampu sorot masuk belanja", () => {
    expect(ex.spotQty).toBe(2);
    expect(ex.lighting).toBe("led_spot");
  });
  it("handleless → handle dihapus, engsel 7 set (pintu kaca tanpa engsel), rel 3 set", () => {
    expect(ex.handle).toBe("none");
    const bom = auditAdjustBom([b("h", "Engsel Sendok TACO ET-01", 9, "set", 18000), b("r", "Rel Laci Double Track TACO", 1, "set", 50000), b("handle", "Handle Tarikan", 9, "pcs", 15000)], ai, ex);
    expect(bom.find((x) => x.id === "h")?.qty).toBe(7);
    expect(bom.find((x) => x.id === "h")?.total).toBe(126000);
    expect(bom.find((x) => x.id === "r")?.qty).toBe(3);
    expect(bom.some((x) => x.id === "handle")).toBe(false);
  });
});
