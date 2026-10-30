import { describe, expect, it } from "vitest";
import { composeModules } from "./factory";
import { calculateHardware, calculateItem } from "./engine";
import { generatePartsForModules } from "./parts";
import { newFurnitureItem } from "./factory";
import type { ModuleSpec } from "./types";

const brief = (w: number, h: number, d: number, doors = 0, drawers = 0) => ({
  width_mm: w, height_mm: h, depth_mm: d, doors, drawers, shelves: 0, doorType: "swing" as const,
});
const item = (modules: ModuleSpec[]) => ({ ...newFurnitureItem("X", "T"), modules });

describe("Kitchen Set anatomy", () => {
  const mods = composeModules("Kitchen Set", brief(2400, 820, 600, 4, 0));
  it("has base cabinets on 100 mm plinth, keeping total height 820", () => {
    const base = mods.filter((m) => m.kind === "base_cabinet");
    const plinth = mods.find((m) => m.kind === "plinth");
    expect(plinth?.height_mm).toBe(100);
    expect(base.every((b) => b.height_mm === 720)).toBe(true);
  });
  it("base cabinets use 2 stretchers 100 mm instead of a full top panel", () => {
    const parts = generatePartsForModules(mods.filter((m) => m.kind === "base_cabinet"));
    expect(parts.some((p) => p.part_name === "Top Panel")).toBe(false);
    const s = parts.find((p) => p.part_name.startsWith("Palang Atas"));
    expect(s?.qty).toBe(2);
    expect(s?.width_mm).toBe(100);
  });
  it("adds wall cabinets 350 mm deep, hung on French cleat", () => {
    const upper = mods.filter((m) => m.kind === "wall_cabinet");
    expect(upper.length).toBe(mods.filter((m) => m.kind === "base_cabinet").length);
    expect(upper.every((u) => u.depth_mm === 350 && u.wallMount)).toBe(true);
    expect(calculateHardware(mods).find((h) => h.id === "dynabolt")?.qty).toBeGreaterThan(0);
  });
  it("adjuster feet: 4 for the first base cabinet + 2 per extra", () => {
    const n = mods.filter((m) => m.kind === "base_cabinet").length;
    expect(calculateHardware(mods).find((h) => h.id === "kaki-adjust")?.qty).toBe(4 + 2 * (n - 1));
  });
});

describe("Lemari anatomy", () => {
  it("2600 tall wardrobe = 80 plinth + 2100 body + 420 loft", () => {
    const mods = composeModules("Lemari Baju", brief(2400, 2600, 600, 4, 0));
    expect(mods.find((m) => m.kind === "plinth")?.height_mm).toBe(80);
    expect(mods.find((m) => m.kind === "wardrobe")?.height_mm).toBe(2100);
    expect(mods.find((m) => m.kind === "tall_cabinet")?.height_mm).toBe(420);
  });
});

describe("Meja anatomy", () => {
  const mods = composeModules("Meja", brief(1600, 750, 700));
  const parts = generatePartsForModules(mods);
  it("has separate Kaki Panel Kiri, Kanan and Modesty", () => {
    for (const n of ["Kaki Panel Kiri", "Kaki Panel Kanan", "Modesty Panel"]) {
      expect(parts.filter((p) => p.part_name === n).length).toBe(1);
    }
  });
  it("top is double layer 1600 × 700", () => {
    const top = parts.find((p) => p.part_name === "Top Table");
    expect(top?.qty).toBe(2);
    expect(top?.length_mm).toBe(1600);
  });
  it("adds 1 grommet and 4 glides", () => {
    const hw = calculateHardware(mods);
    expect(hw.find((h) => h.id === "grommet")?.qty).toBe(1);
    expect(hw.find((h) => h.id === "glide-meja")?.qty).toBe(4);
  });
});

describe("Backdrop & Buffet TV", () => {
  it("backdrop 2400 × 2400 has reng frame every 400 mm (7 verticals) and cleat", () => {
    const parts = generatePartsForModules(composeModules("Backdrop TV", brief(2400, 2400, 0)));
    expect(parts.find((p) => p.part_name === "Rangka Reng Vertikal")?.qty).toBe(7);
    expect(parts.find((p) => p.part_name === "Rangka Reng Horizontal")?.qty).toBe(5);
    expect(parts.some((p) => p.part_name === "French Cleat Backdrop")).toBe(true);
  });
  it("buffet 500 tall = 400 body + 100 plinth", () => {
    const mods = composeModules("Buffet TV", brief(1800, 500, 400, 2));
    expect(mods.find((m) => m.kind === "base_cabinet")?.height_mm).toBe(400);
    expect(mods.find((m) => m.kind === "plinth")?.height_mm).toBe(100);
  });
});

describe("Consumables", () => {
  it("HPL glue: 1 can per 4 m² of HPL face", () => {
    const mods = composeModules("Meja", brief(1600, 750, 700));
    const top = mods.find((m) => m.kind === "table_top");
    if (top) top.finish.bodyOutside = { hplId: "taco-002aa" };
    const r = calculateItem(item(mods));
    // 2 layers × 1.6 × 0.7 = 2.24 m² → 1 kaleng
    expect(r.bom.find((b) => b.id === "lem-hpl")?.qty).toBe(1);
  });
  it("screws are counted in boxes of 100 (40 per cabinet module)", () => {
    const mods = composeModules("Lemari Baju", brief(2400, 2000, 600, 4, 0));
    const cab = mods.filter((m) => m.kind === "wardrobe").length;
    expect(calculateHardware(mods).find((h) => h.id === "sekrup")?.qty).toBe(Math.ceil((cab * 40) / 100));
  });
});

describe("Kitchen Set bawah / atas terpisah", () => {
  it("Kitchenset bawah 240×85×60 cm: hanya kabinet bawah + plinth, tanpa kabinet atas", () => {
    const mods = composeModules("Kitchenset bawah", brief(2400, 850, 600, 4, 2));
    expect(mods.some((m) => m.kind === "wall_cabinet")).toBe(false);
    expect(mods.find((m) => m.kind === "plinth")?.height_mm).toBe(100);
    expect(mods.filter((m) => m.kind === "base_cabinet").every((m) => m.height_mm === 750)).toBe(true);
  });
  it("Kitchenset atas: hanya kabinet atas dengan ukuran dari user", () => {
    const mods = composeModules("kitchenset atas", brief(2400, 700, 350, 4, 0));
    expect(mods.every((m) => m.kind === "wall_cabinet")).toBe(true);
    expect(mods.reduce((s, m) => s + m.width_mm, 0)).toBe(2400);
    expect(mods.every((m) => m.height_mm === 700 && m.depth_mm === 350)).toBe(true);
  });
});
