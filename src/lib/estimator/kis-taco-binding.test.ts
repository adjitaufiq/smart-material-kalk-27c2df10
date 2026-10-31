import { describe, expect, it } from "vitest";
import { buildKisEstimate } from "../kis";
import { makeModule } from "./factory";
import { applyQuickSpec, DEFAULT_QUICK_SPEC, TACO_HPL_PENDING } from "./quick-spec";
import { tacoHplPrice } from "./taco-pricing";

const base = () => [makeModule({ kind: "base_cabinet", name: "Bawah", width_mm: 800, height_mm: 720, depth_mm: 560 })];

describe("Binding HPL KIS per modul", () => {
  it("kode HPL dari KIS dipakai apa adanya (TH 825 NT)", () => {
    const m = applyQuickSpec(base(), { ...DEFAULT_QUICK_SPEC, outside: "hpl", hplOutside: { code: "TH 825 NT" } })[0]!;
    expect(m.finish.bodyOutside.hplId).toContain("TH 825 NT");
  });
  it("tanpa kode dari KIS tidak jatuh ke taco-002aa", () => {
    const m = applyQuickSpec(base(), { ...DEFAULT_QUICK_SPEC, outside: "hpl" })[0]!;
    expect(m.finish.bodyOutside.hplId).toBe(TACO_HPL_PENDING);
    expect(m.finish.bodyOutside.hplId).not.toBe("taco-002aa");
  });
  it("harga suffix: NT = Rp234.000, 002 White = Rp130.000", () => {
    expect(tacoHplPrice("TH 825 NT").harga).toBe(234000);
    expect(tacoHplPrice("TH 002").harga).toBe(130000);
  });
});

describe("Payload balikan ke KIS", () => {
  it("membawa daftar belanja per baris dengan harga acuan", () => {
    const p = buildKisEstimate({
      kisProjectId: "p1",
      estimateId: "e1",
      results: [],
      bom: [
        { id: "a", group: "edging", name: "Edging PVC TACO", qty: 13, unit: "meter", unitPrice: 3000, total: 39000, trace: [], explanation: "" },
        { id: "b", group: "finishing", name: "HPL TACO — kode belum dipilih", qty: 2, unit: "lembar", unitPrice: null, total: null, trace: [], explanation: "" },
      ],
      grandTotal: 39000,
      deepLinkUrl: "https://x",
    });
    expect(p.bom).toHaveLength(2);
    expect(p.bom[0]).toMatchObject({ qty: 13, unit: "meter", unitPrice: 3000, total: 39000, needsConfirmation: false });
    expect(p.bom[1]!.needsConfirmation).toBe(true);
    expect(p.materialCost).toBe(39000);
    expect(p.shoppingList[0]).toMatchObject({ name: "Edging PVC TACO", qty: 13, unitPrice: 3000, subtotal: 39000 });
  });
  it("kode HPL dari KIS terbawa ke shoppingList", () => {
    const p = buildKisEstimate({
      kisProjectId: "p1", estimateId: "e1", results: [], grandTotal: 468000, deepLinkUrl: "https://x",
      bom: [{ id: "taco:solid:TH 825 NT|TH 825 NT", group: "finishing", name: "HPL TACO TH 825 NT", qty: 2, unit: "lembar", unitPrice: 234000, total: 468000, trace: [], explanation: "" }],
    });
    expect(p.shoppingList[0]!.code).toBe("TH 825 NT");
  });
});
