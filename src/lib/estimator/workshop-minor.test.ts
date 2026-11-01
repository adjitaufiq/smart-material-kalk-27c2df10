import { describe, expect, it } from "vitest";
import { glueOrder } from "./taco-pricing";
import { buildKisEstimate } from "../kis";
import type { BomItem } from "./types";

describe("aturan lem workshop", () => {
  it("10 lembar HPL (10 kg) → 1 blek", () => {
    expect(glueOrder(10, "active")).toEqual({ blek: 1, galon: 0, total: 648900 });
  });
  it("6 kg (butuh 3 galon) → rekomendasi 1 blek", () => {
    expect(glueOrder(6, "active")).toMatchObject({ blek: 1, galon: 0 });
  });
  it("2 kg → 1 galon", () => {
    expect(glueOrder(2, "active")).toMatchObject({ blek: 0, galon: 1 });
  });
});

describe("KIS hanya terima bahan utama", () => {
  it("paku/sekrup/fischer tidak masuk shoppingList, tapi biayanya tetap di HPP", () => {
    const bom: BomItem[] = [
      { id: "engsel-sendok", group: "hardware", name: "Engsel", qty: 2, unit: "set (2 pcs)", unitPrice: 18000, total: 36000, trace: [], explanation: "" },
      { id: "paku-f30", group: "hardware", name: "Paku", qty: 1, unit: "box", unitPrice: 28000, total: 28000, trace: [], explanation: "" },
    ];
    const p = buildKisEstimate({ kisProjectId: "k", estimateId: "e", results: [], bom, grandTotal: 64000, deepLinkUrl: "" });
    expect(p.shoppingList.map((s) => s.code)).toEqual(["engsel-sendok"]);
    expect(p.workshopConsumablesCost).toBe(28000);
    expect(p.materialCost).toBe(64000);
  });
});
