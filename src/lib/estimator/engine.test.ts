import { describe, expect, it } from "vitest";

import { drawingExtractionService, designGenerationService } from "@/lib/estimator/ai";
import { calculateSheets, quickSheetEstimate } from "@/lib/estimator/cutlist";
import {
  calculateEdging,
  calculateHardware,
  calculateHpl,
  calculateItem,
  hplFaceParts,
  resolveStatus,
  validateItem,
} from "@/lib/estimator/engine";
import { buildDesignOptions, composeModules, makeModule, newFurnitureItem } from "@/lib/estimator/factory";
import { findMaterial } from "@/lib/estimator/masters";
import { generateParts, generatePartsForModules } from "@/lib/estimator/parts";
import { toMm } from "@/lib/estimator/units";
import type { FurnitureItem, ModuleSpec } from "@/lib/estimator/types";

function cabinet(overrides: Partial<ModuleSpec> = {}): ModuleSpec {
  return {
    ...makeModule({
      kind: "base_cabinet",
      name: "Base Cabinet 600",
      width_mm: 600,
      height_mm: 720,
      depth_mm: 550,
      doors: 1,
      shelves: 1,
    }),
    ...overrides,
  };
}

function itemWith(modules: ModuleSpec[], overrides: Partial<FurnitureItem> = {}): FurnitureItem {
  return {
    ...newFurnitureItem("Kabinet", "Test"),
    modules,
    confirmedConstruction: true,
    confirmedDimensions: true,
    hasDrawing: false,
    ...overrides,
  };
}

describe("unit conversion", () => {
  it("converts every UI unit into mm", () => {
    expect(toMm(60, "cm")).toBe(600);
    expect(toMm(2.4, "m")).toBe(2400);
    expect(toMm(720, "mm")).toBe(720);
  });
});

describe("1. cabinet 600×720×550 part generation", () => {
  const parts = generateParts(cabinet());

  it("produces sides at full height when top/bottom sit between sides", () => {
    const side = parts.find((p) => p.part_name === "Side Panel");
    expect(side).toBeDefined();
    expect(side?.qty).toBe(2);
    expect(side?.length_mm).toBe(720);
    expect(side?.width_mm).toBe(550);
    expect(side?.thickness_mm).toBe(18);
  });

  it("derives top/bottom from internal width", () => {
    const bottom = parts.find((p) => p.part_name === "Bottom Panel");
    expect(bottom?.length_mm).toBe(600 - 2 * 18); // 564
  });

  it("derives shelf from internal width and depth setback", () => {
    const shelf = parts.find((p) => p.part_name === "Shelf");
    expect(shelf?.length_mm).toBe(562);
    expect(shelf?.width_mm).toBe(550 - 20 - 9);
  });
});

describe("2. thickness change propagates to derived dimensions", () => {
  it("changes top/bottom length when body thickness changes", () => {
    const p18 = generateParts(cabinet());
    const p15 = generateParts(cabinet({ bodyMaterialId: "ply15" }));
    const b18 = p18.find((p) => p.part_name === "Bottom Panel")?.length_mm;
    const b15 = p15.find((p) => p.part_name === "Bottom Panel")?.length_mm;
    expect(b18).toBe(564);
    expect(b15).toBe(570);
  });
});

describe("3. back panel material routing", () => {
  it("puts the 9 mm back panel into the 9 mm material, not 18 mm", () => {
    const parts = generateParts(cabinet());
    const back = parts.find((p) => p.part_name === "Back Panel");
    expect(back?.material_id).toBe("ply9");
    expect(back?.thickness_mm).toBe(9);
    const { results } = calculateSheets(parts, "potong", 0.1);
    const ply9 = results.find((r) => r.materialId === "ply9");
    const ply18 = results.find((r) => r.materialId === "ply18");
    expect(ply9?.sheets).toBeGreaterThan(0);
    expect(ply18?.sheets).toBeGreaterThan(0);
  });
});

describe("4. two-sided HPL door produces two finishing faces", () => {
  const mod = cabinet({
    finish: {
      bodyOutside: { hplId: null },
      bodyInside: { hplId: null },
      doorFaceA: { hplId: "taco-002aa" },
      doorFaceB: { hplId: "taco-001" },
    },
  });
  const parts = generateParts(mod).filter((p) => p.part_name === "Daun Pintu");

  it("creates one HPL cutting part per face", () => {
    const faces = hplFaceParts(parts);
    expect(faces.size).toBe(2);
    expect(faces.get("taco-002aa")?.length).toBe(1);
    expect(faces.get("taco-001")?.length).toBe(1);
  });

  it("produces separate HPL BOM lines", () => {
    const { results } = calculateHpl(parts);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.sheets >= 1)).toBe(true);
  });
});

describe("5. grain direction is respected during nesting", () => {
  it("never rotates a grain-locked part", () => {
    const mod = cabinet({
      width_mm: 900,
      height_mm: 2000,
      doors: 1,
      finish: {
        bodyOutside: { hplId: null },
        bodyInside: { hplId: null },
        doorFaceA: { hplId: "taco-002aa" }, // arah serat: length
        doorFaceB: { hplId: null },
      },
    });
    const doors = generateParts(mod).filter((p) => p.part_name === "Daun Pintu");
    const { results } = calculateHpl(doors);
    const placed = results.flatMap((r) => r.layouts.flatMap((l) => l.placed));
    expect(placed.length).toBeGreaterThan(0);
    expect(placed.every((p) => !p.rotated)).toBe(true);
  });

  it("allows rotation only for grain-free sheets", () => {
    const mod = cabinet({
      finish: {
        bodyOutside: { hplId: null },
        bodyInside: { hplId: null },
        doorFaceA: { hplId: "aica-hg" }, // arah_serat none
        doorFaceB: { hplId: null },
      },
    });
    const doors = generateParts(mod).filter((p) => p.part_name === "Daun Pintu");
    expect(doors[0]).toBeDefined();
    const { results } = calculateHpl(doors);
    expect(results[0]?.sheets).toBe(1);
  });
});

describe("6. table with HPL only on the tabletop", () => {
  it("does not compute HPL for the steel frame", () => {
    const modules = composeModules("Meja", {
      width_mm: 1600,
      height_mm: 750,
      depth_mm: 700,
      doors: 0,
      drawers: 0,
      shelves: 0,
      doorType: "none",
    });
    const top = modules.find((m) => m.kind === "table_top");
    const frame = modules.find((m) => m.kind === "table_frame");
    expect(top).toBeDefined();
    expect(frame?.frameMaterial).toBe("besi");
    if (top) top.finish.bodyOutside = { hplId: "taco-002aa" };
    const parts = generatePartsForModules(modules);
    expect(parts.every((p) => p.module_id !== frame?.id)).toBe(true);
    const faces = hplFaceParts(parts);
    const hplParts = faces.get("taco-002aa") ?? [];
    expect(hplParts.length).toBeGreaterThan(0);
    expect(hplParts.every((p) => p.module_id === top?.id)).toBe(true);
  });
});

describe("7. drawers drive hardware quantity", () => {
  it("produces one rail set per drawer", () => {
    const hw = calculateHardware([cabinet({ doors: 0, drawers: 4, shelves: 0 })]);
    expect(hw.find((h) => h.id === "rel-laci")?.qty).toBe(4);
    expect(hw.find((h) => h.id === "handle")?.qty).toBe(4);
  });
});

describe("8. swing vs sliding hardware differ", () => {
  const swing = calculateHardware([cabinet({ doors: 2, doorType: "swing", height_mm: 2000 })]);
  const sliding = calculateHardware([cabinet({ doors: 2, doorType: "sliding", height_mm: 2000 })]);

  it("uses hinges for swing and tracks for sliding", () => {
    expect(swing.find((h) => h.id === "engsel-sendok")?.qty).toBe(8); // 4 per pintu @2000 mm
    expect(swing.find((h) => h.id === "rel-sliding")).toBeUndefined();
    expect(sliding.find((h) => h.id === "engsel-sendok")).toBeUndefined();
    expect(sliding.find((h) => h.id === "rel-sliding")?.qty).toBe(2);
  });
});

describe("9. confirmed drawing dimensions override defaults", () => {
  it("keeps the drawing depth and thickness instead of template defaults", () => {
    const mod = cabinet({ depth_mm: 520, bodyMaterialId: "ply18" });
    const parts = generateParts(mod);
    expect(parts.find((p) => p.part_name === "Side Panel")?.width_mm).toBe(520);
    expect(findMaterial(mod.bodyMaterialId)?.ketebalan_mm).toBe(18);
  });
});

describe("10. ambiguous extraction blocks a purchase-ready BOM", () => {
  it("stays in estimasi awal", () => {
    const item = itemWith([cabinet()], {
      hasDrawing: true,
      extraction: {
        id: "x1",
        drawingId: "d1",
        provider: "manual",
        raw: {},
        normalized: [
          {
            key: "module_width",
            label: "Lebar modul",
            value: null,
            confidence: 0.4,
            ambiguous: true,
            range: [550, 600],
          },
        ],
        confidence: 0.4,
        warnings: [],
        confirmed_by_user: true,
        confirmed_at: new Date().toISOString(),
      },
    });
    const result = calculateItem(item);
    expect(result.status).toBe("estimasi_awal");
    expect(result.issues.some((i) => i.code === "AMBIGUOUS_DRAWING_DIMENSION")).toBe(true);
  });

  it("blocks while extraction is unconfirmed", () => {
    const issues = validateItem(
      itemWith([cabinet()], {
        extraction: {
          id: "x2",
          drawingId: "d1",
          provider: "manual",
          raw: {},
          normalized: [],
          confidence: 0.9,
          warnings: [],
          confirmed_by_user: false,
          confirmed_at: null,
        },
      }),
    );
    expect(issues.some((i) => i.code === "EXTRACTION_UNCONFIRMED")).toBe(true);
  });
});

describe("11 & 12. generated design options each own their BOM", () => {
  const options = buildDesignOptions("Lemari Baju", {
    width_mm: 2400,
    height_mm: 2600,
    depth_mm: 600,
    doors: 4,
    drawers: 3,
    shelves: 3,
    doorType: "swing",
  });

  it("produces three structurally different models", () => {
    expect(options).toHaveLength(3);
    const signatures = options.map((o) =>
      o.structured_model.map((m) => `${m.kind}:${m.doors}:${m.doorType}:${m.drawers}:${m.shelves}`).join("|"),
    );
    expect(new Set(signatures).size).toBe(3);
  });

  it("computes a distinct BOM per option", () => {
    const boms = options.map((o) => calculateItem(itemWith(o.structured_model)));
    const partCounts = boms.map((b) => b.parts.reduce((a, p) => a + p.qty, 0));
    expect(new Set(partCounts).size).toBeGreaterThan(1);
    const hardware = boms.map(
      (b) => b.hardware.find((h) => h.id === "engsel-sendok")?.qty ?? 0,
    );
    expect(hardware[1]).toBe(0); // model sliding tanpa engsel
    expect(hardware[0]).not.toBe(hardware[2]);
  });
});

describe("13. part larger than sheet raises a validation error", () => {
  it("flags the oversized part", () => {
    const mod = cabinet({ width_mm: 3000, height_mm: 3000, doors: 1, shelves: 0 });
    const { issues } = calculateSheets(generateParts(mod), "potong", 0.1);
    expect(issues.some((i) => i.code === "PART_LARGER_THAN_SHEET")).toBe(true);
  });
});

describe("14. waste is never counted twice", () => {
  it("applies waste once in quick mode and not at all in nesting mode", () => {
    const parts = generateParts(cabinet());
    const area = parts.reduce((a, p) => a + p.qty * p.length_mm * p.width_mm, 0);
    const quick = quickSheetEstimate(parts, 2440 * 1220, 0.1);
    expect(quick.usedArea_mm2).toBe(area);
    const { results } = calculateSheets(parts, "potong", 0.1);
    expect(results.every((r) => r.wasteFactor === null)).toBe(true);
    const edging = calculateEdging(parts, 0.1);
    const raw = parts
      .filter((p) => p.edging_id)
      .reduce((acc, p) => {
        let l = 0;
        if (p.edge.top) l += p.length_mm;
        if (p.edge.bottom) l += p.length_mm;
        if (p.edge.left) l += p.width_mm;
        if (p.edge.right) l += p.width_mm;
        return acc + (l * p.qty) / 1000;
      }, 0);
    const total = edging.reduce((a, e) => a + e.meters, 0);
    expect(total).toBeCloseTo(Math.round(raw * 1.1 * 100) / 100, 1);
  });
});

describe("15. recalculation never returns a stale BOM", () => {
  it("changes sheet count when the design changes", () => {
    const small = calculateItem(itemWith([cabinet()]));
    const big = calculateItem(itemWith([cabinet({ qty: 8 })]));
    expect(big.sheets[0]?.sheets).toBeGreaterThan(small.sheets[0]?.sheets ?? 0);
    expect(big.computedAt).toBeDefined();
  });
});

describe("status ladder", () => {
  it("only reaches BOM siap belanja when everything is confirmed and nested", () => {
    const clean = itemWith([
      cabinet({
        finish: {
          bodyOutside: { hplId: "taco-001" },
          bodyInside: { hplId: "taco-001" },
          doorFaceA: { hplId: "taco-001" },
          doorFaceB: { hplId: "taco-001" },
        },
      }),
    ]);
    expect(calculateItem(clean).status).toBe("bom_siap_belanja");
    expect(calculateItem({ ...clean, sheetMode: "cepat" }).status).toBe("estimasi_terverifikasi");
    expect(calculateItem({ ...clean, confirmedConstruction: false }).status).toBe("estimasi_awal");
    expect(resolveStatus(clean, [{ severity: "error", code: "X", message: "x" }])).toBe(
      "estimasi_awal",
    );
  });
});

describe("kategori coverage", () => {
  const brief = {
    width_mm: 2400,
    height_mm: 2600,
    depth_mm: 600,
    doors: 4,
    drawers: 3,
    shelves: 3,
    doorType: "swing" as const,
  };
  for (const category of [
    "Kitchen Set",
    "Lemari Baju",
    "Meja",
    "Buffet TV",
    "Backdrop TV",
    "Custom Furniture",
  ]) {
    it(`produces parts and a BOM for ${category}`, () => {
      const modules = composeModules(category, brief);
      const result = calculateItem(itemWith(modules));
      expect(modules.length).toBeGreaterThan(0);
      expect(result.parts.length).toBeGreaterThan(0);
      expect(result.bom.length).toBeGreaterThan(0);
    });
  }

  it("does not treat a backdrop as a solid 18 mm field", () => {
    const modules = composeModules("Backdrop TV", brief);
    const panel = modules.find((m) => m.kind === "backdrop_panel");
    expect(findMaterial(panel?.bodyMaterialId)?.ketebalan_mm).toBe(9);
  });
});

describe("mock drawing flow 2400 × 2600 × 600, 4 doors, 3 drawers", () => {
  it("runs extraction → confirmation → modules → cut list → BOM", () => {
    const item = itemWith(
      composeModules("Lemari Baju", {
        width_mm: 2400,
        height_mm: 2600,
        depth_mm: 600,
        doors: 4,
        drawers: 3,
        shelves: 4,
        doorType: "swing",
      }),
      {
        hasDrawing: true,
        extraction: {
          id: "x3",
          drawingId: "d1",
          provider: "mock",
          raw: { note: "mock extraction fixture" },
          normalized: [
            { key: "width", label: "Lebar", value: 2400, unit: "mm", confidence: 0.95, ambiguous: false },
            { key: "height", label: "Tinggi", value: 2600, unit: "mm", confidence: 0.95, ambiguous: false },
            { key: "depth", label: "Depth", value: 600, unit: "mm", confidence: 0.93, ambiguous: false },
            { key: "doors", label: "Jumlah pintu", value: 4, confidence: 0.9, ambiguous: false },
            { key: "drawers", label: "Jumlah laci", value: 3, confidence: 0.9, ambiguous: false },
          ],
          confidence: 0.93,
          warnings: [],
          confirmed_by_user: true,
          confirmed_at: new Date().toISOString(),
        },
      },
    );
    const result = calculateItem(item);
    expect(result.parts.length).toBeGreaterThan(0);
    expect(result.sheets.reduce((a, s) => a + s.sheets, 0)).toBeGreaterThan(0);
    expect(result.hardware.find((h) => h.id === "rel-laci")?.qty).toBe(3);
    expect(result.bom.some((b) => b.group === "material")).toBe(true);
    expect(result.status).not.toBe("estimasi_awal");
  });
});

describe("AI services are abstractions only", () => {
  it("reports unavailable instead of fabricating results", async () => {
    expect(drawingExtractionService.available).toBe(false);
    expect(designGenerationService.available).toBe(false);
    await expect(
      drawingExtractionService.extract({
        id: "d",
        name: "x",
        mime: "image/png",
        dataUrl: "",
        uploadedAt: "",
      }),
    ).rejects.toThrow(/belum tersambung/);
  });
});

describe("traceability", () => {
  it("explains why each material line is needed", () => {
    const result = calculateItem(itemWith([cabinet()]));
    const line = result.bom.find((b) => b.group === "material");
    expect(line?.trace.length).toBeGreaterThan(0);
    expect(line?.explanation).toMatch(/nesting|Area-based/);
  });
});
