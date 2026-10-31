import { describe, expect, it } from "vitest";
import { calculateHardware } from "./engine";
import { makeModule } from "./factory";
import { applyQuickSpec, DEFAULT_QUICK_SPEC } from "./quick-spec";

const base = () => [
  makeModule({ kind: "base_cabinet", name: "Kabinet Bawah 1", width_mm: 800, height_mm: 720, depth_mm: 560, doors: 2, drawers: 2 }),
  makeModule({ kind: "base_cabinet", name: "Kabinet Bawah 2", width_mm: 800, height_mm: 720, depth_mm: 560, doors: 2 }),
];

describe("spek cepat", () => {
  it("PVC Board dipakai untuk bodi semua kabinet", () => {
    const out = applyQuickSpec(base(), { ...DEFAULT_QUICK_SPEC, body: "pvc" });
    expect(out.every((m) => m.bodyMaterialId === "pvc18")).toBe(true);
  });

  it("ukuran modul tidak berubah", () => {
    const out = applyQuickSpec(base(), DEFAULT_QUICK_SPEC);
    expect(out.map((m) => m.width_mm)).toEqual([800, 800]);
  });

  it("top dobel menambah 1 top 2 lapis selebar total kabinet bawah", () => {
    const out = applyQuickSpec(base(), { ...DEFAULT_QUICK_SPEC, top: "double" });
    const top = out.find((m) => m.kind === "table_top");
    expect(top?.topLayers).toBe(2);
    expect(top?.width_mm).toBe(1600);
  });

  it("rel tandem & engsel biasa masuk ke daftar belanja", () => {
    const out = applyQuickSpec(base(), { ...DEFAULT_QUICK_SPEC, slide: "tandem", hinge: "biasa" });
    const hw = calculateHardware(out);
    expect(hw.find((h) => h.id.startsWith("taco-us001sc:"))?.qty).toBe(2);
    expect(hw.some((h) => h.id === "engsel-biasa")).toBe(true);
    expect(hw.some((h) => h.id === "engsel-sendok")).toBe(false);
  });

  it("rak piring dihitung 1 set", () => {
    const out = applyQuickSpec(base(), { ...DEFAULT_QUICK_SPEC, accessories: ["rak-piring"] });
    expect(calculateHardware(out).find((h) => h.id === "rak-piring")?.qty).toBe(1);
  });
});
