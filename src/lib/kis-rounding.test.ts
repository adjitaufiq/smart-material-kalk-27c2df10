import { describe, expect, it } from "vitest";
import { buildKisEstimate } from "./kis";
import type { BomItem } from "./estimator/types";
const b = (id: string, qty: number, unit: string, unitPrice: number): BomItem => ({ id, group: "material", name: id, qty, unit, unitPrice, total: qty * unitPrice, trace: [], explanation: "" });
describe("aturan pembulatan KIS", () => {
  const p = buildKisEstimate({ kisProjectId: "k", estimateId: "e", results: [], grandTotal: 1, deepLinkUrl: "https://x/project/e",
    bom: [b("mat-pvc", 3.2, "lembar", 699000), b("list", 10.4, "meter", 1000), b("kaca", 1.2, "m²", 140000)] });
  it("3,2 lembar → 4 lembar, subtotal dari 4", () => {
    expect(p.shoppingList[0]).toMatchObject({ qty: 4, subtotal: 2796000, waste: 0.8 });
  });
  it("10,4 m → 11 m", () => expect(p.shoppingList[1]!.qty).toBe(11));
  it("kaca tetap 1,2 m²", () => expect(p.shoppingList[2]!.qty).toBe(1.2));
  it("materialCost = jumlah subtotal", () => expect(p.materialCost).toBe(2796000 + 11000 + 168000));
  it("deepLinkUrl dikirim", () => expect(p.deepLinkUrl).toBe("https://x/project/e"));
});
