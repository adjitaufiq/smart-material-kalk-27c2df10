import { describe, expect, it } from "vitest";
import { buildKisEstimate, parseFinishExtras } from "./kis";
import type { BomItem, CalculationResult, Part } from "./estimator/types";

const part = (module_name: string, part_name: string, l: number, w: number, qty = 1) =>
  ({ module_name, part_name, length_mm: l, width_mm: w, qty }) as Part;
const res = {
  parts: [part("Kitchen Set Atas", "Pintu", 700, 400, 2), part("Kitchen Set Atas", "Alas Bawah", 1600, 330)],
  edgingMeters: [{ edgingId: "e", name: "Edging", meters: 12.3, trace: [] }],
} as unknown as CalculationResult;
const edging: BomItem = { id: "e", group: "edging", name: "Edging PVC TACO", qty: 13, unit: "m", unitPrice: 3000, total: 39000, trace: [], explanation: "" };
const run = (raw: Record<string, unknown>) =>
  buildKisEstimate({ kisProjectId: "p", estimateId: "e", results: [res], bom: [edging], grandTotal: 39000, deepLinkUrl: "x", extras: parseFinishExtras(raw) });

describe("KIS finish extras", () => {
  it("glass dark → 0.56 m² kaca + 5 m' frame dari pintu atas", () => {
    const s = run({ glass: "dark" }).shoppingList;
    expect(s.find((x) => x.code === "kaca-dark")?.qty).toBe(0.56);
    expect(s.find((x) => x.code === "frame-alu-kaca")?.qty).toBe(5);
  });
  it("list_gold menggantikan edging PVC", () => {
    const r = run({ edge: "list_gold" });
    expect(r.shoppingList.some((x) => x.code === "e")).toBe(false);
    expect(r.shoppingList.find((x) => x.code === "list_gold")?.qty).toBe(13);
    expect(r.materialCost).toBe(0);
  });
  it("led → LED strip 2 m' + 1 trafo", () => {
    const s = run({ lighting: "led" }).shoppingList;
    expect(s.find((x) => x.code === "led-strip")?.qty).toBe(2);
    expect(s.find((x) => x.code === "driver-led")?.qty).toBe(1);
  });
  it("aksesori di luar master masuk 1:1", () => {
    const s = run({ accessories: ["ventilasi", "hidrolik", "rak-piring"] }).shoppingList;
    expect(s.find((x) => x.code === "ventilasi")?.qty).toBe(2);
    expect(s.find((x) => x.code === "hidrolik")?.needsConfirmation).toBe(true);
    expect(s.some((x) => x.code === "rak-piring")).toBe(false);
  });
});
