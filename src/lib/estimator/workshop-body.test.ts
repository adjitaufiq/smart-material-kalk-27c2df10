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
