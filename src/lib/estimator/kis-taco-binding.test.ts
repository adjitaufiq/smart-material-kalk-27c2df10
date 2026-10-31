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

import { parseSpecHints as _psh } from "@/lib/kis";
import { applyQuickSpec as _aqs, DEFAULT_QUICK_SPEC as _dqs } from "@/lib/estimator/quick-spec";
import { makeModule as _mm } from "@/lib/estimator/factory";
import { describe as _d, it as _it, expect as _e } from "vitest";
_d("KIS body papan olahan", () => {
  _it("alias blockmin-1s-18 → blockmin_1s, tanpa HPL dalam", () => {
    const r = _psh({ body: "blockmin-1s-18" });
    _e(r.spec?.body).toBe("blockmin_1s");
    const [m] = _aqs([_mm({ kind: "base_cabinet", name: "B", width_mm: 800, height_mm: 800, depth_mm: 550 })], { ..._dqs, body: "blockmin_1s", inside: "hpl" });
    _e(m!.bodyMaterialId).toBe("blockmin18");
    _e(m!.finish.bodyInside.hplId).toBeNull();
  });
  _it("blockboard-18 → blockboard18", () => {
    _e(_psh({ body: "blockboard-18" }).spec?.body).toBe("blockboard");
    const [m] = _aqs([_mm({ kind: "base_cabinet", name: "B", width_mm: 800, height_mm: 800, depth_mm: 550 })], { ..._dqs, body: "blockboard" });
    _e(m!.bodyMaterialId).toBe("blockboard18");
  });
});
