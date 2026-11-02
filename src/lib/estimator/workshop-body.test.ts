import { describe, expect, it } from "vitest";
import { makeModule } from "./factory";
import { generatePartsForModules } from "./parts";
import { applyQuickSpec, DEFAULT_QUICK_SPEC } from "./quick-spec";

const run = (n: number) =>
  applyQuickSpec(
    Array.from({ length: n }, (_, i) => makeModule({ kind: "wall_cabinet", name: `A${i}`, width_mm: 800, height_mm: 700, depth_mm: 350, doors: 2, wallMount: true })),
    { ...DEFAULT_QUICK_SPEC, body: "pvc_eco", hplOutside: { code: "TH 001 AA" } },
  );

describe("aturan bodi workshop", () => {
  it("3 kabinet berjajar = 4 dinding (bukan 6)", () => {
    const parts = generatePartsForModules(run(3));
    const sides = parts.filter((p) => /Side Panel|Partisi/.test(p.part_name)).reduce((a, p) => a + p.qty, 0);
    expect(sides).toBe(4);
  });
  it("HPL luar hanya di 2 dinding ujung, partisi tengah tanpa HPL luar", () => {
    const parts = generatePartsForModules(run(3));
    const outer = parts.filter((p) => p.part_name === "Side Panel (ujung)").reduce((a, p) => a + p.qty, 0);
    expect(outer).toBe(2);
    expect(parts.filter((p) => p.part_name.startsWith("Partisi")).every((p) => !p.finish_face_b)).toBe(true);
  });
  it("punggung kabinet = Triplek 3 mm, cleat dari bahan bodi", () => {
    const parts = generatePartsForModules(run(1));
    expect(parts.find((p) => p.part_name === "Back Panel")?.material_id).toBe("ply3");
    const cleat = parts.find((p) => p.part_name.startsWith("French Cleat"));
    expect(cleat?.material_id).not.toBe("ply18");
  });
});

import { calculateItem, mergeProjectBom } from "./engine";
import { composeModules } from "./factory";

describe("kitchen set 240 cm atas + bawah (Adji)", () => {
  const spec = { ...DEFAULT_QUICK_SPEC, body: "pvc_eco", top: "double", hplOutside: { code: "TH 825 NT" }, hplTop: { code: "TH 003 AA", group: "solid" } } as never;
  const rs = ([["Kitchen Set Bawah", 2400, 850, 600, 3, 3], ["Kitchen Set Atas", 2400, 800, 350, 9, 0]] as const).map(([cat, W, H, D, doors, drawers]) =>
    calculateItem({ id: cat, name: cat, category: "Kitchen Set", sheetMode: "potong", wasteFactor: 0.1,
      modules: applyQuickSpec(composeModules(cat, { width_mm: W, height_mm: H, depth_mm: D, doors, drawers, shelves: 0, doorType: "swing" } as never, cat), spec) } as never));
  const bom = mergeProjectBom(rs);
  const q = (re: RegExp) => bom.find((b) => re.test(b.name))?.qty;
  it("PVC Board 18 mm = 6 lembar", () => expect(q(/PVC Board 18/)).toBe(6));
  it("HPL bodi luar = 3 lembar, top 003 AA = 1 lembar", () => {
    expect(q(/825 NT/)).toBe(3);
    expect(q(/003 AA/)).toBe(1);
  });
  it("12 daun swing = 12 set engsel, 3 laci = 3 set rel", () => {
    expect(q(/Engsel/)).toBe(12);
    expect(q(/Rel Laci/)).toBe(3);
  });
  it("lem ≤ 5 kg = galon, tidak pernah 3 galon", () => {
    const g = bom.find((b) => b.id === "lem-active-galon")?.qty ?? 0;
    expect(g).toBeLessThan(3);
  });
});
